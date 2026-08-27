"""
BTI Analytics Dashboard - Snowflake Data Refresh Script
========================================================
Connects to Snowflake using keypair authentication and rebuilds
all dashboard JSON files automatically.

Requirements:
    pip install snowflake-connector-python cryptography pandas

Setup:
    Fill in the CONFIG section below with your Snowflake credentials.
"""

import os
import sys
import json
import csv
import re
import bisect
import urllib.request
from datetime import datetime, timedelta
from collections import defaultdict

# Fix Windows console encoding so emoji/unicode in print() doesn't crash
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ─────────────────────────────────────────────
#  CONFIG — Fill these in
# ─────────────────────────────────────────────
# NOTE FOR WINDOWS USERS: Always use forward slashes (/) in paths, not backslashes (\)
# Example: "C:/Users/Diana/folder/" NOT "C:\Users\Diana\folder\"
CONFIG = {
    "account":    "ehb48572",  # connector auto-appends .snowflakecomputing.com
    "user":       "DIANA_AGUILAR",
    "private_key_path": "C:/Users/DianaAguilar/.ssh/diana_snowflake_key.p8",
    "private_key_passphrase": None,         # passphrase if key is encrypted, else None
    "warehouse":  "REPORTING",
    "database":   "ANALYTICS",
    "schema":     "MART",
    "role":       "ENROLLMENT_REPORTING",

    # Paths — where to write the output JSON files
    # Change this to your local GitHub Pages folder
    "output_dir": "C:/Users/DianaAguilar/Desktop/BTI EX/All Orders/",

    # Optional: fallback payments CSV if Snowflake payments table is unavailable
    # "payments_csv": "Payments_report.csv",  # not needed if Snowflake is connected

    # Asana API — Client Resolution project
    # Token is loaded from secrets.json (see fetch_asana_tasks)
    "asana_project_id": "1199886669661274",

    # Date range for data pull
    "start_date": "2022-01-01",
}
# ─────────────────────────────────────────────

def connect_snowflake():
    """Connect using keypair authentication."""
    import os
    # Disable OCSP cache server call — prevents indefinite hang on Windows before connect()
    os.environ.setdefault("SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED", "false")
    os.environ.setdefault("SNOWFLAKE_PYTHON_CONNECTOR_OCSP_MODE", "FAIL_OPEN")
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.backends import default_backend
    import snowflake.connector

    key_path = CONFIG["private_key_path"]
    passphrase = CONFIG["private_key_passphrase"]

    with open(key_path, "rb") as f:
        private_key = serialization.load_pem_private_key(
            f.read(),
            password=passphrase.encode() if passphrase else None,
            backend=default_backend()
        )

    private_key_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )

    conn_params = {
        "account":         CONFIG["account"],
        "user":            CONFIG["user"],
        "private_key":     private_key_bytes,
        "warehouse":       CONFIG["warehouse"],
        "database":        CONFIG["database"],
        "schema":          CONFIG["schema"],
        "login_timeout":   60,
        "network_timeout": 60,
        "ocsp_fail_open":  True,   # prevents indefinite hang on Windows OCSP cert check
        "session_parameters": {"PYTHON_CONNECTOR_QUERY_RESULT_FORMAT": "JSON"},
    }
    if CONFIG.get("role"):
        conn_params["role"] = CONFIG["role"]

    print("Connecting to Snowflake...", flush=True)
    conn = snowflake.connector.connect(**conn_params)
    print("Connected to Snowflake", flush=True)
    return conn


def sf_fetch_rows(cur, batch_size=5000):
    """Stream rows from an executed cursor in small batches — avoids large S3 batch OOM."""
    cols = [c[0] for c in cur.description]
    rows = []
    while True:
        chunk = cur.fetchmany(batch_size)
        if not chunk:
            break
        for row in chunk:
            d = dict(zip(cols, row))
            for k, v in d.items():
                if hasattr(v, 'strftime'):
                    d[k] = v.strftime('%Y-%m-%d')
                elif v is None:
                    d[k] = ''
                else:
                    d[k] = str(v)
            rows.append(d)
    return rows


def fetch_orders(conn):
    """Pull all orders from DIM_ALL_ORDERS."""
    print("Fetching orders from Snowflake...", flush=True)
    sql = f"""
        SELECT
            ID, UNIQUE_ORDER_ID, CONTACTID, SKU, DATE, MONTH,
            REFERRAL_PARTNER_CATEGORY, REFERRAL_PARTNER,
            INV_TOTAL, PAYMENTS_TOTAL, ACTUAL_INV_SALE_TOTAL,
            PMT_STATUS, CREDIT_STATUS, REFUND_CREDIT_DATE,
            ENROLLMENT_MENTOR, SKU_CATEGORY, DIVISION,
            LOST_REVENUE, REFUNDS, CREDITS,
            PRODUCTS, NORMALIZED_PRODUCT,
            HEAVEN_DATE, FULL_NAME,
            HEAVEN_QTY, HEAVEN_INVOICE_TOTAL
        FROM ANALYTICS.MART.DIM_ALL_ORDERS
        WHERE DATE >= '{CONFIG["start_date"]}'
          AND PAYMENTS_TOTAL > 0
          AND SKU IS NOT NULL AND SKU != ''
        ORDER BY DATE DESC
    """
    cur = conn.cursor()
    cur.execute(sql)
    rows = sf_fetch_rows(cur)
    # Normalize: convert dates to strings (already done in sf_fetch_rows, kept for safety)
    for r in rows:
        for k, v in r.items():
            if hasattr(v, 'strftime'):
                r[k] = v.strftime('%Y-%m-%d')
            elif v is None:
                r[k] = ''
            else:
                r[k] = str(v)
    print(f"   → {len(rows):,} orders fetched")
    return rows


def fetch_payments(conn):
    """Pull all payments from stg_inf_payments_combined, joined to DIM_ALL_ORDERS.
    Joining through DIM_ALL_ORDERS:
      1. Resolves cross-account INVOICEID collisions (different Infusionsoft accounts
         can share the same short INVOICEID; the DATE range guard filters stale matches).
      2. LDP deposit = 4 deposit windows computed from MIN(PAYDATE):
           "Deposit" = dep_0: same day only (original first-day rule)
           "dep_1"   = MIN(PAYDATE) + 1 day
           "dep_2"   = MIN(PAYDATE) + 2 days
           "dep_3"   = MIN(PAYDATE) + 3 days
    Columns returned:
      "UID"           = UNIQUE_ORDER_ID (globally unique — primary lookup key)
      "Id"            = raw INVOICEID   (kept for AR backward-compatibility)
      "Deposit"       = dep_0: payments on MIN(PAYDATE) only (same day)
      "dep_1/2/3"     = cumulative deposits through +1/+2/+3 days
      "First_Date"    = first payment date
      "LAST_PAY_DATE" = most recent payment date (for AR aging / tracker)
      "PMT_COUNT"     = total number of valid payment records
      "IS_PIF"        = 1 if order has a 'Discount for Payment in Full' record
    Only real tender types count toward deposits/dates.  Discounts/adjustments
    are excluded from amounts but the PIF-discount flag is tracked separately.
    """
    print("⏳ Fetching payments from Snowflake...")
    sql = f"""
        WITH all_pmts AS (
            -- All non-deleted positive payments for orders in scope.
            -- order_date = GREATEST(HEAVEN_DATE, DATE): for pre-event enrollments
            -- HEAVEN_DATE >= DATE so the event date is the cutoff; for late/post-event
            -- enrollments DATE > HEAVEN_DATE so the actual purchase date is the cutoff.
            -- This ensures a payment made on the real sale day is always in dep_0.
            -- Pre-sale payments up to 30 days before DATE are also included.
            SELECT
                o.UNIQUE_ORDER_ID,
                o.ID                                    AS order_id,
                GREATEST(COALESCE(o.HEAVEN_DATE, o.DATE), o.DATE) AS order_date,
                p.PAYDATE,
                p.PAYAMT,
                p.PAYTYPE
            FROM ANALYTICS.MART.stg_inf_payments_combined p
            JOIN ANALYTICS.MART.DIM_ALL_ORDERS o
              ON p.INVOICEID = o.ID
             AND p.PAYDATE  >= DATEADD(day, -30, o.DATE)
            WHERE p.PAYAMT > 0
              AND (p._CHECK_IF_DELETED = 0 OR p._CHECK_IF_DELETED IS NULL)
              AND o.DATE >= '{CONFIG["start_date"]}'
              AND o.SKU IS NOT NULL AND o.SKU != ''
        ),
        valid_pmts AS (
            -- Only real tender types count toward deposit amounts & dates.
            SELECT * FROM all_pmts
            WHERE PAYTYPE IN (
                'Credit Card', 'Credit Card (Manual)', 'Credit Card (MANUAL)',
                'ACH', 'ACH Bank',
                'PayPal', 'PayPal Payment', 'Paypal', 'PayPal Express Checkout',
                'Wire', 'Wire Transfer',
                'Check', 'Cash'
            )
        ),
        pif_flag AS (
            -- Orders with a PIF-discount record are treated as Paid in Full.
            SELECT DISTINCT UNIQUE_ORDER_ID, order_id, 1 AS is_pif
            FROM all_pmts
            WHERE PAYTYPE = 'Discount for Payment in Full'
        )
        SELECT
            v.UNIQUE_ORDER_ID                                                         AS "UID",
            v.order_id                                                                AS "Id",
            -- dep_0: all payments whose date (ignoring time) is on or before the sale date.
            -- PAYDATE is a TIMESTAMP; casting to DATE strips the time so a payment at
            -- 15:57 on the sale date is not wrongly excluded by a midnight comparison.
            SUM(CASE WHEN v.PAYDATE::DATE <= v.order_date
                     THEN v.PAYAMT ELSE 0 END)                                        AS "Deposit",
            SUM(CASE WHEN v.PAYDATE::DATE <= DATEADD(day, 1, v.order_date)
                     THEN v.PAYAMT ELSE 0 END)                                        AS "dep_1",
            SUM(CASE WHEN v.PAYDATE::DATE <= DATEADD(day, 2, v.order_date)
                     THEN v.PAYAMT ELSE 0 END)                                        AS "dep_2",
            SUM(CASE WHEN v.PAYDATE::DATE <= DATEADD(day, 3, v.order_date)
                     THEN v.PAYAMT ELSE 0 END)                                        AS "dep_3",
            MIN(v.PAYDATE)                                                             AS "First_Date",
            MAX(v.PAYDATE)                                                             AS LAST_PAY_DATE,
            COUNT(*)                                                                   AS PMT_COUNT,
            COALESCE(MAX(p.is_pif), 0)                                                AS IS_PIF
        FROM valid_pmts v
        LEFT JOIN pif_flag p
          ON v.UNIQUE_ORDER_ID = p.UNIQUE_ORDER_ID
         AND v.order_id        = p.order_id
        GROUP BY v.UNIQUE_ORDER_ID, v.order_id, v.order_date
    """
    cur = conn.cursor()
    cur.execute(sql)
    rows = sf_fetch_rows(cur)
    print(f"   → {len(rows):,} orders with payment records fetched")
    return rows


# ─────────────────────────────────────────────
#  HELPER FUNCTIONS
# ─────────────────────────────────────────────

def clean_money(v):
    if not v: return 0.0
    try: return float(str(v).replace('$','').replace(',','').strip())
    except: return 0.0

def parse_date(s):
    if not s: return None
    s = str(s).strip()
    for fmt in ["%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d"]:
        try: return datetime.strptime(s[:10], fmt).date()
        except: pass
    return None

def get_cncl(cs):
    cs = (cs or "").lower().strip()
    # ── Pend: not a unit (checked before generic cncl) ──────────────────
    if "test-cncl" in cs:           return "Pend"
    if cs == "cncl-pending":        return "Pend"
    if cs == "pendord to saleord":  return "Pend"
    if cs == "cncl-fref-dup":       return "Pend"
    # ── No Pmt: not a unit (checked before generic cncl) ────────────────
    if "nopayment" in cs or "no payment" in cs or "nopmt" in cs: return "No Pmt"
    # ── Switch: counts as unit, Active (checked before generic cncl) ────
    if "switchev" in cs or "switchtopp" in cs or "sw div" in cs: return "Switch"
    # ── Original categories ──────────────────────────────────────────────
    if "upgrade"     in cs: return "Upgrade"
    if "downgrade"   in cs: return "Downgrade"
    if "entry error" in cs or "error" in cs: return "Entry Error"
    if "cncl"        in cs or "lrev" in cs:  return "Cancelled"
    return "Sale"

def get_active(cncl):
    return "Inactive" if cncl in ("Entry Error","Cancelled","Pend","No Pmt") else "Active"

def get_division(uid):
    uid = (uid or "").lower()
    if "jj969" in uid: return "LS"
    if "ho175" in uid: return "B&L"
    if "it175" in uid: return "L&R"
    if "zu201" in uid: return "HWB"
    return "Other"

def get_div_label(uid):
    """User-facing division names for the dashboard Division filter."""
    uid = (uid or "").lower()
    if "jj969" in uid: return "LT/LCC"
    if "ho175" in uid: return "B&L"
    if "zu201" in uid: return "HWB"
    if "it175" in uid: return "MYM"
    return "Other"

def get_rd(refund_date, date):
    if not refund_date or not date: return "N/A"
    try:
        d1 = datetime.strptime(str(date)[:10],     "%Y-%m-%d")
        d2 = datetime.strptime(str(refund_date)[:10], "%Y-%m-%d")
        diff = abs((d2 - d1).days)
        if diff <= 30:  return "<=30d"
        if diff <= 45:  return "<=45d"
        if diff <= 60:  return "<=60d"
        if diff <= 90:  return "<=90d"
        return ">90d"
    except: return "N/A"

def get_rd_days(refund_date, date):
    """Return integer days between purchase date and refund/credit date, or -1 if unavailable."""
    if not refund_date or not date: return -1
    try:
        d1 = datetime.strptime(str(date)[:10],        "%Y-%m-%d")
        d2 = datetime.strptime(str(refund_date)[:10], "%Y-%m-%d")
        return abs((d2 - d1).days)
    except: return -1

def pif_classify(row):
    """Classify order as PIF (within 30d), PIF_LATE (after 30d), or PP."""
    pmt    = (row.get("PMT_STATUS","") or "").strip()
    credit = (row.get("CREDIT_STATUS","") or "").strip().lower()
    date   = row.get("DATE","")
    rdate  = row.get("REFUND_CREDIT_DATE","")
    days   = None
    if date and rdate and str(rdate).strip():
        try:
            days = abs((datetime.strptime(str(rdate)[:10], "%Y-%m-%d") -
                        datetime.strptime(str(date)[:10],  "%Y-%m-%d")).days)
        except: pass

    if pmt == "Full Payment":
        if "discount for payment in full" in credit and days is not None:
            return "PIF" if days <= 30 else "PIF_LATE"
        if days is None or days <= 30:
            return "PIF"
        return "PIF_LATE"

    if "discount for payment in full" in credit:
        if days is not None:
            return "PIF" if days <= 30 else "PIF_LATE"
        return "PIF"

    return "PP"


