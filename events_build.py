"""
EVENTS tab data for the old static dashboard  ->  events_data.json

Same rules as the new (Next.js) dashboard, so the two always agree:

  * Budgets and results are the ones typed in the owner's "EVENT & POST" Google Sheet
    (one row per event: event budget, event results, post-event budget, post-event results).
  * An EVENT sale carries a referral-partner code that starts with EV and holds the event
    code (EV_2026_05_DBL_V ...). Codes were typed by hand and changed format over the years,
    so they are read, not matched exactly.
  * A POST sale is an Enrollment Mentor code with PV or 50 in it. The sheet's post results
    attach sales to a post lead, which a referral code cannot show, so this is approximate.
  * Units = orders that still stand (Sale / Upgrade / Downgrade / Switch).
    Volume = ACTUAL_INV_SALE_TOTAL of those orders (net invoice).

Where the sheet rows come from (first one configured wins; one that is configured but fails
is an error, so a bad key is not hidden behind an old file):

  1. Google Sheets API   - secrets.json: "events_sheet_id" + "google_api_key"
                           (sheet shared "anyone with the link can view")
  2. Sheet CSV export    - secrets.json: "events_sheet_id" (+ optional "events_sheet_gid"),
                           same sharing
  3. events-sheet.csv    - the EVENT & POST tab saved with File > Download > CSV, next to this file

refresh_bti_data.py calls build_events_data() after the other reports. Nothing here can stop
the other reports: a failure is reported and the previous events_data.json is kept.
"""
import csv
import io
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

# Events before this year are ignored (the sheet goes back to 2016; the tab starts at 2022).
EVENTS_MIN_YEAR = 2022
DEFAULT_RANGE = "'EVENT & POST'!A1:AH600"
HERE = os.path.dirname(os.path.abspath(__file__))

ACTIVE_STATUSES = ("Sale", "Upgrade", "Downgrade", "Switch")

_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]


# ── sheet cells ────────────────────────────────────────────────────────────

def parse_num(cell):
    """'$1,917,048.00' -> 1917048, '$ -' -> 0, '7.25%' -> 7.25, '' -> None, unreadable -> None."""
    raw = str(cell if cell is not None else "").strip()
    if raw == "":
        return None
    s = re.sub(r"[$,%\s]", "", raw)
    if s == "" or s == "-":
        return 0
    try:
        n = float(s)
    except ValueError:
        return None
    return int(n) if n == int(n) else n


def parse_date(cell):
    """'2026-02-11' or '5/15/2026' -> '2026-05-15'. A month label such as 'Jan 2022' is not a date: None."""
    s = str(cell if cell is not None else "").strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s)
    if m:
        return "%s-%02d-%02d" % (m.group(3), int(m.group(1)), int(m.group(2)))
    return None


def month_label_to_ym(cell):
    """'Jan 2022' -> '2022-01'."""
    m = re.match(r"^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$", str(cell if cell is not None else "").strip())
    if not m:
        return None
    key = m.group(1).lower()
    if key not in _MONTHS:
        return None
    return "%s-%02d" % (m.group(2), _MONTHS.index(key) + 1)


# Column positions in the EVENT & POST tab (0-based; column A is the checkbox).
COL = dict(start=1, end=2, month=3, year=4, funnel=5, code=6, name=7, type=8,
           evBud=9, evRes=14, postBud=19, gross1=24, gross2=25, netLeads=26, ss=27, postUnits=28, postVol=29)

# Header cells that must sit where the parser expects them, so a rearranged sheet fails loudly.
HEADER_CHECKS = [
    (COL["code"], r"^code$"),
    (COL["name"], r"^event name$"),
    (COL["type"], r"^event type$"),
    (COL["evBud"], r"attendees"),
    (COL["postBud"], r"^leads$"),
    (COL["netLeads"], r"net leads"),
    (COL["ss"], r"^ss net$"),
]


def _cell(row, i):
    return str(row[i]).strip() if row is not None and i < len(row) and row[i] is not None else ""


def find_header_row(values):
    for i, r in enumerate(values):
        if re.match(r"^code$", _cell(r, COL["code"]), re.I) and re.match(r"^event name$", _cell(r, COL["name"]), re.I):
            return i
    return -1


