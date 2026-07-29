"""
AR Weekly Reconciliation — Current Week in Progress: Jun 6 – Jun 11, 2026
Week ends Friday Jun 13, 2026.
"""

import os
import sys

# Fix Windows console encoding
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ── OCSP env vars BEFORE any snowflake import ──
os.environ["SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED"] = "false"
os.environ["SNOWFLAKE_PYTHON_CONNECTOR_OCSP_MODE"]  = "FAIL_OPEN"

# ── Config (copied from ar_week_check.py) ──
CONFIG = {
    "account":    "ehb48572",
    "user":       "DIANA_AGUILAR",
    "private_key_path": "C:/Users/DianaAguilar/.ssh/diana_snowflake_key.p8",
    "private_key_passphrase": None,
    "warehouse":  "REPORTING",
    "database":   "ANALYTICS",
    "schema":     "MART",
    "role":       "ENROLLMENT_REPORTING",
}

WEEK_START       = "2026-06-06"
WEEK_END         = "2026-06-11"
STARTING_BALANCE = 7_811_285.00   # Jun 5 closing from Excel

# ── Connect to Snowflake ──
print("=" * 60)
print("Connecting to Snowflake...")
print("=" * 60)

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
import snowflake.connector

with open(CONFIG["private_key_path"], "rb") as f:
    private_key = serialization.load_pem_private_key(
        f.read(),
        password=None,
        backend=default_backend()
    )

private_key_bytes = private_key.private_bytes(
    encoding=serialization.Encoding.DER,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)

conn = snowflake.connector.connect(
    account         = CONFIG["account"],
    user            = CONFIG["user"],
    private_key     = private_key_bytes,
    warehouse       = CONFIG["warehouse"],
    database        = CONFIG["database"],
    schema          = CONFIG["schema"],
    role            = CONFIG["role"],
    login_timeout   = 60,
    network_timeout = 60,
    ocsp_fail_open  = True,
    session_parameters={"PYTHON_CONNECTOR_QUERY_RESULT_FORMAT": "JSON"},
)
print("Connected to Snowflake successfully.")

cur = conn.cursor()

print()
print("=" * 60)
print(f"Querying week {WEEK_START} to {WEEK_END}")
print("=" * 60)

# ── Query A: Payments received ──
VALID_PAYTYPES = (
    "'Credit Card','Credit Card (Manual)','Credit Card (MANUAL)',"
    "'ACH','ACH Bank','PayPal','PayPal Payment','Paypal',"
    "'Wire','Wire Transfer','Check','Cash'"
)

print("\n[Query A] Payments received (valid tender types incl. Paypal)...")
query_a = f"""
SELECT SUM(p.PAYAMT) AS pmts
FROM ANALYTICS.MART.stg_inf_payments_combined p
JOIN ANALYTICS.MART.DIM_ALL_ORDERS o
  ON p.INVOICEID = o.ID
 AND p.PAYDATE >= DATEADD(day, -30, o.DATE)
WHERE p.PAYAMT > 0
  AND (p._CHECK_IF_DELETED = 0 OR p._CHECK_IF_DELETED IS NULL)
  AND o.SKU IS NOT NULL AND o.SKU != ''
  AND p.PAYTYPE IN ({VALID_PAYTYPES})
  AND p.PAYDATE >= '{WEEK_START}' AND p.PAYDATE <= '{WEEK_END}'
"""
cur.execute(query_a)
row_a = cur.fetchone()
payments = float(row_a[0]) if row_a and row_a[0] is not None else 0.0
print(f"  Payments received:     ${payments:,.2f}")

# ── Query B: Discounts / adjustments (excluding CNCL-* types) ──
print("\n[Query B] Discounts / adjustments (non-tender, excl. DIPF, excl. CNCL-*)...")
query_b = f"""
SELECT SUM(p.PAYAMT) AS adj
FROM ANALYTICS.MART.stg_inf_payments_combined p
JOIN ANALYTICS.MART.DIM_ALL_ORDERS o
  ON p.INVOICEID = o.ID
 AND p.PAYDATE >= DATEADD(day, -30, o.DATE)
WHERE p.PAYAMT > 0
  AND (p._CHECK_IF_DELETED = 0 OR p._CHECK_IF_DELETED IS NULL)
  AND o.SKU IS NOT NULL AND o.SKU != ''
  AND p.PAYTYPE NOT IN ({VALID_PAYTYPES})
  AND p.PAYTYPE != 'Discount for Payment in Full'
  AND p.PAYTYPE NOT LIKE 'CNCL-%'
  AND p.PAYDATE >= '{WEEK_START}' AND p.PAYDATE <= '{WEEK_END}'
"""
cur.execute(query_b)
row_b = cur.fetchone()
adjustments = float(row_b[0]) if row_b and row_b[0] is not None else 0.0
print(f"  Adjustments/Discounts: ${adjustments:,.2f}")