# ─────────────────────────────────────────────
#  BUILD data.json  (Cancellation Dashboard)
# ─────────────────────────────────────────────

def build_cancellation_data(orders, ldp_order_ids=None, ldp_first_pay=None):
    print("⏳ Building data.json (Cancellation)...")

    # b[0]=Total  b[1]=Cancelled  b[2]=EntryError  b[3]=Upgrade  b[4]=Downgrade
    # b[5]=Active b[6]=Inactive   b[7]=LostRev     b[8]=Switch   b[9]=Pend  b[10]=NoPmt  b[11]=LDP_Cancelled
    Ti,Ci,Ei,Ui,Di,Ai,Ii,CRi,Si,Pi,NPi,LDPi = 0,1,2,3,4,5,6,7,8,9,10,11
    def make_b(): return [0,0,0,0,0,0,0,0.0,0,0,0,0]
    rows_by_sku = defaultdict(list)
    def upd(b, cncl, active, lr, is_ldp=False):
        b[0] += 1
        if   cncl == "Cancelled":   b[1] += 1
        elif cncl == "Entry Error": b[2] += 1
        elif cncl == "Upgrade":     b[3] += 1
        elif cncl == "Downgrade":   b[4] += 1
        elif cncl == "Switch":      b[8] += 1
        elif cncl == "Pend":        b[9] += 1
        elif cncl == "No Pmt":      b[10]+= 1
        if active == "Active":      b[5] += 1
        else:                       b[6] += 1
        b[7] += lr
        if is_ldp and cncl == "Cancelled": b[11] += 1

    M = defaultdict(make_b)   # monthly global
    S = defaultdict(make_b)   # by SKU
    PC= defaultdict(make_b)   # by pcat
    P = defaultdict(make_b)   # by partner
    PCM = defaultdict(lambda: defaultdict(make_b))  # pcat x month
    PM  = defaultdict(lambda: defaultdict(make_b))  # partner x month
    GMSKU    = defaultdict(lambda: defaultdict(make_b))     # month x sku
    PCMSKU   = defaultdict(lambda: defaultdict(lambda: defaultdict(make_b)))  # pcat x month x sku
    PMSKU    = defaultdict(lambda: defaultdict(lambda: defaultdict(make_b)))  # partner x month x sku
    GMRD     = defaultdict(lambda: defaultdict(int))   # month x rd_bucket
    PCMRD    = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    PMRD     = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    GMSKU_CR = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))   # month x sku x credit_status
    PCMSKU_CR= defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(int))))
    QFY      = defaultdict(lambda: defaultdict(make_b))   # "FY'25" x "Q1" bucket
    SKURD    = defaultdict(lambda: defaultdict(int))       # sku x rd_bucket

    skus=set(); parts=set(); pcats=set()
    sku_div = {}  # SKU → division label (for JS Division filter)

    for r in orders:
        cncl   = get_cncl(r.get("CREDIT_STATUS",""))
        active = get_active(cncl)
        # Use HEAVEN_DATE for month grouping (fallback to DATE if blank)
        heaven_str = (r.get("HEAVEN_DATE","") or "")[:10]
        date_str   = str(r.get("DATE",""))[:10]
        eff_date   = heaven_str if heaven_str >= "2000" else date_str
        month  = eff_date[:7]
        sku    = r.get("SKU","") or "Unknown"
        pcat   = r.get("REFERRAL_PARTNER_CATEGORY","") or "Unknown"
        part   = r.get("REFERRAL_PARTNER","") or "Unknown"
        if sku not in sku_div:
            sku_div[sku] = get_div_label(r.get("UNIQUE_ORDER_ID",""))
        inv_total_val  = float(r.get("INV_TOTAL",0) or 0)
        payments_val   = float(r.get("PAYMENTS_TOTAL",0) or 0)
        refunds_val    = float(r.get("REFUNDS",0) or 0)
        inv_actual_val = float(r.get("ACTUAL_INV_SALE_TOTAL",0) or 0)
        lr = max(0.0, inv_total_val - payments_val + refunds_val) if cncl == "Cancelled" else 0.0
        rdate  = r.get("REFUND_CREDIT_DATE","")
        date   = r.get("DATE","")
        cs_raw = r.get("CREDIT_STATUS","") or ""
        oid    = r.get("ID","")
        is_ldp = bool(ldp_order_ids and oid in ldp_order_ids)

        if not month: continue
        skus.add(sku); parts.add(part); pcats.add(pcat)

        upd(M[month],         cncl, active, lr, is_ldp)
        if month and len(month)>=7:
            _yr=int(month[:4]);_mo=int(month[5:7])
            upd(QFY["FY'"+str(_yr)[2:]]["Q"+str((_mo-1)//3+1)],cncl,active,lr,is_ldp)
        upd(S[sku],           cncl, active, lr, is_ldp)
        upd(PC[pcat],         cncl, active, lr, is_ldp)
        upd(P[part],          cncl, active, lr, is_ldp)
        upd(PCM[pcat][month], cncl, active, lr, is_ldp)
        upd(PM[part][month],  cncl, active, lr, is_ldp)
        upd(GMSKU[month][sku],           cncl, active, lr, is_ldp)
        upd(PCMSKU[pcat][month][sku],    cncl, active, lr, is_ldp)
        upd(PMSKU[part][month][sku],     cncl, active, lr, is_ldp)

        # Refund days — include N/A for cancelled orders without a refund date
        if cncl == "Cancelled":
            rd = get_rd(rdate, date)
            GMRD[month][rd]        += 1
            PCMRD[pcat][month][rd] += 1
            PMRD[part][month][rd]  += 1
            SKURD[sku][rd]         += 1

        # Order-level detail row: [id,contactid,date,active,cncl,inv_total,refunds,pcat,partner,product,
        #   order_lr,order_rd,rd_days,is_ldp,dep_0,division,heaven_date,invoice_actual,dep_1,dep_2,dep_3]
        order_lr = round(max(0.0, inv_total_val - payments_val + refunds_val), 2) if cncl == "Cancelled" else 0.0
        order_rd = get_rd(rdate, date) if cncl == "Cancelled" else "—"
        rd_days  = get_rd_days(rdate, date) if cncl == "Cancelled" else -1
        _ldp_d   = ldp_first_pay.get(oid, (0.0,0.0,0.0,0.0)) if ldp_first_pay else (0.0,0.0,0.0,0.0)
        ldp_dep0 = round(_ldp_d[0], 2) if is_ldp else 0.0
        ldp_dep1 = round(_ldp_d[1], 2) if is_ldp else 0.0
        ldp_dep2 = round(_ldp_d[2], 2) if is_ldp else 0.0
        ldp_dep3 = round(_ldp_d[3], 2) if is_ldp else 0.0
        rows_by_sku[sku].append([
            r.get("ID",""),
            r.get("CONTACTID",""),
            str(r.get("DATE",""))[:10],    # index  2: original purchase date (DATE)
            active,
            cncl,
            round(inv_total_val, 2),
            round(refunds_val, 2),
            pcat,
            part,
            r.get("PRODUCTS","") or r.get("NORMALIZED_PRODUCT",""),
            order_lr,
            order_rd,
            rd_days,                       # index 12: integer days to cancel, -1 if N/A
            1 if is_ldp else 0,            # index 13: LDP flag (based on LDP_DOWN_PMTS threshold)
            ldp_dep0,                      # index 14: dep_0 — same-day deposit (LDP orders only)
            get_div_label(r.get("UNIQUE_ORDER_ID","")),  # index 15: division label
            eff_date,                      # index 16: HEAVEN_DATE (fallback DATE) — used by JS date filter
            round(inv_actual_val, 2),      # index 17: ACTUAL_INV_SALE_TOTAL (Net Invoice)
            ldp_dep1,                      # index 18: dep_1 — deposit through +1 day
            ldp_dep2,                      # index 19: dep_2 — deposit through +2 days
            ldp_dep3,                      # index 20: dep_3 — deposit through +3 days
            r.get("FULL_NAME",""),         # index 21: client name
        ])

        # Cancel reasons
        if cncl in ("Cancelled","Entry Error","Switch","Pend","No Pmt") and cs_raw:
            GMSKU_CR[month][sku][cs_raw]          += 1
            PCMSKU_CR[pcat][month][sku][cs_raw]   += 1

    data = {
        "QFY": {fy: {q: list(v) for q,v in sorted(qv.items())} for fy,qv in sorted(QFY.items())},
        "M":   {k: list(v) for k,v in sorted(M.items())},
        "S":   {k: list(v) for k,v in S.items()},
        "PC":  {k: list(v) for k,v in PC.items()},
        "P":   {k: list(v) for k,v in P.items()},
        "PCM": {p: {m: list(v) for m,v in mv.items()} for p,mv in PCM.items()},
        "PM":  {p: {m: list(v) for m,v in mv.items()} for p,mv in PM.items()},
        "GMSKU":  {m: {s: list(v) for s,v in sv.items()} for m,sv in GMSKU.items()},
        "PCMSKU": {p: {m: {s: list(v) for s,v in sv.items()} for m,sv in mv.items()} for p,mv in PCMSKU.items()},
        "PMSKU":  {p: {m: {s: list(v) for s,v in sv.items()} for m,sv in mv.items()} for p,mv in PMSKU.items()},
        "GMRD":   {m: dict(v) for m,v in GMRD.items()},
        "PCMRD":  {p: {m: dict(v) for m,v in mv.items()} for p,mv in PCMRD.items()},
        "PMRD":   {p: {m: dict(v) for m,v in mv.items()} for p,mv in PMRD.items()},
        "SKURD":  {s: dict(v) for s,v in SKURD.items()},
        "GMSKU_CR":  {m: {s: dict(cr) for s,cr in sv.items()} for m,sv in GMSKU_CR.items()},
        "PCMSKU_CR": {p: {m: {s: dict(cr) for s,cr in sv.items()} for m,sv in mv.items()} for p,mv in PCMSKU_CR.items()},
        "FL": {
            "skus":     sorted(s for s in skus  if s and s != "Unknown"),
            "partners": sorted(p for p in parts if p and p != "Unknown"),
            "pcats":    sorted(p for p in pcats if p and p != "Unknown"),
        },
        "sku_div": sku_div,  # SKU → division label for JS Division filter
        # Keep RM, RD, CR, PT, PCT, GT stubs (rebuilt by pif/ldp builders)
        "RD": {}, "RM": {}, "CR": {}, "PT": {}, "PCT": {}, "GT": {},
        # Order-level rows grouped by SKU for drill-down table
        "order_rows": {s: v for s, v in rows_by_sku.items()},
    }
    print(f"   → {sum(v[0] for v in M.values()):,} total records")
    return data


# ─────────────────────────────────────────────
#  BUILD pif_data.json  (PIF/PP Dashboard)
# ─────────────────────────────────────────────

def build_pif_data(orders):
    print("⏳ Building pif_data.json (PIF/PP)...")

    # 13-element bucket:
    # [0=total,1=pif,2=pp,3=pif_late,4=pif_inv,5=pp_inv,6=pif_late_inv,
    #  7=active,8=inactive,9=active_pif,10=active_pp,11=inactive_pif,12=inactive_pp]
    def make_b(): return [0]*13

    def upd(b, cls, inv, active):
        b[0] += 1
        if   cls == "PIF":      b[1]+=1; b[4]+=inv
        elif cls == "PP":       b[2]+=1; b[5]+=inv
        elif cls == "PIF_LATE": b[3]+=1; b[6]+=inv
        if active == "Active":
            b[7]  += 1
            if   cls == "PIF":  b[9]  += 1
            elif cls == "PP":   b[10] += 1
        else:
            b[8]  += 1
            if   cls == "PIF":  b[11] += 1
            elif cls == "PP":   b[12] += 1

    monthly  = defaultdict(make_b)
    sku_map  = defaultdict(make_b)
    pcat_map = defaultdict(make_b)
    part_map = defaultdict(make_b)
    div_map  = defaultdict(make_b)
    mdiv     = defaultdict(lambda: defaultdict(make_b))
    pcm      = defaultdict(lambda: defaultdict(make_b))
    pm       = defaultdict(lambda: defaultdict(make_b))
    smnpc    = defaultdict(lambda: defaultdict(lambda: defaultdict(make_b)))
    smn      = defaultdict(lambda: defaultdict(make_b))
    pmsku    = defaultdict(lambda: defaultdict(lambda: defaultdict(make_b)))
    gt       = {}
    pct_tree = {}

    for r in orders:
        month  = str(r.get("DATE",""))[:7]
        if not month: continue
        cls    = pif_classify(r)
        cncl   = get_cncl(r.get("CREDIT_STATUS",""))
        act    = get_active(cncl)
        sku    = r.get("SKU","") or "Unknown"
        pcat   = r.get("REFERRAL_PARTNER_CATEGORY","") or "Unknown"
        part   = r.get("REFERRAL_PARTNER","") or "Unknown"
        div    = get_division(r.get("UNIQUE_ORDER_ID",""))
        inv    = float(r.get("INV_TOTAL",0) or 0)

        for b in [monthly[month], sku_map[sku], pcat_map[pcat], part_map[part],
                  div_map[div], mdiv[div][month], pcm[pcat][month],
                  pm[part][month], smnpc[sku][pcat][month],
                  smn[sku][month], pmsku[part][sku][month]]:
            upd(b, cls, inv, act)

        # GT decomp tree
        k = cls
        gt.setdefault(k, {}).setdefault(act, {}).setdefault(div, {})
        gt[k][act][div][month] = gt[k][act][div].get(month, 0) + 1
        # PCT tree
        pct_tree.setdefault(pcat, {}).setdefault(k, {}).setdefault(act, {}).setdefault(div, {})
        pct_tree[pcat][k][act][div][month] = pct_tree[pcat][k][act][div].get(month, 0) + 1

    def ser(d): return {k: list(v) for k,v in d.items()}

    data = {
        "M":     ser(monthly),
        "S":     ser(sku_map),
        "PC":    ser(pcat_map),
        "P":     ser(part_map),
        "DIV":   ser(div_map),
        "MDIV":  {d: ser(mv) for d,mv in mdiv.items()},
        "PCM":   {p: ser(mv) for p,mv in pcm.items()},
        "PM":    {p: ser(mv) for p,mv in pm.items()},
        "SMNPC": {s: {p: ser(mv) for p,mv in pv.items()} for s,pv in smnpc.items()},
        "SMN":   {s: ser(mv) for s,mv in smn.items()},
        "PMSKU": {p: {s: ser(mv) for s,mv in sv.items()} for p,sv in pmsku.items()},
        "GT":    gt,
        "PCT":   pct_tree,
        "FL": {
            "skus":     sorted(set(r.get("SKU","") for r in orders if r.get("SKU"))),
            "partners": sorted(set(r.get("REFERRAL_PARTNER","") for r in orders if r.get("REFERRAL_PARTNER"))),
            "pcats":    sorted(set(r.get("REFERRAL_PARTNER_CATEGORY","") for r in orders if r.get("REFERRAL_PARTNER_CATEGORY"))),
            "divisions":["LS","B&L","L&R","HWB","Other"],
        },
    }

    total = sum(v[0] for v in monthly.values())
    pif   = sum(v[1] for v in monthly.values())
    late  = sum(v[3] for v in monthly.values())
    pp    = sum(v[2] for v in monthly.values())
    print(f"   → {total:,} total | PIF={pif:,} | PIF_Late={late:,} | PP={pp:,}")
    return data


# ─────────────────────────────────────────────
#  BUILD pif_rows.json  (PIF detail rows)
# ─────────────────────────────────────────────

def build_pif_rows(orders):
    print("⏳ Building pif_rows.json...")
    # Lookup arrays
    pcats_list   = sorted(set(r.get("REFERRAL_PARTNER_CATEGORY","") or "" for r in orders))
    parts_list   = sorted(set(r.get("REFERRAL_PARTNER","") or "" for r in orders))
    ems_list     = sorted(set(r.get("ENROLLMENT_MENTOR","") or "" for r in orders))
    skucats_list = sorted(set(r.get("SKU_CATEGORY","") or "" for r in orders))
    divs_list    = ["LS","B&L","L&R","HWB","Other"]
    cncls_list   = sorted(set(get_cncl(r.get("CREDIT_STATUS","")) for r in orders))

    def idx(lst, val):
        try: return lst.index(val or "")
        except: return 0

    cls_map = {"PIF":0, "PP":1, "PIF_LATE":2}
    rows_by_sku = defaultdict(list)

    for r in orders:
        cls    = pif_classify(r)
        cncl   = get_cncl(r.get("CREDIT_STATUS",""))
        act    = get_active(cncl)
        sku    = r.get("SKU","") or "Unknown"
        date   = str(r.get("DATE",""))[:10]
        month  = str(r.get("DATE",""))[:7]
        div    = get_division(r.get("UNIQUE_ORDER_ID",""))
        rdate  = r.get("REFUND_CREDIT_DATE","")
        days   = -1
        if date and rdate and str(rdate).strip():
            try:
                days = abs((datetime.strptime(str(rdate)[:10], "%Y-%m-%d") -
                            datetime.strptime(date, "%Y-%m-%d")).days)
            except: pass

        rows_by_sku[sku].append([
            r.get("UNIQUE_ORDER_ID",""),                              # 0 uid
            r.get("ID",""),                                           # 1 invoice id
            idx(skucats_list, r.get("SKU_CATEGORY","")),             # 2 cat_idx
            date,                                                     # 3 date
            month,                                                    # 4 month
            cls_map.get(cls, 1),                                     # 5 cls_idx
            days,                                                     # 6 days
            idx(pcats_list, r.get("REFERRAL_PARTNER_CATEGORY","")), # 7 pcat_idx
            idx(parts_list, r.get("REFERRAL_PARTNER","")),           # 8 part_idx
            idx(ems_list,   r.get("ENROLLMENT_MENTOR","")),          # 9 em_idx
            idx(divs_list,  div),                                    # 10 div_idx
            idx(cncls_list, cncl),                                   # 11 cncl_idx
            0 if act == "Active" else 1,                             # 12 act_idx
            r.get("CONTACTID",""),                                   # 13 contactid
            r.get("PRODUCTS","") or r.get("NORMALIZED_PRODUCT",""), # 14 product name
        ])

    total_rows = sum(len(v) for v in rows_by_sku.values())
    print(f"   → {total_rows:,} detail rows across {len(rows_by_sku)} SKUs")
    return {
        "rows":  dict(rows_by_sku),
        "pcats": pcats_list,
        "parts": parts_list,
        "ems":   ems_list,
        "cats":  skucats_list,
        "divs":  divs_list,
        "cncls": cncls_list,
    }


# ─────────────────────────────────────────────
#  BUILD ldp_data.json  (LDP Dashboard)
# ─────────────────────────────────────────────

def build_ldp_data(orders, payments_rows=None, payments_csv_path=None):
    print("⏳ Building ldp_data.json (LDP)...")

    # Load payments — keyed by UNIQUE_ORDER_ID (globally unique, avoids cross-account collision)
    # fetch_payments() now JOINs DIM_ALL_ORDERS and returns:
    #   "UID"     = UNIQUE_ORDER_ID (globally unique)
    #   "Id"      = raw INVOICEID   (kept for AR compat)
    #   "Deposit" = sum of payments where PAYDATE <= HEAVEN_DATE (the LDP down payment)
    #   "LAST_PAY_DATE", "PMT_COUNT" = for tracker
    uid_deps     = {}   # uid → (dep_0, dep_1, dep_2, dep_3)
    uid_pmt_meta = {}   # uid → {'last_d': date_obj, 'count': int}
    payments_found = False

    if payments_rows:
        payments_found = True
        for row in payments_rows:
            uid      = str(row.get('UID', '')).strip()
            d0       = clean_money(row.get('Deposit', 0))
            d1       = clean_money(row.get('dep_1', 0) or d0)
            d2       = clean_money(row.get('dep_2', 0) or d0)
            d3       = clean_money(row.get('dep_3', 0) or d0)
            last_str  = str(row.get('LAST_PAY_DATE', '')).strip()[:10]
            first_str = str(row.get('First_Date', '')).strip()[:10]
            last_d    = parse_date(last_str)  if last_str  and last_str  not in ('None', '') else None
            first_d   = parse_date(first_str) if first_str and first_str not in ('None', '') else None
            cnt       = int(row.get('PMT_COUNT', 1) or 1)
            is_pif    = int(row.get('IS_PIF', 0) or 0)
            if uid and d0 > 0:
                uid_deps[uid] = (d0, d1, d2, d3)
            if uid and last_d:
                uid_pmt_meta[uid] = {'last_d': last_d, 'count': cnt, 'first_d': first_d, 'is_pif': is_pif}
        print(f"   → Payments loaded from Snowflake: {len(uid_deps):,} orders with deposit")

    elif payments_csv_path and os.path.exists(payments_csv_path):
        # CSV fallback: no UID — use raw ID (cross-account collision risk, limited use)
        payments_found = True
        _csv_day = defaultdict(lambda: defaultdict(float))
        with open(payments_csv_path, encoding='utf-8-sig') as f:
            for row in csv.DictReader(f):
                oid  = row.get('Id','').strip()
                amt  = clean_money(row.get('Pay Amt',''))
                date = parse_date(row.get('Date',''))
                if oid and amt > 0 and date:
                    _csv_day[oid][date] += amt
        # CSV fallback: only day-0 available; dep_1/2/3 = same as dep_0
        for oid_c, day_map in _csv_day.items():
            fd  = min(day_map.keys())
            d0  = day_map[fd]
            uid_deps[oid_c] = (d0, d0, d0, d0)
        print(f"   → Payments loaded from CSV: {len(uid_deps):,} orders")
    else:
        print(f"   ⚠️  No payments data available — LDP will be empty")

    # 11-element bucket: [total, cncl, entry_err, upgrade, downgrade, active, inactive, lost_rev, switch, pend, no_pmt]
    def make_b(): return [0,0,0,0,0,0,0,0.0,0,0,0]
    def upd(b, cncl, active, lost):
        b[0] += 1
        if   cncl == "Cancelled":   b[1] += 1
        elif cncl == "Entry Error": b[2] += 1
        elif cncl == "Upgrade":     b[3] += 1
        elif cncl == "Downgrade":   b[4] += 1
        elif cncl == "Switch":      b[8] += 1
        elif cncl == "Pend":        b[9] += 1
        elif cncl == "No Pmt":      b[10]+= 1
        if active == "Active": b[5] += 1
        else:                  b[6] += 1
        b[7] += lost

    # Total-orders aggregates (same 11-elem format) for LDP% context in JS
    def make_tb(): return [0,0,0,0,0,0,0,0.0,0,0,0]
    def tupd(b, cncl_r, active_r):
        b[0] += 1
        if   cncl_r == "Cancelled":   b[1] += 1
        elif cncl_r == "Entry Error": b[2] += 1
        elif cncl_r == "Upgrade":     b[3] += 1
        elif cncl_r == "Downgrade":   b[4] += 1
        elif cncl_r == "Switch":      b[8] += 1
        elif cncl_r == "Pend":        b[9] += 1
        elif cncl_r == "No Pmt":      b[10]+= 1
        if active_r == "Active": b[5] += 1
        else:                    b[6] += 1

    TM   = defaultdict(make_tb)                                          # global by month
    TMS  = defaultdict(lambda: defaultdict(make_tb))                     # by sku x month
    TMP  = defaultdict(lambda: defaultdict(make_tb))                     # by pcat x month
    TMPS = defaultdict(lambda: defaultdict(lambda: defaultdict(make_tb)))# by pcat x sku x month
    TMV  = defaultdict(float)   # total invoice volume by month (all orders)
    TCLV = defaultdict(float)   # total cancelled lost-rev by month (all orders)

    for r_a in orders:
        inv_a   = float(r_a.get("INV_TOTAL",0) or 0)
        if inv_a <= 0: continue
        # Use HEAVEN_DATE (same as eff_date in order rows) so TM totals align with cohort/cancel
        _hd_a   = (r_a.get("HEAVEN_DATE","") or "")[:7]
        _dt_a   = str(r_a.get("DATE",""))[:7]
        month_a = _hd_a if _hd_a >= "2000" else _dt_a
        if not month_a: continue
        sku_a   = r_a.get("SKU","") or "Unknown"
        pcat_a  = r_a.get("REFERRAL_PARTNER_CATEGORY","") or "Unknown"
        cncl_a  = get_cncl(r_a.get("CREDIT_STATUS",""))
        act_a   = get_active(cncl_a)
        tupd(TM[month_a], cncl_a, act_a)
        tupd(TMS[sku_a][month_a], cncl_a, act_a)
        tupd(TMP[pcat_a][month_a], cncl_a, act_a)
        tupd(TMPS[pcat_a][sku_a][month_a], cncl_a, act_a)
        TMV[month_a] += inv_a
        if cncl_a == "Cancelled":
            paid_a    = float(r_a.get("PAYMENTS_TOTAL",0) or 0)
            refunds_a = float(r_a.get("REFUNDS",0) or 0)
            TCLV[month_a] += max(0.0, round(inv_a - paid_a + refunds_a, 2))

    by_month = defaultdict(make_b)
    by_sku   = defaultdict(make_b)
    by_pcat  = defaultdict(make_b)
    by_part  = defaultdict(make_b)
    all_skus=set(); all_parts=set(); all_pcats=set()
    rows_out = []

    from datetime import date as _date_cls
    _today = _date_cls.today()

    for r in orders:
        uid = r.get("UNIQUE_ORDER_ID","").strip()
        oid = r.get("ID","").strip()
        inv = float(r.get("INV_TOTAL",0) or 0)
        if inv <= 0: continue

        if not payments_found: continue
        # Deposit = 4-window tuple keyed by UNIQUE_ORDER_ID (globally unique).
        # Default to all-zero tuple when no payment records exist so the order still
        # appears in the tracker as FDP with $0 deposit.
        deps = uid_deps.get(uid) or (0.0, 0.0, 0.0, 0.0)
        # Pre-2026: 10.5% rule.  2026+: fixed DP from SKU pricing map (falls back to 10.5% if SKU unknown)
        _order_date = str(r.get("DATE","") or "")
        if _order_date >= "2026-01-01":
            _sku_b  = r.get("SKU","") or ""
            _pcat_b = r.get("REFERRAL_PARTNER_CATEGORY","") or ""
            _prod_b = r.get("PRODUCTS","") or r.get("NORMALIZED_PRODUCT","") or ""
            _thresh = get_ldp_threshold(_sku_b, _pcat_b, _prod_b, inv)
        else:
            _thresh = inv * 0.105
        # LDP: deposit must be positive AND strictly below the threshold.
        # dep_0 = 0 means no payment was made on/before the sale date → not LDP.
        is_ldp = 0 < deps[0] < _thresh

        fa   = deps[0]  # dep_0: payments on/before order date (see SQL)
        dep1 = deps[1]
        dep2 = deps[2]
        dep3 = deps[3]

        cncl     = get_cncl(r.get("CREDIT_STATUS",""))
        active   = get_active(cncl)
        paid     = float(r.get("PAYMENTS_TOTAL",0) or 0)
        refunds  = float(r.get("REFUNDS",0) or 0)
        lost     = max(0, round(inv - paid + refunds, 2)) if cncl == "Cancelled" else 0.0
        pmt_pct  = round(fa / inv * 100, 1)
        sku      = r.get("SKU","") or "Unknown"
        skucat   = r.get("SKU_CATEGORY","") or ""
        pcat     = r.get("REFERRAL_PARTNER_CATEGORY","") or "Unknown"
        part     = r.get("REFERRAL_PARTNER","") or "Unknown"
        em       = r.get("ENROLLMENT_MENTOR","") or ""
        inv_actual = round(float(r.get("ACTUAL_INV_SALE_TOTAL",0) or 0), 2)
        # Use HEAVEN_DATE for month grouping; keep original DATE for export
        orig_date  = str(r.get("DATE",""))[:10]
        heaven_str = (r.get("HEAVEN_DATE","") or "")[:10]
        eff_date   = heaven_str if heaven_str >= "2000" else orig_date
        date   = eff_date
        month  = eff_date[:7]
        rd     = get_rd(r.get("REFUND_CREDIT_DATE",""), r.get("DATE",""))

        _meta       = uid_pmt_meta.get(uid, {})

        all_skus.add(sku); all_parts.add(part); all_pcats.add(pcat)
        if is_ldp:
            upd(by_month[month], cncl, active, lost)
            upd(by_sku[sku],     cncl, active, lost)
            upd(by_pcat[pcat],   cncl, active, lost)
            upd(by_part[part],   cncl, active, lost)

        # ── Tracker fields ──────────────────────────────────────────────
        # Use PAYMENTS_TOTAL from order row (authoritative total).
        _total_paid = round(paid, 2)
        # For cancelled orders show net lost (inv - kept), not gross remaining balance
        if cncl == "Cancelled":
            _balance = lost  # = max(0, inv - paid + refunds) already computed above
        else:
            _balance = max(0.0, round(inv - _total_paid, 2))

        # Last payment date + count: from uid_pmt_meta (already loaded above for PIF check).
        _last_d     = _meta.get('last_d')
        _first_d    = _meta.get('first_d')
        _pmt_cnt    = _meta.get('count', 0)
        _last_pmt_s = _last_d.strftime("%Y-%m-%d") if _last_d else None
        _first_d_s  = _first_d.strftime("%Y-%m-%d") if _first_d else None
        _days_since = (_today - _last_d).days if _last_d else None
        _pay_count  = _pmt_cnt

        # Days overdue vs expected monthly schedule:
        # Expected next payment = last payment date + 30 days
        # Positive = days late; negative = days ahead of schedule
        if _last_d:
            from datetime import timedelta
            _expected_next = _last_d + timedelta(days=30)
            _days_overdue  = (_today - _expected_next).days
        else:
            _days_overdue = None

        _paid_full  = (_total_paid >= inv * 0.99) or _is_pif

        if _paid_full:
            _risk = "Paid in Full"
        elif cncl == "Cancelled":
            _risk = "Cancelled"
        elif cncl == "Downgrade":
            _risk = "Downgrade"
        elif cncl == "Upgrade":
            _risk = "Upgrade"
        elif cncl in ("Entry Error", "Pend", "Switch"):
            _risk = cncl
        elif active == "Active" and _days_since is not None and _days_since >= 60:
            _risk = "Overdue +30"  # 30+ days past the 30-day window (≥60d since last pmt)
        elif active == "Active" and _days_since is not None and _days_since >= 45:
            _risk = "Overdue +15"  # 15–29 days past the 30-day window (45–59d since last pmt)
        elif active == "Active" and _days_since is not None and _days_since > 30:
            _risk = "Overdue"      # 1–14 days past the 30-day window (31–44d since last pmt)
        elif active == "Active":
            _risk = "On Track"     # Last payment within 30 days — on schedule
        else:
            _risk = "Inactive"

        rows_out.append([
            r.get("UNIQUE_ORDER_ID",""), oid, r.get("CONTACTID",""),
            sku, skucat, month, date,        # [5]=month [6]=eff_date (HEAVEN_DATE or DATE)
            inv, fa, pmt_pct,
            cncl, active, rd,
            pcat, part, em, lost,
            _total_paid,   # [17]
            _pay_count,    # [18]
            _last_pmt_s,   # [19] last payment date string YYYY-MM-DD or null
            _days_since,   # [20] days since last payment (int) or null
            _risk,         # [21] risk level string
            _balance,      # [22] outstanding balance
            orig_date,     # [23] original purchase date (DATE) — for export
            inv_actual,    # [24] ACTUAL_INV_SALE_TOTAL (Net Invoice)
            dep1,          # [25] dep_1: deposit through +1 day
            dep2,          # [26] dep_2: deposit through +2 days
            dep3,          # [27] dep_3: deposit through +3 days
            _first_d_s,    # [28] first deposit date string YYYY-MM-DD or null
            _days_overdue, # [29] days overdue vs expected monthly schedule (int or null)
            r.get("FULL_NAME","") or "",                          # [30] client full name
            round(float(r.get("HEAVEN_QTY",1) or 1), 0),         # [31] heaven qty (units)
            round(float(r.get("HEAVEN_INVOICE_TOTAL",0) or 0), 2),# [32] heaven invoice total (volume)
            round(float(r.get("CREDITS",0) or 0), 2),            # [33] credits applied
            1 if is_ldp else 0,                                   # [34] 1=LDP, 0=FDP
        ])

    total   = sum(v[0] for v in by_month.values())
    ee      = sum(v[2] for v in by_month.values())
    cncl_c  = sum(v[1] for v in by_month.values())
    lost_t  = sum(v[7] for v in by_month.values())
    print(f"   → {total} LDP records | Cancelled={cncl_c} | Lost Rev=${lost_t:,.0f}")

    return {
        "M":   {k: list(v) for k,v in sorted(by_month.items())},
        "S":   {k: list(v) for k,v in by_sku.items()},
        "PC":  {k: list(v) for k,v in by_pcat.items()},
        "P":   {k: list(v) for k,v in by_part.items()},
        "TM":  {k: list(v) for k,v in sorted(TM.items())},
        "TMS":  {s: {m: list(v) for m,v in mv.items()} for s,mv in TMS.items()},
        "TMP":  {p: {m: list(v) for m,v in mv.items()} for p,mv in TMP.items()},
        "TMPS": {p: {s: {m: list(v) for m,v in mv.items()} for s,mv in sv.items()} for p,sv in TMPS.items()},
        "TMV":  {k: round(v,2) for k,v in sorted(TMV.items())},
        "TCLV": {k: round(v,2) for k,v in sorted(TCLV.items())},
        "FL":  {
            "skus":     sorted(s for s in all_skus  if s and s != "Unknown"),
            "partners": sorted(p for p in all_parts if p and p != "Unknown"),
            "pcats":    sorted(p for p in all_pcats if p and p != "Unknown"),
        },
        "rows": rows_out
    }


# ─────────────────────────────────────────────
#  FETCH ASANA TASKS via API
# ─────────────────────────────────────────────

def fetch_asana_tasks():
    print("⏳ Fetching Asana tasks from API...")
    secrets_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "secrets.json")
    if not os.path.exists(secrets_path):
        print("   ⚠️  secrets.json not found — skipping CRS (see README for setup)")
        return []
    with open(secrets_path) as f:
        secrets = json.load(f)
    token      = secrets["asana_token"]
    project_id = CONFIG["asana_project_id"]

    fields = ",".join([
        "gid", "name", "created_at", "completed_at", "modified_at",
        "assignee", "assignee.name", "assignee.email",
        "start_on", "due_on", "tags", "tags.name", "notes",
        "memberships.section.name",
        "dependencies", "dependents",
        "parent", "parent.name",
        "custom_fields",
    ])
    base_url = (
        f"https://app.asana.com/api/1.0/tasks"
        f"?project={project_id}&opt_fields={fields}&limit=100"
    )

    all_tasks = []
    url = base_url
    while url:
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        try:
            with urllib.request.urlopen(req) as resp:
                raw = b""
                while True:
                    chunk = resp.read(1 << 20)  # 1 MB chunks
                    if not chunk:
                        break
                    raw += chunk
            data = json.loads(raw)
        except MemoryError:
            print("   ⚠️  MemoryError reading Asana response — skipping remaining CRS pages")
            break
        except Exception as e:
            print(f"   ⚠️  Error reading Asana response: {e} — skipping remaining CRS pages")
            break
        all_tasks.extend(data["data"])
        nxt = data.get("next_page")
        url = (base_url + "&offset=" + nxt["offset"]) if nxt else None

    # Email field has an emoji in its name — match by gid to be safe
    EMAIL_GID = "1199715132261643"

    rows = []
    for t in all_tasks:
        cf = {}
        email_val = ""
        for field in t.get("custom_fields", []):
            name  = field.get("name", "")
            ftype = field.get("type", "")
            if field.get("gid") == EMAIL_GID:
                email_val = field.get("text_value") or ""
            if ftype == "enum":
                ev = field.get("enum_value") or {}
                cf[name] = ev.get("name", "") or ""
            elif ftype == "number":
                nv = field.get("number_value")
                if nv is not None:
                    cf[name] = str(int(nv)) if nv == int(nv) else str(nv)
                else:
                    cf[name] = ""
            elif ftype == "date":
                dv = field.get("date_value") or {}
                cf[name] = dv.get("date", "") or ""
            else:
                cf[name] = field.get("text_value") or ""

        assignee    = t.get("assignee") or {}
        memberships = t.get("memberships") or []
        section     = memberships[0]["section"]["name"] if memberships else ""
        parent      = t.get("parent") or {}
        deps        = t.get("dependencies") or []
        dependents  = t.get("dependents") or []

        rows.append({
            "Task ID":                          t.get("gid", ""),
            "Created At":                       t.get("created_at", "") or "",
            "Completed At":                     t.get("completed_at", "") or "",
            "Last Modified":                    t.get("modified_at", "") or "",
            "Name":                             t.get("name", "") or "",
            "Section/Column":                   section,
            "Assignee":                         assignee.get("name", "") or "",
            "Assignee Email":                   assignee.get("email", "") or "",
            "Start Date":                       t.get("start_on", "") or "",
            "Due Date":                         t.get("due_on", "") or "",
            "Tags":                             ", ".join(tag.get("name","") for tag in (t.get("tags") or [])),
            "Notes":                            t.get("notes", "") or "",
            "Parent task":                      parent.get("name", "") if parent else "",
            "Blocked By (Dependencies)":        ", ".join(d.get("gid","") for d in deps),
            "Blocking (Dependencies)":          ", ".join(d.get("gid","") for d in dependents),
            "Order ID":                         cf.get("Order ID", ""),
            "Invoice ID":                       cf.get("Invoice ID", ""),
            "Status":                           cf.get("Status", ""),
            "Request for Change in Programs":   cf.get("Request for Change in Programs", ""),
            "Program/Product":                  cf.get("Program/Product", ""),
            "INF Link":                         cf.get("INF Link", ""),
            "Reopened Case":                    cf.get("Reopened Case", ""),
            "Procedure":                        cf.get("Procedure", ""),
            "Requested Date mm/dd/yy":          cf.get("Requested Date mm/dd/yy", ""),
            "Program Usage":                    cf.get("Program Usage", ""),
            "Program End Date":                 cf.get("Program End Date", ""),
            "Date Sold":                        cf.get("Date Sold", ""),
            "Sold by":                          cf.get("Sold by", ""),
            "Email":                            email_val,
            "Contract Amount (after discounts)":cf.get("Contract Amount (after discounts)", ""),
            "Discount":                         cf.get("Discount", ""),
            "Contract Amt (pre disc)":          cf.get("Contract Amt (pre disc)", ""),
            "Amount Paid":                      cf.get("Amount Paid", ""),
            "Client ID":                        cf.get("Client ID", ""),
            "Phone":                            cf.get("Phone", ""),
            "PE Reason/Codes":                  cf.get("PE Reason/Codes", ""),
            "Admin Only":                       cf.get("Admin Only", ""),
            "Saved by":                         cf.get("Saved by", ""),
            "Total Revenue Saved":              cf.get("Total Revenue Saved", ""),
            "Future Balance with Comm":         cf.get("Future Balance with Comm", ""),
            "Future Rev start date":            cf.get("Future Rev start date", ""),
            "Future Rev Last due date":         cf.get("Future Rev Last due date", ""),
            "Revenue Loss":                     cf.get("Revenue Loss", ""),
            "Refund Amount":                    cf.get("Refund Amount", ""),
            "Past Due Date":                    cf.get("Past Due Date", ""),
        })

    print(f"   → {len(rows):,} Asana tasks fetched")
    return rows


# ─────────────────────────────────────────────
#  BUILD cr_data.json  (Client Resolution)
# ─────────────────────────────────────────────

def build_cr_data(orders, asana_rows):
    print("⏳ Building cr_data.json (Client Resolution)...")

    if not asana_rows:
        print("   ⚠️  No Asana tasks — skipping CRS")
        return None

    order_to_sku  = {r.get("ID","").strip(): r.get("SKU","").strip() for r in orders}
    order_to_inv  = {r.get("ID","").strip(): float(r.get("INV_TOTAL",0) or 0) for r in orders}
    order_to_pcat = {r.get("ID","").strip(): (r.get("REFERRAL_PARTNER_CATEGORY","") or "").strip() for r in orders}
    order_to_cid  = {r.get("ID","").strip(): str(r.get("CONTACTID","") or "").strip() for r in orders}

    THRESHOLD = 1000

    def utc_to_pacific_date(s):
        """Convert Asana UTC ISO timestamp to US Pacific date string (YYYY-MM-DD)."""
        if not s: return ""
        try:
            s = str(s).strip()
            if '.' in s and s.endswith('Z'):
                dt = datetime.strptime(s, "%Y-%m-%dT%H:%M:%S.%fZ")
            elif s.endswith('Z'):
                dt = datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ")
            else:
                dt = datetime.strptime(s[:19], "%Y-%m-%dT%H:%M:%S")
            # US Pacific: UTC-7 Apr–Oct (PDT), UTC-8 Nov–Mar (PST)
            offset = -7 if 4 <= dt.month <= 10 else -8
            dt_pacific = dt + timedelta(hours=offset)
            return dt_pacific.strftime("%Y-%m-%d")
        except:
            return s[:10] if len(s) >= 10 else s

    def parse_dt(s):
        if not s: return None
        s = str(s).strip()
        for fmt in ["%Y-%m-%dT%H:%M:%S.%fZ","%Y-%m-%dT%H:%M:%SZ","%Y-%m-%dT%H:%M:%S",
                    "%Y-%m-%d %H:%M:%S","%m/%d/%y","%m/%d/%Y","%Y-%m-%d"]:
            try: return datetime.strptime(s, fmt)
            except: pass
        try: return datetime.strptime(s[:10], "%Y-%m-%d")
        except: pass
        return None

    def clean_date(v):
        if not v: return ""
        v = str(v).strip()
        for fmt in ["%m/%d/%y","%m/%d/%Y","%Y-%m-%d","%Y-%m-%dT%H:%M:%S"]:
            try: return datetime.strptime(v[:10], fmt[:10]).strftime("%Y-%m-%d")
            except: pass
        return v[:10]

    excluded = 0
    enriched = []
    for r in asana_rows:
        oid_raw = str(r.get("Invoice ID","") or "").strip()
        # Handle Asana number-type fields that may return "622327.0" — normalize to "622327"
        try:
            oid = str(int(float(oid_raw))) if oid_raw else ""
        except:
            oid = oid_raw
        contract  = clean_money(r.get("Contract Amount (after discounts)",""))
        pre_disc  = clean_money(r.get("Contract Amt (pre disc)",""))
        inv_from_orders = order_to_inv.get(oid, 0)
        amt = contract if contract > 0 else (pre_disc if pre_disc > 0 else inv_from_orders)
        if amt > 0 and amt < THRESHOLD:
            excluded += 1
            continue

        sku  = order_to_sku.get(oid,"")
        pcat = order_to_pcat.get(oid,"")
        created   = parse_dt(r.get("Created At",""))
        completed = parse_dt(r.get("Completed At",""))
        procedure = (r.get("Procedure","") or "").strip()
        res_days  = None
        if procedure == "Complete" and created and completed:
            diff = (completed - created).days
            if 0 <= diff <= 365:
                res_days = diff

        # Days from original sale to CRS case being opened
        date_sold = parse_dt(r.get("Date Sold",""))
        days_to_cancel = (created - date_sold).days if created and date_sold else None

        created_at_eastern  = utc_to_pacific_date(r.get("Created At",""))
        completed_at_eastern = utc_to_pacific_date(r.get("Completed At",""))
        enriched.append({
            "id":             oid,
            "sku":            sku,
            "pcat":           pcat,
            "date":           clean_date(r.get("Date Sold","")),
            "month":          created_at_eastern[:7] if created_at_eastern else "",
            "status":         r.get("Status","") or "",
            "request_type":   r.get("Request for Change in Programs","") or "",
            "procedure":      procedure,
            "requested_date": clean_date(r.get("Requested Date mm/dd/yy","")),
            "saved_by":       r.get("Saved by","") or "",
            "admin_only":     r.get("Admin Only","") or "",
            "rev_loss":       clean_money(r.get("Revenue Loss","")),
            "rev_saved":      clean_money(r.get("Total Revenue Saved","")),
            "refund_amt":     clean_money(r.get("Refund Amount","")),
            "contract_amt":   amt,
            "assignee":       r.get("Assignee","") or "",
            "client_id":      r.get("Client ID","") or "",
            "client_name":    r.get("Name","") or "",
            "contact_id":     order_to_cid.get(oid,""),
            "res_days":       res_days,
            "days_to_cancel": days_to_cancel,
            "created_at":     created_at_eastern,
            "completed_at":   completed_at_eastern,
            "task_id":        r.get("Task ID","") or "",
            "inf_link":       r.get("INF Link","") or "",
        })

    # Include all cases with an Order ID — even if not yet in Snowflake (e.g. PAYMENTS_TOTAL=0)
    # Unmatched cases show with blank SKU/pcat but are not silently hidden
    matched = [e for e in enriched if e["id"]]

    # Aggregations
    from collections import Counter
    by_month  = defaultdict(lambda:{"total":0,"saved":0,"lost":0,"rev_saved":0.0,"rev_loss":0.0,"refund":0.0})
    by_req    = defaultdict(lambda:{"total":0,"saved":0,"rev_saved":0.0,"rev_loss":0.0})
    by_sku_cr = defaultdict(lambda:{"total":0,"saved":0,"rev_saved":0.0,"rev_loss":0.0})

    complete_with_res = [e for e in matched if e["procedure"]=="Complete" and e["res_days"] is not None]
    all_days = [e["res_days"] for e in complete_with_res]

    sku_days  = defaultdict(list)
    month_res = defaultdict(list)
    req_days  = defaultdict(list)

    for e in matched:
        m = e["month"]
        if not m: continue
        by_month[m]["total"] += 1
        if e["saved_by"]: by_month[m]["saved"] += 1
        else:             by_month[m]["lost"]  += 1
        by_month[m]["rev_saved"] += e["rev_saved"]
        by_month[m]["rev_loss"]  += e["rev_loss"]
        by_month[m]["refund"]    += e["refund_amt"]
        rt = e["request_type"] or "Unknown"
        by_req[rt]["total"] += 1
        if e["saved_by"]: by_req[rt]["saved"] += 1
        by_req[rt]["rev_saved"] += e["rev_saved"]
        by_req[rt]["rev_loss"]  += e["rev_loss"]
        s = e["sku"] or "Unknown"
        by_sku_cr[s]["total"] += 1
        if e["saved_by"]: by_sku_cr[s]["saved"] += 1
        by_sku_cr[s]["rev_saved"] += e["rev_saved"]
        by_sku_cr[s]["rev_loss"]  += e["rev_loss"]

    for e in complete_with_res:
        sku_days[e["sku"] or "Unknown"].append(e["res_days"])
        m = e["completed_at"][:7] if e["completed_at"] else ""
        if m: month_res[m].append(e["res_days"])
        req_days[e["request_type"] or "Unknown"].append(e["res_days"])

    def sku_res_stat(days):
        n=len(days); avg=round(sum(days)/n,1) if n else 0; w7=sum(1 for d in days if d<=7)
        return {"n":n,"avg":avg,"within7":w7,"pct7":round(w7/n*100,1) if n else 0,
                "dist":{"0":sum(1 for d in days if d==0),"1_3":sum(1 for d in days if 1<=d<=3),
                        "4_7":sum(1 for d in days if 4<=d<=7),"8_14":sum(1 for d in days if 8<=d<=14),
                        "15_30":sum(1 for d in days if 15<=d<=30),"31p":sum(1 for d in days if d>30)}}

    total_m = len(matched); saved = sum(1 for e in matched if e["saved_by"])
    print(f"   → {total_m} matched | Excluded={excluded} | Save rate={saved/total_m*100:.1f}%" if total_m else "   → 0 matched")

    return {
        "totals": {"matched":total_m,"saved":saved,
                   "save_rate":round(saved/total_m*100,1) if total_m else 0,
                   "rev_saved":round(sum(e["rev_saved"] for e in matched),2),
                   "rev_loss": round(sum(e["rev_loss"]  for e in matched),2),
                   "refund":   round(sum(e["refund_amt"]for e in matched),2),
                   "excluded_under_1k":excluded},
        "resolution": {
            "overall": {"n":len(all_days),
                        "avg":round(sum(all_days)/len(all_days),1) if all_days else 0,
                        "within7":sum(1 for d in all_days if d<=7),
                        "pct7":round(sum(1 for d in all_days if d<=7)/len(all_days)*100,1) if all_days else 0,
                        "median":sorted(all_days)[len(all_days)//2] if all_days else 0,
                        "dist":{"0":sum(1 for d in all_days if d==0),
                                "1_3":sum(1 for d in all_days if 1<=d<=3),
                                "4_7":sum(1 for d in all_days if 4<=d<=7),
                                "8_14":sum(1 for d in all_days if 8<=d<=14),
                                "15_30":sum(1 for d in all_days if 15<=d<=30),
                                "31p":sum(1 for d in all_days if d>30)}},
            "by_sku":   {s:sku_res_stat(v) for s,v in sku_days.items() if len(v)>=2},
            "by_req":   {rt:sku_res_stat(v) for rt,v in req_days.items() if len(v)>=2},
            "by_month": {m:{"n":len(v),"avg":round(sum(v)/len(v),1),
                            "within7":sum(1 for d in v if d<=7)} for m,v in month_res.items() if v},
        },
        "M":   {k:dict(v) for k,v in sorted(by_month.items())},
        "REQ": {k:dict(v) for k,v in sorted(by_req.items(), key=lambda x:-x[1]["total"])},
        "ST":  dict(Counter(e["status"] or "Unknown" for e in matched).most_common()),
        "SB":  dict(Counter(e["saved_by"] or "Not Saved" for e in matched).most_common()),
        "SKU": {k:dict(v) for k,v in sorted(by_sku_cr.items(), key=lambda x:-x[1]["total"])},
        "rows": matched,
        "FL": {
            "statuses":   sorted(set(e["status"]       for e in matched if e["status"])),
            "req_types":  sorted(set(e["request_type"] for e in matched if e["request_type"])),
            "assignees":  sorted(set(e["assignee"]     for e in matched if e["assignee"])),
            "skus":       sorted(set(e["sku"]          for e in matched if e["sku"])),
            "pcats":      sorted(set(e["pcat"]         for e in matched if e["pcat"])),
            "procedures": sorted(set(e["procedure"]    for e in matched if e["procedure"])),
        }
    }


# ─────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────

def save_json(data, filename):
    path = os.path.join(CONFIG["output_dir"], filename)
    with open(path, "w") as f:
        json.dump(data, f, separators=(',',':'))
    size_kb = os.path.getsize(path) // 1024
    print(f"   💾 {filename} saved ({size_kb} KB)")


# ─────────────────────────────────────────────
#  BUILD ar_data.json  (AR / Arrears Dashboard)
# ─────────────────────────────────────────────

def build_ar_data(orders, payments_rows=None, cancel_qfy=None, cancel_data=None, order_payments_prebuilt=None):
    print("⏳ Building ar_data.json (Arrears)...")
    from datetime import date as _date
    today = _date.today()

    # Build last payment date + count per order from aggregated payment rows
    # Each row is already ONE-per-order with LAST_PAY_DATE and PMT_COUNT pre-computed
    order_payments = order_payments_prebuilt or {}   # oid → (last_dt, pmt_count)
    if payments_rows and not order_payments_prebuilt:
        for p in payments_rows:
            oid       = str(p.get("Id", p.get("INVOICEID",""))).strip()
            last_str  = str(p.get("LAST_PAY_DATE",""))[:10]
            pmt_count = int(p.get("PMT_COUNT", 1) or 1)
            last_dt   = parse_date(last_str)
            if oid and last_dt:
                order_payments[oid] = (last_dt, pmt_count)

    def get_bucket(days):
        if days <= 30:    return "0-30d"
        elif days <= 60:  return "31-60d"
        elif days <= 90:  return "61-90d"
        elif days <= 180: return "91-180d"
        else:             return "180d+"

    ar_rows = []
    for r in orders:
        inv  = float(r.get("INV_TOTAL",0) or 0)
        paid = float(r.get("PAYMENTS_TOTAL",0) or 0)
        bal  = round(inv - paid, 2)
        if inv <= 0: continue

        pmt_status = r.get("PMT_STATUS","")
        cs     = r.get("CREDIT_STATUS","") or ""
        cncl   = get_cncl(cs)
        if cncl == "Entry Error": continue  # exclude entry errors
        status = "Cancelled" if cncl == "Cancelled" else "Active"

        # Include: partial payment with balance OR cancelled with balance
        if pmt_status == "Full Payment" and bal <= 0: continue
        if bal <= 0 and status != "Cancelled": continue

        oid  = str(r.get("ID","")).strip()
        pmts      = order_payments.get(oid)
        last_dt   = pmts[0] if pmts else None
        pmt_count = pmts[1] if pmts else 0

        if status == "Cancelled":
            bucket     = "Cancelled"
            days_since = (today - last_dt).days if last_dt else 999
        elif last_dt:
            days_since = (today - last_dt).days
            bucket     = get_bucket(days_since)
        else:
            try:
                purchase   = datetime.strptime(str(r.get("DATE",""))[:10], "%Y-%m-%d").date()
                days_since = (today - purchase).days
            except:
                days_since = 999
            bucket = get_bucket(days_since)

        ar_rows.append({
            "oid":      oid,
            "uid":      r.get("UNIQUE_ORDER_ID",""),
            "cid":      r.get("CONTACTID",""),
            "sku":      r.get("SKU","") or "Unknown",
            "sku_cat":  r.get("SKU_CATEGORY","") or "",
            "date":     str(r.get("DATE",""))[:10],
            "month":    str(r.get("DATE",""))[:7],
            "pcat":     r.get("REFERRAL_PARTNER_CATEGORY","") or "",
            "partner":  r.get("REFERRAL_PARTNER","") or "",
            "em":       r.get("ENROLLMENT_MENTOR","") or "",
            "inv":      inv, "paid": paid, "bal": bal,
            "pmt_status": pmt_status, "status": status, "cs": cs,
            "last_pmt":   str(last_dt) if last_dt else "",
            "days_since": days_since,
            "pmt_count":  pmt_count,
            "bucket":     bucket,
            "collected_pct": round(paid/inv*100, 1) if inv > 0 else 0,
        })

    def agg(rows):
        return {"count": len(rows),
                "bal":   round(sum(x["bal"]  for x in rows), 2),
                "inv":   round(sum(x["inv"]  for x in rows), 2),
                "paid":  round(sum(x["paid"] for x in rows), 2)}

    buckets_agg, by_sku, by_month, by_pcat = {}, {}, {}, {}
    for b in ["0-30d","31-60d","61-90d","91-180d","180d+","Cancelled"]:
        buckets_agg[b] = agg([x for x in ar_rows if x["bucket"]==b])
    for sku in sorted(set(x["sku"] for x in ar_rows)):
        by_sku[sku] = agg([x for x in ar_rows if x["sku"]==sku])
    for x in ar_rows:
        m = x["month"]
        if m not in by_month: by_month[m] = {"count":0,"bal":0.0,"inv":0.0,"paid":0.0}
        by_month[m]["count"]+=1; by_month[m]["bal"]+=x["bal"]
        by_month[m]["inv"]+=x["inv"]; by_month[m]["paid"]+=x["paid"]
    for x in ar_rows:
        pc = x["pcat"] or "Unknown"
        if pc not in by_pcat: by_pcat[pc] = {"count":0,"bal":0.0,"inv":0.0,"paid":0.0}
        by_pcat[pc]["count"]+=1; by_pcat[pc]["bal"]+=x["bal"]
        by_pcat[pc]["inv"]+=x["inv"]; by_pcat[pc]["paid"]+=x["paid"]

    total_bal  = round(sum(x["bal"]  for x in ar_rows), 2)
    total_inv  = round(sum(x["inv"]  for x in ar_rows), 2)
    total_paid = round(sum(x["paid"] for x in ar_rows), 2)

    # ── AR Overdue Trend (weekly snapshots) ──────────────────────────────────
    ar_trend = []; trend_by_pcat = {}
    if order_payments:
        pool = []
        for r in orders:
            inv_r = float(r.get("INV_TOTAL",0) or 0)
            if inv_r <= 0: continue
            if get_cncl(r.get("CREDIT_STATUS","")) == "Entry Error": continue
            oid_r = str(r.get("ID","")).strip()
            pd_r  = parse_date(str(r.get("DATE",""))[:10])
            if pd_r: pool.append((oid_r, inv_r, pd_r))

        # Build per-order step lookup: paid = PAYMENTS_TOTAL once last_pay_date is reached
        oid_to_total_paid = {str(r.get("ID","")).strip(): float(r.get("PAYMENTS_TOTAL",0) or 0) for r in orders}
        order_pay_snap = {}  # oid → (last_pay_date, total_paid)
        for oid_r, _, _ in pool:
            pmt_info = order_payments.get(oid_r)
            last_p   = pmt_info[0] if pmt_info else None
            total_p  = oid_to_total_paid.get(oid_r, 0.0)
            order_pay_snap[oid_r] = (last_p, total_p)

        snap_start = max(min((p[2] for p in pool), default=_date(2022,1,1)), _date(2022,1,1)) if pool else _date(2022,1,1)
        # Align to first Friday on or after snap_start
        _dow = snap_start.weekday()
        snap = snap_start + timedelta(days=(4 - _dow) % 7)
        while snap <= today:
            t_bal = 0.0; ov_bal = 0.0
            for oid_r, inv_r, pd_r in pool:
                if pd_r > snap: continue
                last_p, total_p = order_pay_snap.get(oid_r, (None, 0.0))
                # Step function: full payment credited on last_pay_date
                paid_r = total_p if (last_p and last_p <= snap) else 0.0
                bal_r  = inv_r - paid_r
                if bal_r <= 1.0: continue
                t_bal += bal_r
                days_r = (snap - last_p).days if last_p and last_p <= snap else (snap - pd_r).days
                if days_r > 30: ov_bal += bal_r
            ar_trend.append([str(snap), round(ov_bal/t_bal*100,2) if t_bal>0 else 0, 0, round(t_bal,2), round(ov_bal,2)])
            snap += timedelta(days=7)
        # 13-week rolling average (index 2; indices 3/4 = t_bal/ov_bal for ar2_trend)
        win = 13
        for i in range(len(ar_trend)):
            si = max(0, i-win+1)
            ar_trend[i][2] = round(sum(ar_trend[j][1] for j in range(si,i+1))/(i-si+1),2)
        print(f"   → {len(ar_trend)} AR global trend snapshots")

        # Per-pcat trend (4 pcats — manageable)
        pcat_pools = defaultdict(list)
        for oid_r, inv_r, pd_r, pc_r in [(o, i, p, r.get("REFERRAL_PARTNER_CATEGORY","") or "Unknown")
                                          for r, (o, i, p) in zip(orders, pool)
                                          if r.get("ID","").strip() == o]:
            pcat_pools[pc_r].append((oid_r, inv_r, pd_r))

    # Build per-pcat pools properly
    oid_to_pcat = {str(r.get("ID","")).strip(): r.get("REFERRAL_PARTNER_CATEGORY","") or "Unknown" for r in orders}
    pcat_pools = defaultdict(list)
    for oid_r, inv_r, pd_r in pool:
        pcat_pools[oid_to_pcat.get(oid_r, "Unknown")].append((oid_r, inv_r, pd_r))

    trend_by_pcat = {}
    if order_payments and pool:
        for pc, pc_pool in pcat_pools.items():
            pc_trend = []
            snap = snap_start
            while snap <= today:
                t_bal = 0.0; ov_bal = 0.0
                for oid_r, inv_r, pd_r in pc_pool:
                    if pd_r > snap: continue
                    last_p, total_p = order_pay_snap.get(oid_r, (None, 0.0))
                    paid_r = total_p if (last_p and last_p <= snap) else 0.0
                    bal_r  = inv_r - paid_r
                    if bal_r <= 1.0: continue
                    t_bal += bal_r
                    days_r = (snap - last_p).days if last_p and last_p <= snap else (snap - pd_r).days
                    if days_r > 30: ov_bal += bal_r
                pc_trend.append([str(snap), round(ov_bal/t_bal*100,2) if t_bal>0 else 0])
                snap += timedelta(days=7)
            for i in range(len(pc_trend)):
                si = max(0, i-win+1)
                pc_trend[i].append(round(sum(pc_trend[j][1] for j in range(si,i+1))/(i-si+1),2))
            trend_by_pcat[pc] = pc_trend
        print(f"   → Per-pcat trends: {list(trend_by_pcat.keys())}")

    print(f"   → {len(ar_rows):,} AR records | Balance=${total_bal:,.0f} | Collected ${total_paid:,.0f}")
    return {
        "summary": {
            "total_orders":     len(ar_rows),
            "total_inv":        total_inv,
            "total_paid":       total_paid,
            "total_bal":        total_bal,
            "active_pp":        sum(1 for x in ar_rows if x["status"]=="Active"),
            "cancelled_pp":     sum(1 for x in ar_rows if x["status"]=="Cancelled"),
            "as_of":            str(today),
        },
        "buckets":  buckets_agg,
        "by_sku":   dict(sorted(by_sku.items(),   key=lambda x:-x[1]["bal"])),
        "by_month": dict(sorted(by_month.items())),
        "by_pcat":  by_pcat,
        "rows":     ar_rows,
        "trend":         ar_trend,
        "trend_by_pcat": trend_by_pcat,
        "QFY":      cancel_qfy or {},
        "GMSKU":    (cancel_data or {}).get("GMSKU", {}),
        "PCM":      (cancel_data or {}).get("PCM", {}),
        "PCMSKU":   (cancel_data or {}).get("PCMSKU", {}),
        "filters": {
            "skus":     sorted(s for s in set(x["sku"]  for x in ar_rows) if s != "Unknown"),
            "pcats":    sorted(set(x["pcat"] for x in ar_rows if x["pcat"])),
            "statuses": ["Active","Cancelled"],
            "buckets":  ["0-30d","31-60d","61-90d","91-180d","180d+","Cancelled"],
        }
    }

def fetch_ar_invoices(conn):
    """Pull AR invoice data from ANALYTICS.MART.DIM_AR_ALL_INVOICES."""
    print("⏳ Fetching AR invoices from DIM_AR_ALL_INVOICES...")
    sql = """
        SELECT
            ar."KEY"                         AS ar_key,
            ar."ID"                          AS ar_id,
            ar."ORDERID"                     AS order_id,
            ar."CONTACTID"                   AS contact_id,
            ar."EMAIL"                       AS email,
            ar."NAME"                        AS client_name,
            ar."DATE"                        AS ar_date,
            ar."PRODUCTNAME"                 AS product_name,
            COALESCE(o.SKU, '')              AS sku_code,
            COALESCE(o.CREDIT_STATUS, '')   AS order_credit_status,
            ar."DIVISION"                    AS division,
            ar."REFERRALPARTNERCATEGORY"     AS pcat,
            ar."REFERRALPARTNER"             AS partner,
            ar."JOBTITLE"                    AS job_title,
            ar."INV"                         AS inv,
            ar."PAYMENT"                     AS payment,
            ar."CREDIT"                      AS credit,
            ar."REFUND"                      AS refund,
            ar."BALANCE"                     AS balance,
            ar."0-30"                        AS b0_30,
            ar."31-60"                       AS b31_60,
            ar."61-90"                       AS b61_90,
            ar."90+"                         AS b90p,
            ar."total arrears"               AS total_arrears,
            ar."current"                     AS current_bal,
            ar."DAYSDELAY"                   AS days_delay,
            ar."LASTPAYMENTDATE"             AS last_pmt_date,
            ar."LASTPAYMENTTYPE"             AS last_pmt_type,
            ar."LASTPAYMENTAMOUNT"           AS last_pmt_amt,
            ar."LAST_SCHEDULED_PAYMENT_DATE" AS last_sched_pmt,
            ar."PASTDUEISSUE"                AS past_due_issue,
            ar."CLIENT_RESOLUTION_STATUS"    AS crs_status,
            ar."1STATTEMPT"                  AS att1,
            ar."1STATTEMPTDATE"              AS att1_date,
            ar."2NDATTEMPT"                  AS att2,
            ar."2NDATTEMPTDATE"              AS att2_date,
            ar."3RDATTEMPT"                  AS att3,
            ar."3RDATTEMPTDATE"              AS att3_date
        FROM ANALYTICS.MART.DIM_AR_ALL_INVOICES ar
        LEFT JOIN ANALYTICS.MART.DIM_ALL_ORDERS o ON ar."ORDERID" = o.ID
        WHERE ar."BALANCE" > 0
          AND LOWER(COALESCE(ar."NAME", '')) NOT LIKE '%test%'
          AND COALESCE(ar."LASTPAYMENTAMOUNT", 0) > 0
        ORDER BY ar."BALANCE" DESC NULLS LAST
    """
    cur = conn.cursor()
    cur.execute(sql)
    cols = [c[0].lower() for c in cur.description]
    rows = [dict(zip(cols, row)) for row in cur.fetchall()]
    for r in rows:
        for k, v in r.items():
            if hasattr(v, 'strftime'):
                r[k] = v.strftime('%Y-%m-%d')
            elif v is None:
                r[k] = ''
            else:
                r[k] = str(v)
    print(f"   → {len(rows):,} AR invoice records fetched")
    return rows


def load_ar_trend_history():
    """Load AR overdue weekly history.
    First run: seeds from 'AR Overdue Historic Week Data.xlsx'.
    Subsequent runs: loads from ar2_trend.json (persisted append log).
    Returns list of dicts: {d, tb, ob, pct, avg52, q, y}
    where pct and avg52 are 0-100 scale (not decimal).
    """
    import openpyxl
    json_path = os.path.join(CONFIG["output_dir"], "ar2_trend.json")
    xl_path   = os.path.join(CONFIG["output_dir"], "AR Overdue Historic Week Data.xlsx")

    # Prefer the persisted JSON log if it exists
    if os.path.exists(json_path):
        with open(json_path, "r") as f:
            history = json.load(f)
        print(f"   → Loaded {len(history)} weeks from ar2_trend.json")
        return history

    # First run — seed from Excel
    if not os.path.exists(xl_path):
        print("   ⚠️  AR Overdue Historic Week Data.xlsx not found — trend_v2 will be empty")
        return []

    wb = openpyxl.load_workbook(xl_path, read_only=True, data_only=True)
    ws = wb.active
    history = []
    first_row = True
    for row in ws.iter_rows(values_only=True):
        if first_row:
            first_row = False
            continue
        if not row[0]:
            continue
        # Col 0: Date, 1: Total AR Balance, 7: Overdue Balance,
        # 8: % Of AR Overdue (decimal), 9: 52wk avg (decimal),
        # 10: Quarter, 11: Year
        date_val = row[0]
        if hasattr(date_val, 'strftime'):
            date_str = date_val.strftime('%Y-%m-%d')
        else:
            date_str = str(date_val)[:10]
        try:
            tb  = round(float(row[1] or 0), 2)
        except:
            tb  = 0.0
        try:
            ob  = round(float(row[7] or 0), 2)
        except:
            ob  = 0.0
        pct_raw = row[8]
        pct = round(float(pct_raw) * 100, 2) if pct_raw is not None else None
        if pct is None:
            continue
        # avg52 will be recomputed in append step; store None for now
        q = str(row[10] or "")
        try:
            y = int(row[11] or 0)
        except:
            y = 0
        history.append({"d": date_str, "tb": tb, "ob": ob, "pct": pct,
                         "avg52": None, "q": q, "y": y})
    wb.close()
    print(f"   → Seeded {len(history)} weeks from Excel (AR Overdue Historic Week Data.xlsx)")
    return history


def backfill_excel_computed_fields(history):
    """Overwrite chg, avg52, sold_avg52, cncl_avg52 with the Excel's pre-calculated values.
    The Excel uses a slightly different window than our rolling avg, so we treat it as source of truth.
    """
    import math, pandas as pd
    excel_path = os.path.join(CONFIG["output_dir"], "AR Overdue Historic Week Data.xlsx")
    if not os.path.exists(excel_path):
        excel_path = os.path.join(os.path.dirname(__file__), "AR Overdue Historic Week Data.xlsx")
    if not os.path.exists(excel_path):
        print("   → Excel file not found, skipping computed-field backfill")
        return history
    try:
        df = pd.read_excel(excel_path)
        df["_date"] = pd.to_datetime(df["Date"]).dt.strftime("%Y-%m-%d")
        xl_map = {}
        for _, row in df.iterrows():
            d = row["_date"]
            def safe(v):
                try:
                    f = float(v)
                    return None if math.isnan(f) else f
                except: return None
            xl_map[d] = {
                "chg":       safe(row.get("Overdue\nBalance Change")),
                "avg52":     safe(row.get("AR Overdue\n52 week Running Average")),
                "sold_avg52":safe(row.get("Orders Sold 52 wk Running\nAverage")),
                "cncl_avg52":safe(row.get("Cancellations 52 wk Running\nAverage")),
            }
        updated = 0
        for r in history:
            xl = xl_map.get(r["d"])
            if not xl: continue
            if xl["chg"]       is not None: r["chg"]       = round(xl["chg"], 2);       updated += 1
            if xl["avg52"]     is not None: r["avg52"]     = round(xl["avg52"] * 100, 2); updated += 1
            if xl["sold_avg52"]is not None: r["sold_avg52"]= round(xl["sold_avg52"], 2);  updated += 1
            if xl["cncl_avg52"]is not None: r["cncl_avg52"]= round(xl["cncl_avg52"], 2);  updated += 1
        print(f"   → Excel computed-field backfill: {updated} values applied across {len(xl_map)} Excel rows")
    except Exception as e:
        print(f"   ⚠ Excel computed-field backfill failed: {e}")
    return history


def append_weekly_ar_trend(history, ar_invoices, weekly_flows=None):
    """Append this week's snapshot to the AR overdue trend history.
    Weeks run Saturday→Friday; Friday is the week-end label date.
    Computes overdue % from DIM_AR_ALL_INVOICES arrears snapshot.
    Recalculates 52-week rolling average and overdue change across all rows.
    Saves the updated history to ar2_trend.json for future runs.
    """
    from datetime import date as _date
    today      = _date.today()
    # Snap to most recent Friday (weekday 4)
    days_since_friday = (today.weekday() - 4) % 7
    week_friday = today - timedelta(days=days_since_friday)
    week_str    = week_friday.strftime('%Y-%m-%d')

    # Compute quarter & 2-digit year
    mo = week_friday.month
    q_label = "Q" + str((mo - 1) // 3 + 1)
    y_label = week_friday.year % 100

    existing_dates = {row["d"] for row in history}
    # Only lock a week once it's fully closed (Saturday or later = day after Friday close)
    week_is_closed = today > week_friday
    if week_str not in existing_dates and week_is_closed:
        # Compute overdue % from Snowflake snapshot
        total_bal = 0.0
        total_arr = 0.0
        for r in ar_invoices:
            try: bal = float(str(r.get("balance","") or 0))
            except: bal = 0.0
            try: arr = float(str(r.get("total_arrears","") or 0))
            except: arr = 0.0
            if bal > 0:
                total_bal += bal
                total_arr += max(0.0, arr)
        pct_overdue = round(total_arr / total_bal * 100, 2) if total_bal > 0 else 0.0
        flow = (weekly_flows or {}).get(week_str, {})
        history.append({
            "d": week_str, "tb": round(total_bal, 2), "ob": round(total_arr, 2),
            "pct": pct_overdue, "avg52": None, "q": q_label, "y": y_label,
            "sold": flow.get("sold"), "pmts": flow.get("pmts"),
            "disc": flow.get("disc"), "cncl": flow.get("cncl"), "chg": None,
        })
        print(f"   → AR trend v2: appended week {week_str} — {pct_overdue:.2f}% overdue (${total_bal:,.0f} total bal)")
    elif not week_is_closed:
        print(f"   → AR trend v2: week {week_str} still in progress (closes Saturday), skipping lock")
    else:
        print(f"   → AR trend v2: week {week_str} already in history, skipping")

    # Sort by date
    history.sort(key=lambda x: x["d"])

    # Overwrite pmts/disc/sold/cncl from Snowflake — always replace, not just when null
    # (a prior bad run may have written wrong values; Snowflake is source of truth)
    if weekly_flows:
        overwritten = 0
        for row in history:
            flow = weekly_flows.get(row["d"], {})
            for field in ("sold", "pmts", "disc", "cncl"):
                if flow.get(field) is not None:
                    row[field] = flow[field]
                    overwritten += 1
        if overwritten:
            print(f"   → AR trend v2: wrote {overwritten} flow values from Snowflake into historical rows")

    # Recompute 52-week rolling averages and overdue change for every row
    win = 52
    for i, row in enumerate(history):
        si  = max(0, i - win + 1)
        avg = round(sum(history[j]["pct"] for j in range(si, i + 1)) / (i - si + 1), 2)
        history[i]["avg52"] = avg
        if i > 0:
            prev_ob = history[i-1].get("ob") or 0.0
            history[i]["chg"] = round((history[i].get("ob") or 0.0) - prev_ob, 2)
        else:
            history[i]["chg"] = None
        # 52-week rolling averages for sold and cncl (dollar amounts)
        sold_vals = [history[j]["sold"] for j in range(si, i + 1) if history[j].get("sold") is not None]
        cncl_vals = [history[j]["cncl"] for j in range(si, i + 1) if history[j].get("cncl") is not None]
        history[i]["sold_avg52"] = round(sum(sold_vals) / len(sold_vals), 2) if sold_vals else None
        history[i]["cncl_avg52"] = round(sum(cncl_vals) / len(cncl_vals), 2) if cncl_vals else None

    # Overwrite computed fields with Excel's pre-calculated values for matching dates
    history = backfill_excel_computed_fields(history)

    # Persist to ar2_trend.json
    json_path = os.path.join(CONFIG["output_dir"], "ar2_trend.json")
    with open(json_path, "w") as f:
        json.dump(history, f, separators=(',', ':'))
    size_kb = os.path.getsize(json_path) // 1024
    print(f"   💾 ar2_trend.json saved ({size_kb} KB, {len(history)} weeks)")
    return history


def fetch_weekly_ar_flows(conn):
    """Fetch weekly AR flow data: payments received, discounts/adjustments,
    orders sold, and cancellations — all snapped to the Friday that ends each week.
    Returns dict keyed by Friday date string: {date_str: {pmts, disc, sold, cncl}}
    """
    print("⏳ Fetching weekly AR flow data from Snowflake...")
    from datetime import datetime as _dt, timedelta as _td
    valid_types = "'Credit Card','Credit Card (Manual)','Credit Card (MANUAL)','ACH','ACH Bank','PayPal','PayPal Payment','Paypal','Wire','Wire Transfer','Check','Cash'"
    start = CONFIG["start_date"]

    def _flow_val(v):
        if v is None or v == '': return None
        return round(float(v), 2)

    def _snap_to_friday(date_str):
        """Snap a YYYY-MM-DD string to its week-ending Friday using Python (no Snowflake DAYOFWEEK)."""
        d = _dt.strptime(date_str[:10], "%Y-%m-%d").date()
        days_to_fri = (4 - d.weekday()) % 7   # Python: Mon=0 Fri=4
        return (d + _td(days=days_to_fri)).strftime("%Y-%m-%d")

    def run_daily_query(sql, val_col):
        """Run a query that returns (pay_date, amount), snap dates to Friday in Python."""
        c = conn.cursor()
        c.execute(sql)
        result = {}
        for r in sf_fetch_rows(c):
            ds = r.get("PAY_DATE") or r.get("pay_date") or ""
            if not ds or ds == "": continue
            wf = _snap_to_friday(ds)
            amt = _flow_val(r.get(val_col) or r.get(val_col.lower()))
            if amt is not None:
                result[wf] = result.get(wf, 0.0) + amt
        return result

    # sold and cncl: keyed by order/refund DATE (already DATE type, snap in Python)
    sold_map = run_daily_query(f"""
        SELECT DATE AS pay_date, SUM(INV_TOTAL) AS amt
        FROM ANALYTICS.MART.DIM_ALL_ORDERS
        WHERE DATE >= '{start}' AND SKU IS NOT NULL AND SKU != ''
          AND INV_TOTAL > 0
          AND NOT (LOWER(COALESCE(CREDIT_STATUS,'')) LIKE '%entry error%'
                OR LOWER(COALESCE(CREDIT_STATUS,'')) LIKE '%error%')
        GROUP BY 1
    """, "AMT")

    cncl_map = run_daily_query(f"""
        SELECT REFUND_CREDIT_DATE AS pay_date, SUM(INV_TOTAL) AS amt
        FROM ANALYTICS.MART.DIM_ALL_ORDERS
        WHERE DATE >= '{start}' AND SKU IS NOT NULL AND SKU != ''
          AND REFUND_CREDIT_DATE IS NOT NULL
          AND (LOWER(COALESCE(CREDIT_STATUS,'')) LIKE '%cncl%'
            OR LOWER(COALESCE(CREDIT_STATUS,'')) LIKE '%lrev%')
        GROUP BY 1
    """, "AMT")

    # pmts/disc: use TO_CHAR to get date string — avoids DAYOFWEEK/timezone issues
    pmts_map = run_daily_query(f"""
        SELECT TO_CHAR(TO_DATE(p.PAYDATE), 'YYYY-MM-DD') AS pay_date,
               SUM(p.PAYAMT) AS amt
        FROM ANALYTICS.MART.stg_inf_payments_combined p
        JOIN ANALYTICS.MART.DIM_ALL_ORDERS o ON p.INVOICEID = o.ID
          AND p.PAYDATE >= DATEADD(day, -30, o.DATE)
        WHERE p.PAYAMT > 0
          AND (p._CHECK_IF_DELETED = 0 OR p._CHECK_IF_DELETED IS NULL)
          AND o.SKU IS NOT NULL AND o.SKU != ''
          AND p.PAYDATE >= '{start}'
          AND p.PAYDATE <= CURRENT_DATE()
          AND p.PAYTYPE IN ({valid_types})
        GROUP BY 1
    """, "AMT")

    disc_map = run_daily_query(f"""
        SELECT TO_CHAR(TO_DATE(p.PAYDATE), 'YYYY-MM-DD') AS pay_date,
               SUM(p.PAYAMT) AS amt
        FROM ANALYTICS.MART.stg_inf_payments_combined p
        JOIN ANALYTICS.MART.DIM_ALL_ORDERS o ON p.INVOICEID = o.ID
          AND p.PAYDATE >= DATEADD(day, -30, o.DATE)
        WHERE p.PAYAMT > 0
          AND (p._CHECK_IF_DELETED = 0 OR p._CHECK_IF_DELETED IS NULL)
          AND o.SKU IS NOT NULL AND o.SKU != ''
          AND p.PAYDATE >= '{start}'
          AND p.PAYDATE <= CURRENT_DATE()
          AND p.PAYTYPE NOT IN ({valid_types})
          AND p.PAYTYPE != 'Discount for Payment in Full'
          AND p.PAYTYPE NOT LIKE 'CNCL-%'
        GROUP BY 1
    """, "AMT")

    all_weeks = set(sold_map) | set(pmts_map) | set(disc_map) | set(cncl_map)
    flows = {
        wf: {
            "sold": sold_map.get(wf),
            "pmts": pmts_map.get(wf),
            "disc": disc_map.get(wf),
            "cncl": cncl_map.get(wf),
        }
        for wf in all_weeks
    }
    print(f"   → {len(flows)} weeks of AR flow data fetched")
    recent = sorted(flows.keys())[-3:] if flows else []
    for d in recent:
        f = flows[d]
        print(f"      {d}: sold={f['sold']}, pmts={f['pmts']}, disc={f['disc']}, cncl={f['cncl']}")
    return flows


def build_ar2_trend_json(ar_trend, weekly_flows=None):
    """Rebuild ar2_trend.json from step-function ar_trend data.
    ar_trend items: [date_str, pct, avg13, t_bal, ov_bal]
    Recomputes 52-week rolling avg, adds quarter/year labels, saves ar2_trend.json.
    """
    from datetime import datetime as _dt2
    history = []
    for item in ar_trend:
        if len(item) < 5:
            continue
        date_str, pct, t_bal, ov_bal = item[0], item[1], item[3], item[4]
        try:
            dt = _dt2.strptime(date_str, "%Y-%m-%d").date()
        except:
            continue
        mo = dt.month
        q_label = "Q" + str((mo - 1) // 3 + 1)
        y_label = dt.year % 100
        flow = (weekly_flows or {}).get(date_str, {})
        history.append({
            "d": date_str, "tb": t_bal, "ob": ov_bal,
            "pct": pct, "avg52": None, "q": q_label, "y": y_label,
            "sold": flow.get("sold"),
            "pmts": flow.get("pmts"),
            "disc": flow.get("disc"),
            "cncl": flow.get("cncl"),
            "chg":  None,
        })

    win = 52
    for i in range(len(history)):
        si  = max(0, i - win + 1)
        avg = round(sum(history[j]["pct"] for j in range(si, i + 1)) / (i - si + 1), 2)
        history[i]["avg52"] = avg
        history[i]["chg"] = round(history[i]["ob"] - history[i-1]["ob"], 2) if i > 0 else None

    json_path = os.path.join(CONFIG["output_dir"], "ar2_trend.json")
    with open(json_path, "w") as f:
        json.dump(history, f, separators=(',', ':'))
    size_kb = os.path.getsize(json_path) // 1024
    print(f"   → ar2_trend.json rebuilt — {len(history)} Fridays ({size_kb} KB)")
    return history


def build_current_week_preview(trend_v2, weekly_flows, ar_invoices):
    """Build a partial-week in-progress snapshot for the current (incomplete) week.
    Uses this week's Friday as the label, week-to-date flows from weekly_flows,
    and live AR totals from ar_invoices.
    """
    from datetime import date as _date
    today = _date.today()
    days_to_friday = (4 - today.weekday()) % 7
    week_fri = today + timedelta(days=days_to_friday)
    week_fri_str = week_fri.strftime('%Y-%m-%d')
    week_sat = week_fri - timedelta(days=6)

    # Starting balance = last completed week in trend
    start_bal  = trend_v2[-1]["tb"] if trend_v2 else 0.0
    start_date = trend_v2[-1]["d"]  if trend_v2 else ""

    # Week-to-date flows (keyed to upcoming Friday); None means no Snowflake data yet
    flow = (weekly_flows or {}).get(week_fri_str, {})
    sold = flow.get("sold")
    pmts = flow.get("pmts")
    disc = flow.get("disc")
    cncl = flow.get("cncl")
    if sold is not None and pmts is not None and disc is not None and cncl is not None:
        calc_ar = round(start_bal + sold - pmts - disc - cncl, 2)
    else:
        calc_ar = None

    # Live AR totals from DIM_AR_ALL_INVOICES
    live_tb = 0.0; live_ob = 0.0
    for r in (ar_invoices or []):
        try: bal = float(str(r.get("balance","") or 0))
        except: bal = 0.0
        try: arr = float(str(r.get("total_arrears","") or 0))
        except: arr = 0.0
        if bal > 0:
            live_tb += bal
            live_ob += max(0.0, arr)

    mo = week_fri.month
    return {
        "week_fri":   week_fri_str,
        "week_start": week_sat.strftime('%Y-%m-%d'),
        "data_through": str(today),
        "start_bal":  round(start_bal, 2),
        "start_date": start_date,
        "sold":  sold,  "pmts":  pmts,
        "disc":  disc,  "cncl":  cncl,
        "calc_ar":  calc_ar,
        "live_tb":  round(live_tb, 2),
        "live_ob":  round(live_ob, 2),
        "live_pct": round(live_ob / live_tb * 100, 2) if live_tb > 0 else 0.0,
        "gap":  round(live_tb - calc_ar, 2) if calc_ar is not None else None,
        "q": "Q" + str((mo - 1) // 3 + 1),
        "y": week_fri.year % 100,
    }


def build_ar_v2_data(ar_rows, trend_v2=None):
    """Build ar2_data.json from DIM_AR_ALL_INVOICES rows."""
    print("⏳ Building ar2_data.json (AR v2)...")
    from datetime import date as _date
    today = _date.today()

    def cm(v):
        try: return round(float(str(v).replace('$','').replace(',','').strip() or 0), 2)
        except: return 0.0

    def ci(v):
        try: return int(float(str(v) or 0))
        except: return 0

    def get_v2_status(order_credit_status):
        c = (order_credit_status or "").lower().strip()
        if "cncl" in c or "lrev" in c or "cancelled" in c: return "Cancelled"
        return "Active"

    def get_v2_bucket(days_delay, status):
        if status == "Cancelled": return "Cancelled"
        try: dd = int(float(str(days_delay) or 0))
        except: dd = 0
        if dd <= 6:   return "Current"
        if dd <= 12:  return "7-12d"
        if dd <= 18:  return "13-18d"
        if dd <= 30:  return "19-30d"
        if dd <= 60:  return "31-60d"
        if dd <= 90:  return "61-90d"
        if dd <= 180: return "91-180d"
        return "180d+"

    def clean_pdi(v):
        return str(v).strip().lower() in ("true","yes","1","y","x","flagged","issue")

    rows_out = []
    skus = set(); pcats = set(); divs = set(); partners = set()
    total_inv = 0.0; total_paid = 0.0; total_bal = 0.0
    total_arr = 0.0; total_cur = 0.0; pdi_count = 0

    for r in ar_rows:
        inv     = cm(r.get("inv",""))
        payment = cm(r.get("payment",""))
        balance = cm(r.get("balance",""))
        arrears = cm(r.get("total_arrears",""))
        cur_bal = cm(r.get("current_bal",""))
        b0_30   = cm(r.get("b0_30",""))
        b31_60  = cm(r.get("b31_60",""))
        b61_90  = cm(r.get("b61_90",""))
        b90p    = cm(r.get("b90p",""))
        status  = get_v2_status(r.get("order_credit_status",""))
        dd      = ci(r.get("days_delay",""))
        bucket  = get_v2_bucket(dd, status)
        sku     = str(r.get("product_name","") or "Unknown").strip()
        skc     = str(r.get("sku_code","") or "").strip()
        pcat    = str(r.get("pcat","") or "Unknown").strip()
        div_    = str(r.get("division","") or "Other").strip()
        part    = str(r.get("partner","") or "").strip()
        pdi     = clean_pdi(r.get("past_due_issue",""))
        cpct    = round(payment/inv*100, 1) if inv > 0 else 0.0

        skus.add(sku); pcats.add(pcat); divs.add(div_); partners.add(part)
        total_inv  += inv;  total_paid += payment; total_bal += balance
        total_arr  += arrears; total_cur += cur_bal
        if pdi: pdi_count += 1

        rows_out.append({
            "oid":  str(r.get("order_id","")   or ""),
            "cid":  str(r.get("contact_id","") or ""),
            "name": str(r.get("client_name","")or ""),
            "sku":  sku,
            "skc":  skc,
            "date": str(r.get("ar_date","")    or "")[:10],
            "div":  div_,
            "pcat": pcat,
            "part": part,
            "inv":  inv,
            "paid": payment,
            "bal":  balance,
            "arr":  arrears,
            "cur":  cur_bal,
            "b0":   b0_30,
            "b31":  b31_60,
            "b61":  b61_90,
            "b90":  b90p,
            "dd":   dd,
            "bucket": bucket,
            "status": status,
            "cpct": cpct,
            "crs":  str(r.get("crs_status","")    or ""),
            "pdi":  pdi,
            "lpd":  str(r.get("last_pmt_date","") or ""),
            "lpa":  cm(r.get("last_pmt_amt","")),
            "lpt":  str(r.get("last_pmt_type","") or ""),
            "lspd": str(r.get("last_sched_pmt","")or ""),
            "a1":   str(r.get("att1","")   or ""),
            "a1d":  str(r.get("att1_date","")or ""),
            "a2":   str(r.get("att2","")   or ""),
            "a2d":  str(r.get("att2_date","")or ""),
            "a3":   str(r.get("att3","")   or ""),
            "a3d":  str(r.get("att3_date","")or ""),
        })

    print(f"   → {len(rows_out):,} AR v2 records | Balance=${total_bal:,.0f} | Arrears=${total_arr:,.0f}")
    return {
        "summary": {
            "total_orders":  len(rows_out),
            "total_inv":     round(total_inv,  2),
            "total_paid":    round(total_paid, 2),
            "total_bal":     round(total_bal,  2),
            "total_arrears": round(total_arr,  2),
            "total_current": round(total_cur,  2),
            "pdi_count":     pdi_count,
            "as_of":         str(today),
        },
        "rows": rows_out,
        "trend_v2": trend_v2 or [],
        "FL": {
            "skus":     sorted(s for s in skus     if s and s != "Unknown"),
            "pcats":    sorted(p for p in pcats    if p and p != "Unknown"),
            "divs":     sorted(d for d in divs     if d and d != "Other"),
            "partners": sorted(p for p in partners if p),
        }
    }


# ── 2026 Program Down Payment Lookup ─────────────────────────────────────────
# Keys are SKU codes as they appear in DIM_ALL_ORDERS.
# "phone" = Phone / Affiliate / Marketing pricing; "event" = Event pricing.
# Applied to 2026+ orders. Pre-2026 orders use the 10.5% legacy rule. Unknown 2026 SKUs fall back to 10.5%.
LDP_DOWN_PMTS = {
    # LT — old SKU : kept for pre-migration orders; new SKU aliases below
    "BTME":               {"phone":   500, "event":   500},
    "BTM":                {"phone":  2637, "event":  1900},
    "BTM-Mopp":           {"phone":   997, "event":   997},
    "BTM MOPP":           {"phone":   997, "event":   997},   # new SKU
    "MM-SC-KAT":          {"phone":  4700, "event":  3995},
    "BTMPC":              {"phone":  4700, "event":  3995},   # new SKU
    "BTMP":               {"phone":  6997, "event":  6997},
    "BTMP-Mopp":          {"phone":  6997, "event":  6997},
    "BTMP MOPP":          {"phone":  6997, "event":  6997},   # new SKU
    "BTMP-Add on":        {"phone":  6997, "event":  6997},
    "BTMP Add-On":        {"phone":  6997, "event":  6997},   # new SKU
    "BTM BT Add-on":      {"phone":  6999, "event":  5999},
    "BT Add-On":          {"phone":  6999, "event":  5999},   # new SKU
    "MC-Elite":           {"phone":  7200, "event":  5999},
    "MCE":                {"phone":  7200, "event":  5999},   # new SKU
    "MC-Elite-Mopp":      {"phone":  6455, "event":  5999},
    "MCE MOPP":           {"phone":  6455, "event":  5999},   # new SKU
    "MC-Elite-MC":        {"phone":  4450, "event":  5999},
    "MCE MC":             {"phone":  4450, "event":  5999},   # new SKU
    "MC Elite 1 to 1":    {"phone": 10200, "event": 10425},
    "MCE 1:1":            {"phone": 10200, "event": 10425},   # new SKU
    "MM Mary":            {"phone": 10000, "event": 10000},
    "Elite 1 to 1 Mary":  {"phone": 24000, "event": 24000},
    "Diamond 1:1":        {"phone": 24000, "event": 24000},   # new SKU
    # LCC
    "DBCE":               {"phone":   997, "event":   997},
    "DBC":                {"phone":  3999, "event":  3999},
    "LMC":                {"phone":  7020, "event":  5999},
    "DBCA":               {"phone":  1636, "event":  2400},   # old — 6 MO default; 12 MO resolved via product name
    "DBCA 6":             {"phone":  1636, "event":  2400},
    "DBCA 6MO":           {"phone":  1636, "event":  2400},   # new SKU
    "DBCA 6MO MOPP":      {"phone":  1636, "event":  2400},   # new SKU (alumni)
    "DBCA 12":            {"phone":  2182, "event":  3600},
    "DBCA 12MO":          {"phone":  2182, "event":  3600},   # new SKU
    "DBCA 12MO MOPP":     {"phone":  2182, "event":  3600},   # new SKU (alumni)
    "LMCA":               {"phone":  1636, "event":  2400},   # old — 6 MO default
    "LMCA 6":             {"phone":  1636, "event":  2400},
    "LMCA 6MO":           {"phone":  1636, "event":  2400},   # new SKU
    "LMCA 6MO MOPP":      {"phone":  1636, "event":  2400},   # new SKU (alumni)
    "LMCA 12":            {"phone":  2182, "event":  3600},
    "LMCA 12MO":          {"phone":  2182, "event":  3600},   # new SKU
    "LMCA 12MO MOPP":     {"phone":  2182, "event":  3600},   # new SKU (alumni)
    "LMCA GOLD":          {"phone":  3999, "event":  3999},
    "ELEV":               {"phone":  7200, "event":  5999},
    "ELEV MOPP":          {"phone":  7200, "event":  5999},   # new SKU (alumni)
    "ELEVADD":            {"phone":  5999, "event":  5999},
    "ELEV Add-On":        {"phone":  5999, "event":  5999},   # new SKU
    "INTSV4ADD":          {"phone":  2999, "event":  2999},
    "ELEV 4IM":           {"phone":  2999, "event":  2999},   # new SKU
    "ACCLIVE":            {"phone":  3749, "event":  3749},
    "ACC LIVE":           {"phone":  3749, "event":  3749},   # new SKU
    # L&R
    "MYM":                {"phone":   875, "event":   875},   # old — 6 MO default; 12 MO resolved via product name
    "MYM 6":              {"phone":   875, "event":   875},
    "MYM 6MO":            {"phone":   875, "event":   875},   # new SKU
    "MYM 12":             {"phone":  1632, "event":   997},
    "MYM 12MO":           {"phone":  1632, "event":   997},   # new SKU
    "MYM 12MO MOPP":      {"phone":  1632, "event":   997},   # new SKU (members only pricing)
    "MYME":               {"phone":   450, "event":   450},
    "MYM 2.0":            {"phone":   984, "event":   984},
    "MYM-VIP":            {"phone":  3750, "event":  3750},
    "MYM VIP 6":          {"phone":  3750, "event":  3750},   # new SKU
    "MYM VIP W12":        {"phone":  5999, "event":  5999},
    "MYM VIP 12":         {"phone":  5999, "event":  5999},   # new SKU
    "MYM VIP W24":        {"phone":  7680, "event":  7680},
    "MYM VIP 24":         {"phone":  7680, "event":  7680},   # new SKU
    "MYM VIP W12- Add-On":{"phone":  2280, "event":  2280},
    "MYM VIP 12 Add-on":  {"phone":  2280, "event":  2280},   # new SKU
    "MYM VIP W20- Add-On":{"phone":  3750, "event":  3750},
    "MYM VIP 20 Add-on":  {"phone":  3750, "event":  3750},   # new SKU
    # HWB
    "TFT-O":              {"phone":   780, "event":   780},
    "TFTO":               {"phone":   780, "event":   780},   # new SKU
    # VHW — Vision Has Wings (confirmed threshold from user)
    "VHW OL 6 Mo":        {"phone":  1800, "event":  1800},
    "VHW OL 12 Mo":       {"phone":  1800, "event":  1800},   # assumed same; confirm if different
    # B&L
    "BTL":                {"phone":  3600, "event":  3600},
    "BTL MOPP":           {"phone":  1500, "event":  1500},   # new SKU
    "BTLE":               {"phone":   750, "event":   750},
    "HLL":                {"phone":  5999, "event":  5999},
    "BTBPC":              {"phone":  5999, "event":  5999},
    "BTB PC":             {"phone":  5999, "event":  5999},
    "BTLM":               {"phone": 10500, "event": 10500},
    "BTLM VIP":           {"phone": 22500, "event": 22500},
}

def get_ldp_threshold(sku, pcat, product_name, inv_total):
    """Return the dollar threshold below which dep_0 qualifies a 2026+ order as LDP.
    Uses LDP_DOWN_PMTS when SKU is known; falls back to 10.5% of inv_total otherwise.
    Ambiguous SKUs (DBCA/LMCA/MYM) are resolved via product name.
    Pre-2026 orders always use the 10.5% rule directly (not this function).
    """
    is_event = "event" in (pcat or "").lower()
    price_key = "event" if is_event else "phone"
    pname = (product_name or "").upper()

    # Resolve ambiguous SKUs that cover both 6 MO and 12 MO under one code
    resolved_sku = sku
    if sku in ("DBCA", "LMCA") and ("12 MO" in pname or "12MO" in pname or "12 MONTH" in pname):
        resolved_sku = sku + " 12"
    elif sku == "MYM" and "12" in pname:
        resolved_sku = "MYM 12"

    entry = LDP_DOWN_PMTS.get(resolved_sku)
    if entry:
        return float(entry[price_key])
    return float(inv_total) * 0.105  # SKU not in map — fall back to 10.5%


def pre_compute_ldp_ids(orders, payments_rows):
    """Return (ldp_ids set, ldp_first_pay dict {oid: (d0,d1,d2,d3)}) for orders whose
    same-day deposit (dep_0) qualifies as LDP.
    Pre-2026: dep_0 <= 10.5% of INV_TOTAL.
    2026+: dep_0 <= fixed DP from LDP_DOWN_PMTS (falls back to 10.5% for unknown SKUs).
    Uses UNIQUE_ORDER_ID to avoid cross-account collision."""
    uid_deps = {}  # uid → (dep_0, dep_1, dep_2, dep_3)
    for row in (payments_rows or []):
        uid = str(row.get('UID', '')).strip()
        d0 = clean_money(row.get('Deposit', 0))
        d1 = clean_money(row.get('dep_1', 0) or d0)
        d2 = clean_money(row.get('dep_2', 0) or d0)
        d3 = clean_money(row.get('dep_3', 0) or d0)
        if uid:
            uid_deps[uid] = (d0, d1, d2, d3)

    ldp_ids = set()
    ldp_first_pay = {}  # oid → (dep_0, dep_1, dep_2, dep_3)
    for r in orders:
        oid = r.get("ID","").strip()
        uid = r.get("UNIQUE_ORDER_ID","").strip()
        inv = float(r.get("INV_TOTAL",0) or 0)
        if inv <= 0 or not uid: continue
        deps = uid_deps.get(uid)
        if deps is None: continue
        order_date = str(r.get("DATE","") or "")
        if order_date >= "2026-01-01":
            sku      = r.get("SKU","") or ""
            pcat     = r.get("REFERRAL_PARTNER_CATEGORY","") or ""
            product  = r.get("PRODUCTS","") or r.get("NORMALIZED_PRODUCT","") or ""
            threshold = get_ldp_threshold(sku, pcat, product, inv)
        else:
            threshold = inv * 0.105  # pre-2026: legacy 10.5% rule
        if 0 < deps[0] < threshold:
            ldp_ids.add(oid)
            ldp_first_pay[oid] = (round(deps[0],2), round(deps[1],2), round(deps[2],2), round(deps[3],2))
    print(f"   → Pre-computed {len(ldp_ids):,} LDP order IDs")
    return ldp_ids, ldp_first_pay


def main():
    print("=" * 55, flush=True)
    print("  BTI Analytics Dashboard - Data Refresh", flush=True)
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M')}", flush=True)
    print("=" * 55, flush=True)

    # 1. Connect & fetch from Snowflake
    conn          = connect_snowflake()
    orders        = fetch_orders(conn)
    payments      = fetch_payments(conn)
    ar_invoices   = fetch_ar_invoices(conn)
    weekly_flows  = fetch_weekly_ar_flows(conn)
    conn.close()

    # 2. Pre-compute LDP IDs for cross-report metric
    print()
    ldp_ids, ldp_first_pay = pre_compute_ldp_ids(orders, payments)

    # 3. Build and save each JSON — free memory after each save
    import gc

    print()
    cancel_data = build_cancellation_data(orders, ldp_order_ids=ldp_ids, ldp_first_pay=ldp_first_pay)
    save_json(cancel_data, "data.json")
    # Keep only the slices ar_data needs; free the rest
    cancel_qfy   = cancel_data.get("QFY",   {})
    cancel_gmsku = cancel_data.get("GMSKU", {})
    cancel_pcm   = cancel_data.get("PCM",   {})
    cancel_pcmsku= cancel_data.get("PCMSKU",{})
    cancel_data = None; gc.collect()

    print()
    pif_data = build_pif_data(orders)
    save_json(pif_data, "pif_data.json")
    pif_data = None; gc.collect()

    print()
    pif_rows = build_pif_rows(orders)
    save_json(pif_rows, "pif_rows.json")
    pif_rows = None; gc.collect()

    print()
    ldp_data = build_ldp_data(orders, payments_rows=payments, payments_csv_path=CONFIG.get("payments_csv"))
    ldp_ids = None; gc.collect()
    save_json(ldp_data, "ldp_data.json")
    ldp_data = None; gc.collect()

    # Pre-extract only what AR needs from payments, then free the 270K-row list
    ar_pmts = {}
    for p in (payments or []):
        oid      = str(p.get("Id", p.get("INVOICEID",""))).strip()
        last_str = str(p.get("LAST_PAY_DATE",""))[:10]
        cnt      = int(p.get("PMT_COUNT", 1) or 1)
        last_dt  = parse_date(last_str)
        if oid and last_dt:
            ar_pmts[oid] = (last_dt, cnt)
    payments = None; gc.collect()

    # Build AR before Asana fetch — frees cancel slices & payment data before Asana
    print()
    _cancel_slim = {"GMSKU": cancel_gmsku, "PCM": cancel_pcm, "PCMSKU": cancel_pcmsku}
    ar_data = build_ar_data(orders, payments_rows=None, cancel_qfy=cancel_qfy,
                            cancel_data=_cancel_slim, order_payments_prebuilt=ar_pmts)
    ar_pmts = None; cancel_qfy = None; cancel_gmsku = None
    cancel_pcm = None; cancel_pcmsku = None; _cancel_slim = None; gc.collect()
    save_json(ar_data, "ar_data.json")
    ar_data = None; gc.collect()

    print()
    ar_trend_v2 = load_ar_trend_history()
    ar_trend_v2 = append_weekly_ar_trend(ar_trend_v2, ar_invoices, weekly_flows=weekly_flows)
    ar2_data = build_ar_v2_data(ar_invoices, trend_v2=ar_trend_v2)
    ar2_data["current_week"] = build_current_week_preview(ar_trend_v2, weekly_flows, ar_invoices)
    weekly_flows = None
    save_json(ar2_data, "ar2_data.json")
    ar_trend_v2 = None; ar2_data = None; ar_invoices = None; gc.collect()

    # Asana / CRS last — most memory freed by now, only orders remains
    print()
    try:
        asana_rows = fetch_asana_tasks()
        cr_data = build_cr_data(orders, asana_rows)
        if cr_data:
            save_json(cr_data, "cr_data.json")
        cr_data = None; asana_rows = None; gc.collect()
    except MemoryError:
        print("   ⚠️  MemoryError in Asana/CRS step — skipping CRS, all other data saved")
    except Exception as e:
        print(f"   ⚠️  Error in Asana/CRS step: {e} — skipping CRS, all other data saved")

    print()
    print("=" * 55)
    print("  ✅ All JSON files refreshed!")
    print("  → Push the output folder to GitHub Pages")
    print("=" * 55)


if __name__ == "__main__":
    main()