def parse_events_sheet(values, min_year=EVENTS_MIN_YEAR):
    """One dict per event row with a code like '2026-05-DBL'. Rows without a code (spacers, totals) are skipped,
    as are years before min_year. Event budget and results are always numbers (0 when blank); the post-results
    fields stay None while the post team has not reported, so 'no result yet' is not shown as $0."""
    h = find_header_row(values)
    if h < 0:
        raise ValueError('The events sheet has no header row with "CODE" and "Event Name" columns.')
    for i, pattern in HEADER_CHECKS:
        cell = _cell(values[h], i)
        if not re.search(pattern, cell, re.I):
            raise ValueError('The events sheet columns moved: expected "%s" in column %d of the header row but found "%s".'
                             % (pattern, i + 1, cell))

    seen = {}
    rows = []
    for r in values[h + 1:]:
        code = _cell(r, COL["code"])
        m = re.match(r"^(\d{4})-(\d{2})-(.+)$", code)
        if not m or int(m.group(1)) < min_year:
            continue
        seen[code] = seen.get(code, 0) + 1
        n = seen[code]

        def num(i):
            return parse_num(_cell(r, i))

        def zero(i):
            v = num(i)
            return 0 if v is None else v

        ym = "%s-%s" % (m.group(1), m.group(2))
        alt_ym = month_label_to_ym(_cell(r, COL["month"])) or ym
        start = parse_date(_cell(r, COL["start"]))
        end = parse_date(_cell(r, COL["end"]))
        etype = "IN-PERSON" if re.search(r"in-?person", _cell(r, COL["type"]), re.I) else "Virtual"
        rows.append(dict(
            id=code if n == 1 else "%s#%d" % (code, n),
            code=code, year=int(m.group(1)), ym=ym, alt_ym=alt_ym,
            date=start or (alt_ym + "-01"), start_date=start, end_date=end,
            funnel=_cell(r, COL["funnel"]), name=_cell(r, COL["name"]), type=etype,
            ev_bud_att=zero(COL["evBud"]), ev_bud_units=zero(COL["evBud"] + 1), ev_bud_vol=zero(COL["evBud"] + 2),
            ev_res_att=zero(COL["evRes"]), ev_res_units=zero(COL["evRes"] + 1), ev_res_vol=zero(COL["evRes"] + 2),
            post_bud_leads=zero(COL["postBud"]), post_bud_units=zero(COL["postBud"] + 1), post_bud_vol=zero(COL["postBud"] + 2),
            post_gross1=num(COL["gross1"]), post_gross2=num(COL["gross2"]), post_net_leads=num(COL["netLeads"]),
            post_ss=num(COL["ss"]), post_units=num(COL["postUnits"]), post_vol=num(COL["postVol"]),
        ))
    return rows


# ── where the sheet rows come from ─────────────────────────────────────────

def _read_secrets():
    path = os.path.join(HERE, "secrets.json")
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _http_get(url, what):
    try:
        with urllib.request.urlopen(url, timeout=60) as resp:
            return resp.read().decode("utf-8-sig")
    except urllib.error.HTTPError as e:
        # Never echo the URL: it can carry the API key.
        body = re.sub(r"key=[^&\s\"]+", "key=***", e.read().decode("utf-8", "replace"))[:200]
        raise RuntimeError('Google returned %s for the events sheet (is it shared with "anyone with the link"?) %s: %s'
                           % (e.code, what, body))


def load_events_values(secrets=None, csv_path=None):
    """Returns (rows, source). rows is a list of lists of strings; source says where they came from."""
    secrets = _read_secrets() if secrets is None else secrets
    sheet_id = (secrets.get("events_sheet_id") or "").strip()
    key = (secrets.get("google_api_key") or "").strip()
    if sheet_id and key:
        rng = secrets.get("events_sheet_range") or DEFAULT_RANGE
        url = "https://sheets.googleapis.com/v4/spreadsheets/%s/values/%s?key=%s" % (
            urllib.parse.quote(sheet_id, safe=""), urllib.parse.quote(rng, safe=""), urllib.parse.quote(key, safe=""))
        data = json.loads(_http_get(url, "(Sheets API)"))
        return data.get("values", []), "Google Sheets API"
    if sheet_id:
        gid = str(secrets.get("events_sheet_gid") or "").strip()
        if gid:
            url = "https://docs.google.com/spreadsheets/d/%s/export?format=csv&gid=%s" % (urllib.parse.quote(sheet_id, safe=""), urllib.parse.quote(gid, safe=""))
        else:
            url = "https://docs.google.com/spreadsheets/d/%s/gviz/tq?tqx=out:csv&sheet=%s" % (urllib.parse.quote(sheet_id, safe=""), urllib.parse.quote("EVENT & POST"))
        text = _http_get(url, "(CSV export)")
        return list(csv.reader(io.StringIO(text))), "Google Sheets CSV export"
    path = csv_path or os.path.join(HERE, "events-sheet.csv")
    if os.path.exists(path):
        with open(path, encoding="utf-8-sig", newline="") as f:
            return list(csv.reader(f)), "events-sheet.csv"
    return [], "none"


