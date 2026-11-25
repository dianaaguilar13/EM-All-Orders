# EM-All-Orders
Dashboards that require historical data and more detailed, granular insights.

## EVENTS tab

Event and post-event budget vs results, programs sold per event, and where each program sells
(at the event, in the post, elsewhere). Same rules as the new dashboard.

* **Budgets and results** come from the EVENT & POST Google Sheet. **Programs sold** come from the orders:
  an event sale has a referral code `EV_YYYY_MM_<event>`; a post sale is an Enrollment Mentor code with `PV` or `50`
  in it (approximate, since the sheet attaches post sales to a post lead).
* **Connect the sheet** (once). Share it "anyone with the link can view", then either:
  * add to `secrets.json` (already git-ignored): `"events_sheet_id": "<id from the sheet URL>"`, and optionally
    `"events_sheet_gid": "<number after gid= in the URL>"` or `"google_api_key": "<key>"` (Sheets API), **or**
  * save the EVENT & POST tab as `events-sheet.csv` next to `refresh_bti_data.py` (File > Download > CSV).
* `Run.bat` rebuilds `events_data.json` with the other reports. If the sheet cannot be read, the run says so and keeps
  the previous `events_data.json`; the other reports are not affected.
* A moved sheet column stops the EVENTS step with a clear message instead of showing wrong numbers.
* Event codes that match no row in the sheet are listed on the tab (a missing sheet row shows up there).
* Check: `python test_events_build.py`.