# ── Query C: Orders sold ──
print("\n[Query C] Orders sold (INV_TOTAL, not entry errors)...")
query_c = f"""
SELECT SUM(INV_TOTAL) AS sold
FROM ANALYTICS.MART.DIM_ALL_ORDERS
WHERE DATE >= '{WEEK_START}' AND DATE <= '{WEEK_END}'
  AND SKU IS NOT NULL AND SKU != ''
  AND INV_TOTAL > 0
  AND NOT (
    LOWER(COALESCE(CREDIT_STATUS,'')) LIKE '%entry error%'
    OR LOWER(COALESCE(CREDIT_STATUS,'')) LIKE '%error%'
  )
"""
cur.execute(query_c)
row_c = cur.fetchone()
sold = float(row_c[0]) if row_c and row_c[0] is not None else 0.0
print(f"  Orders sold:           ${sold:,.2f}")

# ── Query D: Cancellations ──
print("\n[Query D] Cancellations (REFUND_CREDIT_DATE in week, CNCL/LREV status)...")
query_d = f"""
SELECT SUM(INV_TOTAL) AS cncl
FROM ANALYTICS.MART.DIM_ALL_ORDERS
WHERE REFUND_CREDIT_DATE >= '{WEEK_START}' AND REFUND_CREDIT_DATE <= '{WEEK_END}'
  AND SKU IS NOT NULL AND SKU != ''
  AND (
    LOWER(COALESCE(CREDIT_STATUS,'')) LIKE '%cncl%'
    OR LOWER(COALESCE(CREDIT_STATUS,'')) LIKE '%lrev%'
  )
"""
cur.execute(query_d)
row_d = cur.fetchone()
cancellations = float(row_d[0]) if row_d and row_d[0] is not None else 0.0
print(f"  Cancellations:         ${cancellations:,.2f}")

# ── Query E: Live AR snapshot ──
print("\n[Query E] Current AR total and arrears (live snapshot)...")
query_e = """
SELECT SUM(BALANCE) AS total_bal, SUM(GREATEST("total arrears", 0)) AS total_arrears
FROM ANALYTICS.MART.DIM_AR_ALL_INVOICES
WHERE BALANCE > 0
  AND LOWER(COALESCE(NAME, '')) NOT LIKE '%test%'
  AND COALESCE(LASTPAYMENTAMOUNT, 0) > 0
"""
cur.execute(query_e)
row_e = cur.fetchone()
live_ar_total   = float(row_e[0]) if row_e and row_e[0] is not None else 0.0
live_ar_arrears = float(row_e[1]) if row_e and row_e[1] is not None else 0.0
print(f"  Live AR Total:         ${live_ar_total:,.2f}")
print(f"  Live AR Arrears:       ${live_ar_arrears:,.2f}")

cur.close()
conn.close()

# ── Reconciliation summary ──
print()
print("=" * 60)
print("AR RECONCILIATION — Jun 6 – Jun 11, 2026 (WEEK IN PROGRESS)")
print("=" * 60)

expected_closing = (
    STARTING_BALANCE
    + sold
    - payments
    - adjustments
    - cancellations
)

pct_overdue_live = (live_ar_arrears / live_ar_total * 100) if live_ar_total else 0.0

print(f"  Starting AR Balance (2026-06-05):  ${STARTING_BALANCE:>14,.2f}")
print(f"  + Orders Sold (new charges):       ${sold:>14,.2f}")
print(f"  - Payments Received:               ${payments:>14,.2f}")
print(f"  - Adjustments / Discounts:         ${adjustments:>14,.2f}")
print(f"  - Cancellations:                   ${cancellations:>14,.2f}")
print(f"  {'─'*42}")
print(f"  = Expected Closing AR Balance:     ${expected_closing:>14,.2f}")
print()
print(f"  Live AR Total (Snowflake):         ${live_ar_total:>14,.2f}")
print(f"  Live AR Arrears (Overdue):         ${live_ar_arrears:>14,.2f}")
print(f"  % Overdue (live):                  {pct_overdue_live:>13.1f}%")
print()
diff = live_ar_total - expected_closing
print(f"  Variance (Live - Expected):        ${diff:>14,.2f}")
print("=" * 60)
print("Done.")