# ── referral codes -> events ───────────────────────────────────────────────

def parse_event_partner(partner):
    """Parse an event referral code into (year-month, token naming the event), or None."""
    p = (partner or "").strip()
    m = re.match(r"^EV[_-](\d{4})[_-](\d{2})[_-](.+)$", p, re.I)  # EV_2026_05_DBL_V, EV-2025-03-BTB
    if m:
        return "%s-%s" % (m.group(1), m.group(2)), m.group(3)
    m = re.match(r"^EV[_-](.+?)[_-](\d{4})[_-](\d{2})$", p, re.I)  # EV_DBLV_2022_05, EV_CT_2022_09
    if m:
        return "%s-%s" % (m.group(2), m.group(3)), m.group(1)
    m = re.match(r"^EV[_-](.+?)[_-](\d{2})(\d{2})$", p, re.I)  # EV_DBC_2203
    if m:
        return "20%s-%s" % (m.group(2), m.group(3)), m.group(1)
    return None


# Spellings and typos of the same event, folded to one name. The sheet's EVENT column goes through the same rules.
FAMILIES = [
    (r"^BTMPLR", "LRI"),  # BTMP sold at an LRI event
    (r"^DBVL|^DBLV|^DBL", "DBL"),
    (r"^BTB|^BTMPBREAKTHROUGH", "BTB"),
    (r"^DDT|^DEEPDIVE", "DDT"),
    (r"^DBC", "DBC"),
    (r"^LMC", "LMC"),
    (r"^TTR|^TFT2", "TTR"),
    (r"^TFT", "TFT"),
    (r"^BVI", "BVI"),
    (r"^HWI|^HWB", "HWI"),
    (r"^LRI", "LRI"),
    (r"^TMFI", "TMFI"),
    (r"^HLL", "HLL"),
    (r"^ACC|^CCAL", "ACC"),
    (r"^CCEI|^EIV|^ELEV", "CCEI"),
    (r"^JTV|^JVT", "JTV"),
    (r"^FFL", "FFL"),
    (r"^GALA", "GALA"),
    (r"^LTI", "LTI"),
]
_FAMILIES = [(re.compile(p), name) for p, name in FAMILIES]


def _clean(token):
    return re.sub(r"[^A-Z0-9]", "", (token or "").upper())


def event_family(token):
    t = _clean(token)
    for rx, name in _FAMILIES:
        if rx.search(t):
            return name
    return t


def _month_index(ym):
    return int(ym[:4]) * 12 + int(ym[5:7])


def match_partner_to_event(partner, events):
    """The event an EV referral code belongs to: same event family, in the same month or one month either side
    (codes were often set a month early or late). In person or virtual chooses between two events of the same
    family in one month (Dream Builder Live ran both in October 2022)."""
    parsed = parse_event_partner(partner)
    if not parsed:
        return None
    ym, token = parsed
    fam = event_family(token)
    t = _clean(token)
    if re.search(r"IP$|INPERSON", t):
        hint = "IN-PERSON"
    elif re.search(r"V$|VIRTUAL", t):
        hint = "Virtual"
    else:
        hint = None
    at = _month_index(ym)

    best = None  # (event, diff, type_ok)
    for ev in events:
        if event_family(ev["funnel"] or ev["code"][8:]) != fam:
            continue
        diff = min(abs(_month_index(ev["ym"]) - at), abs(_month_index(ev["alt_ym"]) - at))
        if diff > 1:
            continue
        type_ok = hint is None or ev["type"] == hint
        if best is None or diff < best[1] or (diff == best[1] and type_ok and not best[2]):
            best = (ev, diff, type_ok)
    return best[0] if best else None


# ── orders -> channel / event aggregates ───────────────────────────────────

def is_event_code(partner):
    return (partner or "")[:3].upper() in ("EV_", "EV-")


