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
import json
import csv
import re
import urllib.request
from datetime import datetime
from collections import defaultdict

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
        "account":    CONFIG["account"],
        "user":       CONFIG["user"],
        "private_key": private_key_bytes,
        "warehouse":  CONFIG["warehouse"],
        "database":   CONFIG["database"],
        "schema":     CONFIG["schema"],
        # Force JSON result format — avoids Arrow/nanoarrow bug on Python 3.13
        "session_parameters": {"PYTHON_CONNECTOR_QUERY_RESULT_FORMAT": "JSON"},
    }
    if CONFIG.get("role"):
        conn_params["role"] = CONFIG["role"]

    conn = snowflake.connector.connect(**conn_params)
    print("✅ Connected to Snowflake")
    return conn


def fetch_orders(conn):
    """Pull all orders from DIM_ALL_ORDERS."""
    print("⏳ Fetching orders from Snowflake...")
    sql = f"""
        SELECT
            ID, UNIQUE_ORDER_ID, CONTACTID, SKU, DATE, MONTH,
            REFERRAL_PARTNER_CATEGORY, REFERRAL_PARTNER,
            INV_TOTAL, PAYMENTS_TOTAL, ACTUAL_INV_SALE_TOTAL,
            PMT_STATUS, CREDIT_STATUS, REFUND_CREDIT_DATE,
            ENROLLMENT_MENTOR, SKU_CATEGORY, DIVISION,
            LOST_REVENUE, REFUNDS, CREDITS,
            PRODUCTS, NORMALIZED_PRODUCT
        FROM ANALYTICS.MART.DIM_ALL_ORDERS
        WHERE DATE >= '{CONFIG["start_date"]}'
          AND PAYMENTS_TOTAL > 0
          AND SKU IS NOT NULL AND SKU != ''
        ORDER BY DATE DESC
    """
    cur = conn.cursor()
    cur.execute(sql)
    cols = [c[0] for c in cur.description]
    rows = [dict(zip(cols, row)) for row in cur.fetchall()]
    # Normalize: convert dates to strings
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
    """Pull all payments from stg_inf_payments_combined.
    Column mapping from Snowflake → Infusionsoft CSV names:
        INVOICEID  → Id         (joins to DIM_ALL_ORDERS.ID)
        CONTACTID  → Contact Id
        PAYAMT     → Pay Amt
        PAYTYPE    → Pay Type
        PAYDATE    → Date
    """
    print("⏳ Fetching payments from Snowflake...")
    sql = """
        SELECT
            INVOICEID   AS "Id",
            CONTACTID   AS "Contact Id",
            PAYTYPE     AS "Pay Type",
            PAYAMT      AS "Pay Amt",
            PAYDATE     AS "Date"
        FROM ANALYTICS.MART.stg_inf_payments_combined
        WHERE PAYAMT > 0
          AND (_CHECK_IF_DELETED = 0 OR _CHECK_IF_DELETED IS NULL)
        ORDER BY PAYDATE ASC
    """
    cur = conn.cursor()
    cur.execute(sql)
    cols = [c[0] for c in cur.description]
    rows = [dict(zip(cols, row)) for row in cur.fetchall()]
    for r in rows:
        for k, v in r.items():
            if hasattr(v, 'strftime'):
                r[k] = v.strftime('%Y-%m-%d')
            elif v is None:
                r[k] = ''
            else:
                r[k] = str(v)
    print(f"   → {len(rows):,} payment records fetched")
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
    if "upgrade"    in cs: return "Upgrade"
    if "downgrade"  in cs: return "Downgrade"
    if "entry error" in cs or "error" in cs: return "Entry Error"
    if "cncl"       in cs or "lrev" in cs:  return "Cancelled"
    return "Sale"

def get_active(cncl):
    return "Inactive" if cncl in ("Entry Error","Cancelled") else "Active"

def get_division(uid):
    uid = (uid or "").lower()
    if "jj969" in uid: return "LS"
    if "ho175" in uid: return "B&L"
    if "it175" in uid: return "L&R"
    if "zu201" in uid: return "HWB"
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

