"""Checks for events_build.py. Run:  python test_events_build.py   (no Snowflake or network needed)"""
import events_build as eb

HEADER = ["", "Start Date", "END DATE", "MONTH", "YEAR", "EVENT", "CODE", "Event Name", "Event Type", "ATTENDEES", "UNITS", "VOLUME",
          "VPA", "CLOSING %", "ATTENDEES", "UNITS", "VOLUME", "VPA", "CLOSING %", "Leads", "UNITS", "VOLUME", "VPA", "CLOSING %",
          "Gross Leads 1", "Gross Leads 2", " Net Leads (Counted)", "SS NET", "UNITS", "VOLUME", "VPA", "CLOSING %"]


def row(start, end, month, year, funnel, code, name, etype, eb_, er, pb, post):
    return (["FALSE", start, end, month, year, funnel, code, name, etype, str(eb_[0]), str(eb_[1]), "$%s" % eb_[2], "", "",
             str(er[0]), str(er[1]), "$%s" % er[2], "", "", str(pb[0]), str(pb[1]), "$%s" % pb[2], "", ""]
            + [str(x) for x in post] + ["", "", ""])


SHEET = [
    ["Some title row"],
    HEADER,
    row("12/3/2021", "12/3/2021", "Dec 2021", "2021", "DBL", "2021-12-DBL", "Old event", "Virtual", [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1, 1, 1, "$1"]),
    row("10/21/2022", "10/23/2022", "Oct 2022", "2022", "DBL", "2022-10-DBL", "DBL In-Person", "IN-PERSON", [500, 60, 900000], [480, 58, 880000], [300, 20, 300000], [400, 300, 250, 70, 20, "$250,000"]),
    row("10/28/2022", "10/28/2022", "Oct 2022", "2022", "DBL", "2022-10-DBL", "DBL Virtual", "Virtual", [500, 60, 900000], [480, 58, 880000], [300, 20, 300000], [400, 300, 250, 70, 20, "$250,000"]),
    row("10/26/2026", "10/28/2026", "Oct 2026", "2026", "HLLP", "2026-10-HLL", "HLL", "IN-PERSON", [225, 37, 814777], [198, 50, 860000], [114, 13, 182923], ["148", "", "", "", "", ""]),
    ["", "", "", "", "", "", "total row, no code"],
]


def test_parse_sheet():
    ev = eb.parse_events_sheet(SHEET)
    assert [e["id"] for e in ev] == ["2022-10-DBL", "2022-10-DBL#2", "2026-10-HLL"], "2021 and the no-code row are skipped; duplicate codes get #n"
    assert ev[0]["type"] == "IN-PERSON" and ev[1]["type"] == "Virtual"
    assert ev[0]["post_vol"] == 250000 and ev[0]["ev_res_vol"] == 880000
    pending = ev[2]
    assert pending["post_net_leads"] is None and pending["post_units"] is None, "unreported post stays blank, not $0"
    assert pending["post_bud_leads"] == 114


def test_sheet_columns_moved_fails_loudly():
    bad = [r[:] for r in SHEET]
    bad[1][26] = "Something else"
    try:
        eb.parse_events_sheet(bad)
    except ValueError as e:
        assert "moved" in str(e)
    else:
        raise AssertionError("a moved column must raise")


def test_cells():
    assert eb.parse_num("$ -") == 0 and eb.parse_num("") is None and eb.parse_num("$1,917,048.00") == 1917048 and eb.parse_num("7.25%") == 7.25
    assert eb.parse_date("5/15/2026") == "2026-05-15" and eb.parse_date("Jan 2022") is None
    assert eb.month_label_to_ym("Jan 2022") == "2022-01"


def test_codes_and_matching():
    assert eb.parse_event_partner("EV_2026_05_DBL_V") == ("2026-05", "DBL_V")
    assert eb.parse_event_partner("EV-2025-03-BTB") == ("2025-03", "BTB")
    assert eb.parse_event_partner("EV_DBLV_2022_05") == ("2022-05", "DBLV")
    assert eb.parse_event_partner("EV_DBC_2203") == ("2022-03", "DBC")
    assert eb.parse_event_partner("PPV_ShKa_BrMa") is None
    for t in ("DBL", "DBLV", "DBL_IP", "DBVL", "DBL_V"):
        assert eb.event_family(t) == "DBL"
    ev = eb.parse_events_sheet(SHEET)
    assert eb.match_partner_to_event("EV_2022_10_DBL_IP", ev)["id"] == "2022-10-DBL"
    assert eb.match_partner_to_event("EV_2022_10_DBLV", ev)["id"] == "2022-10-DBL#2"
    assert eb.match_partner_to_event("EV_2026_09_HLLP", ev)["id"] == "2026-10-HLL", "a month early is accepted"
    assert eb.match_partner_to_event("EV_2026_07_HLLP", ev) is None, "two months away is not"
    assert eb.match_partner_to_event("EV_2023_11_Tulum", ev) is None


def test_build():
    ev = eb.parse_events_sheet(SHEET)

    def order(sku, partner, status, vol, date, pcat="Marketing", heaven=""):
        return {"SKU": sku, "REFERRAL_PARTNER": partner, "REFERRAL_PARTNER_CATEGORY": pcat, "CREDIT_STATUS": status,
                "ACTUAL_INV_SALE_TOTAL": vol, "DATE": date, "HEAVEN_DATE": heaven}

    orders = [
        order("BTMP", "EV_2022_10_DBL_IP", "", 10000, "2022-10-22"),          # event, stands
        order("BTMP", "EV_2022_10_DBL_IP", "CNCL-FRef-Uns", 10000, "2022-10-22"),  # event, cancelled
        order("MCE", "EV_2025_09_DBL_V", "", 5000, "2025-09-26"),             # event code, no event in the sheet
        order("MCE", "PPV_ShKa_BrMa", "", 7000, "2026-01-05", pcat="Enrollment Mentor"),  # post by code
        order("MCE", "Google", "", 3000, "2026-01-06", heaven="2026-02-01"),   # other, dated by HEAVEN_DATE
        order("", "EV_2022_10_DBL_IP", "", 1, "2022-10-22"),                   # no SKU: ignored
    ]
    d = eb.build_events_data(orders, ev, lambda cs: "Cancelled" if cs.startswith("CNCL") else "Sale")
    assert d["sales"] == [["2022-10-DBL", "BTMP", 1, 1, 10000.0]]
    assert d["unmatched"] == [["EV_2025_09_DBL_V", "MCE", 1, 5000.0]]
    skus = d["skus"]
    daily = {(r[0], skus[r[1]], eb.CHANNELS[r[2]]): (r[3], r[4]) for r in d["daily"]}
    assert daily[("2022-10-22", "BTMP", "event")] == (1, 10000.0), "the cancelled order is not a unit"
    assert daily[("2026-01-05", "MCE", "post")] == (1, 7000.0)
    assert daily[("2026-02-01", "MCE", "other")] == (1, 3000.0), "HEAVEN_DATE wins over DATE"
    assert len(d["daily"]) == 4


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print("ok  ", name)