def is_post_code(pcat, partner):
    return pcat == "Enrollment Mentor" and ("PV" in (partner or "").upper() or "50" in (partner or ""))


CHANNELS = ("event", "post", "other")


def build_events_data(orders, event_rows, get_cncl, source="", skipped_note=""):
    """orders: the rows refresh_bti_data.fetch_orders returns. get_cncl: its status classifier.
    Returns the dict saved as events_data.json."""
    partner_sku = {}   # (partner, sku) -> [units, cancelled, volume]  (event codes only)
    daily = {}         # (eff_date, sku, channel) -> [units, volume]   (orders that still stand)

    for r in orders:
        sku = r.get("SKU", "") or "Unknown"
        if sku == "Unknown":
            continue
        partner = r.get("REFERRAL_PARTNER", "") or "Unknown"
        pcat = r.get("REFERRAL_PARTNER_CATEGORY", "") or "Unknown"
        cncl = get_cncl(r.get("CREDIT_STATUS", ""))
        active = cncl in ACTIVE_STATUSES
        try:
            vol = float(r.get("ACTUAL_INV_SALE_TOTAL", 0) or 0)
        except (TypeError, ValueError):
            vol = 0.0
        heaven = (r.get("HEAVEN_DATE", "") or "")[:10]
        eff_date = heaven if heaven >= "2000" else str(r.get("DATE", "") or "")[:10]

        ev_code = is_event_code(partner)
        if ev_code:
            cell = partner_sku.setdefault((partner, sku), [0, 0, 0.0])
            if active:
                cell[0] += 1
                cell[2] += vol
            elif cncl == "Cancelled":
                cell[1] += 1
        if active and eff_date:
            ch = 0 if ev_code else 1 if is_post_code(pcat, partner) else 2
            cell = daily.setdefault((eff_date, sku, ch), [0, 0.0])
            cell[0] += 1
            cell[1] += vol

    # programs sold under each event's referral code, and the codes that match no event
    cache = {}
    sales = {}
    lost = {}
    for (partner, sku), (units, cancelled, vol) in partner_sku.items():
        if partner not in cache:
            cache[partner] = match_partner_to_event(partner, event_rows)
        ev = cache[partner]
        if ev:
            cur = sales.setdefault((ev["id"], sku), [0, 0, 0.0])
            cur[0] += units
            cur[1] += cancelled
            cur[2] += vol
        elif units or vol:
            lost[(partner, sku)] = [units, vol]

    skus = sorted({k[1] for k in daily} | {k[1] for k in partner_sku})
    sku_idx = {s: i for i, s in enumerate(skus)}
    return {
        "generated": __import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M"),
        "source": source,
        "events": event_rows,
        "skus": skus,
        # [event_id, sku, units, cancelled, volume]
        "sales": [[eid, sku, u, c, round(v, 2)] for (eid, sku), (u, c, v) in sorted(sales.items())],
        # [partner, sku, units, volume]
        "unmatched": [[p, sku, u, round(v, 2)] for (p, sku), (u, v) in sorted(lost.items())],
        # [eff_date, sku index, channel (0 event, 1 post, 2 other), units, volume]
        "daily": [[d, sku_idx[sku], ch, u, round(v, 2)] for (d, sku, ch), (u, v) in sorted(daily.items())],
    }


def refresh_events(orders, get_cncl, save_json, output_dir):
    """The step refresh_bti_data.main() runs. Never raises: on any problem the old events_data.json stays."""
    print("⏳ Building events_data.json (EVENTS)...")
    try:
        values, source = load_events_values()
        if not values:
            print("   ⚠️  No events sheet configured — skipping EVENTS (see README: add events_sheet_id to secrets.json,"
                  " or save the EVENT & POST tab as events-sheet.csv). Keeping the previous events_data.json.")
            return False
        rows = parse_events_sheet(values)
        data = build_events_data(orders, rows, get_cncl, source=source)
        save_json(data, "events_data.json")
        print("   → %d events from %s, %d event/SKU sales rows, %d daily rows, %d unmatched event codes"
              % (len(rows), source, len(data["sales"]), len(data["daily"]), len({u[0] for u in data["unmatched"]})))
        return True
    except Exception as e:  # noqa: BLE001 - the other reports must still be saved
        print("   ⚠️  EVENTS skipped: %s — all other data saved; the previous events_data.json is kept." % e)
        return False