def build_cancellation_data(orders):
    print("⏳ Building data.json (Cancellation)...")

    Ti,Ci,Ei,Ui,Di,Ai,Ii,CRi = 0,1,2,3,4,5,6,7
    def make_b(): return [0,0,0,0,0,0,0,0.0]
    rows_by_sku = defaultdict(list)
    def upd(b, cncl, active, lr):
        b[0] += 1
        if   cncl == "Cancelled":   b[1] += 1
        elif cncl == "Entry Error": b[2] += 1
        elif cncl == "Upgrade":     b[3] += 1
        elif cncl == "Downgrade":   b[4] += 1
        if active == "Active":      b[5] += 1
        else:                       b[6] += 1
        b[7] += lr

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

    skus=set(); parts=set(); pcats=set()

    for r in orders:
        cncl   = get_cncl(r.get("CREDIT_STATUS",""))
        active = get_active(cncl)
        month  = str(r.get("DATE",""))[:7]
        sku    = r.get("SKU","") or "Unknown"
        pcat   = r.get("REFERRAL_PARTNER_CATEGORY","") or "Unknown"
        part   = r.get("REFERRAL_PARTNER","") or "Unknown"
        lr     = float(r.get("LOST_REVENUE",0) or 0)
        rdate  = r.get("REFUND_CREDIT_DATE","")
        date   = r.get("DATE","")
        cs_raw = r.get("CREDIT_STATUS","") or ""

        if not month: continue
        skus.add(sku); parts.add(part); pcats.add(pcat)

        upd(M[month],         cncl, active, lr)
        upd(S[sku],           cncl, active, lr)
        upd(PC[pcat],         cncl, active, lr)
        upd(P[part],          cncl, active, lr)
        upd(PCM[pcat][month], cncl, active, lr)
        upd(PM[part][month],  cncl, active, lr)
        upd(GMSKU[month][sku],           cncl, active, lr)
        upd(PCMSKU[pcat][month][sku],    cncl, active, lr)
        upd(PMSKU[part][month][sku],     cncl, active, lr)

        # Refund days
        if cncl == "Cancelled" and rdate:
            rd = get_rd(rdate, date)
            if rd != "N/A":
                GMRD[month][rd]  += 1
                PCMRD[pcat][month][rd] += 1
                PMRD[part][month][rd]  += 1

        # Order-level detail row: [id, contactid, date, active, cncl, inv_total, refunds, pcat, partner]
        rows_by_sku[sku].append([
            r.get("ID",""),
            r.get("CONTACTID",""),
            str(r.get("DATE",""))[:10],
            active,
            cncl,
            round(float(r.get("INV_TOTAL",0) or 0), 2),
            round(float(r.get("REFUNDS",0) or 0), 2),
            pcat,
            part,
        ])

        # Cancel reasons
        if cncl in ("Cancelled","Entry Error") and cs_raw:
            GMSKU_CR[month][sku][cs_raw]          += 1
            PCMSKU_CR[pcat][month][sku][cs_raw]   += 1

    data = {
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
        "GMSKU_CR":  {m: {s: dict(cr) for s,cr in sv.items()} for m,sv in GMSKU_CR.items()},
        "PCMSKU_CR": {p: {m: {s: dict(cr) for s,cr in sv.items()} for m,sv in mv.items()} for p,mv in PCMSKU_CR.items()},
        "FL": {
            "skus":     sorted(s for s in skus  if s and s != "Unknown"),
            "partners": sorted(p for p in parts if p and p != "Unknown"),
            "pcats":    sorted(p for p in pcats if p and p != "Unknown"),
        },
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

    # Load payments — from Snowflake rows (preferred) or CSV fallback
    order_day_payments = defaultdict(lambda: defaultdict(float))
    payments_found = False

    if payments_rows:
        payments_found = True
        for row in payments_rows:
            # Columns aliased in fetch_payments() to match CSV names:
            # "Id" = INVOICEID, "Pay Amt" = PAYAMT, "Date" = PAYDATE
            oid  = str(row.get('Id', row.get('INVOICEID',''))).strip()
            amt  = clean_money(row.get('Pay Amt', row.get('PAYAMT','')))
            date = parse_date(str(row.get('Date', row.get('PAYDATE','')))[:10])
            if oid and amt > 0 and date:
                order_day_payments[oid][date] += amt
        print(f"   → Payments loaded from Snowflake: {len(order_day_payments):,} orders")

    elif payments_csv_path and os.path.exists(payments_csv_path):
        payments_found = True
        with open(payments_csv_path, encoding='utf-8-sig') as f:
            for row in csv.DictReader(f):
                oid  = row.get('Id','').strip()
                amt  = clean_money(row.get('Pay Amt',''))
                date = parse_date(row.get('Date',''))
                if oid and amt > 0 and date:
                    order_day_payments[oid][date] += amt
        print(f"   → Payments loaded from CSV: {len(order_day_payments):,} orders")
    else:
        print(f"   ⚠️  No payments data available — LDP will be empty")

    def get_first_payment(oid):
        days = order_day_payments.get(oid, {})
        if not days: return None, 0.0
        fd = min(days.keys())
        return fd, days[fd]

    THRESHOLD = 0.10  # ≤ 10%

    # 8-element bucket: [total, cncl, entry_err, upgrade, downgrade, active, inactive, lost_rev]
    def make_b(): return [0,0,0,0,0,0,0,0.0]
    def upd(b, cncl, active, lost):
        b[0] += 1
        if   cncl == "Cancelled":   b[1] += 1
        elif cncl == "Entry Error": b[2] += 1
        elif cncl == "Upgrade":     b[3] += 1
        elif cncl == "Downgrade":   b[4] += 1
        if active == "Active": b[5] += 1
        else:                  b[6] += 1
        b[7] += lost

    by_month = defaultdict(make_b)
    by_sku   = defaultdict(make_b)
    by_pcat  = defaultdict(make_b)
    by_part  = defaultdict(make_b)
    all_skus=set(); all_parts=set(); all_pcats=set()
    rows_out = []

    for r in orders:
        oid = r.get("ID","").strip()
        inv = float(r.get("INV_TOTAL",0) or 0)
        if inv <= 0: continue

        fd, fa = get_first_payment(oid)
        if not payments_found: continue
        if not fd or fa <= 0: continue
        if fa / inv > THRESHOLD: continue

        cncl   = get_cncl(r.get("CREDIT_STATUS",""))
        active = get_active(cncl)
        paid   = float(r.get("PAYMENTS_TOTAL",0) or 0)
        lost   = max(0, round(inv - paid, 2)) if cncl == "Cancelled" else 0.0
        pmt_pct = round(fa / inv * 100, 1)
        sku    = r.get("SKU","") or "Unknown"
        skucat = r.get("SKU_CATEGORY","") or ""
        pcat   = r.get("REFERRAL_PARTNER_CATEGORY","") or "Unknown"
        part   = r.get("REFERRAL_PARTNER","") or "Unknown"
        em     = r.get("ENROLLMENT_MENTOR","") or ""
        date   = str(r.get("DATE",""))[:10]
        month  = str(r.get("DATE",""))[:7]
        rd     = get_rd(r.get("REFUND_CREDIT_DATE",""), r.get("DATE",""))

        all_skus.add(sku); all_parts.add(part); all_pcats.add(pcat)
        upd(by_month[month], cncl, active, lost)
        upd(by_sku[sku],     cncl, active, lost)
        upd(by_pcat[pcat],   cncl, active, lost)
        upd(by_part[part],   cncl, active, lost)

        rows_out.append([
            r.get("UNIQUE_ORDER_ID",""), oid, r.get("CONTACTID",""),
            sku, skucat, month, date,
            inv, fa, pmt_pct,
            cncl, active, rd,
            pcat, part, em, lost
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
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
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
                cf[name] = field.get("number_value") if field.get("number_value") is not None else ""
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

    order_to_sku = {r.get("ID","").strip(): r.get("SKU","").strip() for r in orders}
    order_to_inv = {r.get("ID","").strip(): float(r.get("INV_TOTAL",0) or 0) for r in orders}

    THRESHOLD = 1000

    def parse_dt(s):
        if not s: return None
        s = str(s).strip()
        for fmt in ["%Y-%m-%dT%H:%M:%S.%fZ","%Y-%m-%dT%H:%M:%SZ",
                    "%Y-%m-%d %H:%M:%S","%m/%d/%y","%m/%d/%Y","%Y-%m-%d"]:
            try: return datetime.strptime(s[:19], fmt[:len(s[:19])])
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
        oid = (r.get("Order ID","") or "").strip()
        contract = clean_money(r.get("Contract Amount (after discounts)",""))
        inv_from_orders = order_to_inv.get(oid, 0)
        amt = contract if contract > 0 else inv_from_orders
        if amt > 0 and amt < THRESHOLD:
            excluded += 1
            continue

        sku = order_to_sku.get(oid,"")
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

        created_at_str = r.get("Created At","")
        enriched.append({
            "id":             oid,
            "sku":            sku,
            "date":           clean_date(r.get("Date Sold","")),
            "month":          created_at_str[:7] if created_at_str else "",
            "status":         r.get("Status","") or "",
            "request_type":   r.get("Request for Change in Programs","") or "",
            "procedure":      procedure,
            "requested_date": clean_date(r.get("Requested Date mm/dd/yy","")),
            "saved_by":       r.get("Saved by","") or "",
            "rev_loss":       clean_money(r.get("Revenue Loss","")),
            "rev_saved":      clean_money(r.get("Total Revenue Saved","")),
            "refund_amt":     clean_money(r.get("Refund Amount","")),
            "contract_amt":   amt,
            "assignee":       r.get("Assignee","") or "",
            "client_id":      r.get("Client ID","") or "",
            "res_days":       res_days,
            "days_to_cancel": days_to_cancel,
            "created_at":     created_at_str[:10] if created_at_str else "",
            "completed_at":   r.get("Completed At","")[:10] if r.get("Completed At","") else "",
        })

    matched = [e for e in enriched if e["id"] and e["id"] in order_to_sku]

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
        "rows": matched[:500],
        "FL": {
            "statuses":   sorted(set(e["status"]       for e in matched if e["status"])),
            "req_types":  sorted(set(e["request_type"] for e in matched if e["request_type"])),
            "assignees":  sorted(set(e["assignee"]     for e in matched if e["assignee"])),
            "skus":       sorted(set(e["sku"]          for e in matched if e["sku"])),
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

def build_ar_data(orders, payments_rows=None):
    print("⏳ Building ar_data.json (Arrears)...")
    from datetime import date as _date
    today = _date.today()

    # Build last payment date per order from payments
    order_payments = defaultdict(list)
    if payments_rows:
        for p in payments_rows:
            oid  = str(p.get("Id", p.get("INVOICEID",""))).strip()
            amt  = clean_money(p.get("Pay Amt", p.get("PAYAMT","")))
            dt   = parse_date(str(p.get("Date", p.get("PAYDATE","")))[:10])
            if oid and amt > 0 and dt:
                order_payments[oid].append((dt, amt))

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
        pmts = order_payments.get(oid, [])
        last_dt   = max((dt for dt,_ in pmts), default=None) if pmts else None
        pmt_count = len(pmts)

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
        "filters": {
            "skus":     sorted(s for s in set(x["sku"]  for x in ar_rows) if s != "Unknown"),
            "pcats":    sorted(set(x["pcat"] for x in ar_rows if x["pcat"])),
            "statuses": ["Active","Cancelled"],
            "buckets":  ["0-30d","31-60d","61-90d","91-180d","180d+","Cancelled"],
        }
    }

def main():
    print("=" * 55)
    print("  BTI Analytics Dashboard — Data Refresh")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 55)

    # 1. Connect & fetch from Snowflake
    conn     = connect_snowflake()
    orders   = fetch_orders(conn)
    payments = fetch_payments(conn)
    conn.close()

    # 2. Build and save each JSON
    print()
    cancel_data = build_cancellation_data(orders)
    save_json(cancel_data, "data.json")

    print()
    pif_data = build_pif_data(orders)
    save_json(pif_data, "pif_data.json")

    print()
    pif_rows = build_pif_rows(orders)
    save_json(pif_rows, "pif_rows.json")

    print()
    ldp_data = build_ldp_data(orders, payments_rows=payments, payments_csv_path=CONFIG.get("payments_csv"))
    save_json(ldp_data, "ldp_data.json")

    print()
    asana_rows = fetch_asana_tasks()
    cr_data = build_cr_data(orders, asana_rows)
    if cr_data:
        save_json(cr_data, "cr_data.json")

    print()
    ar_data = build_ar_data(orders, payments_rows=payments)
    save_json(ar_data, "ar_data.json")

    print()
    print("=" * 55)
    print("  ✅ All JSON files refreshed!")
    print("  → Push the output folder to GitHub Pages")
    print("=" * 55)


if __name__ == "__main__":
    main()
