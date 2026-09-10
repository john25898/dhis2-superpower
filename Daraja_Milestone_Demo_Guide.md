# Daraja FAA Milestone Tracker — Demo Guide (2026-09-10) · SIMPLE STEP-BY-STEP

## 0. Read this first — the ONLY 4 things you do, over and over

For EVERY milestone below you do the same 4 moves inside **Pivot Tables** (the grid icon in CHAK DHIS2):

1. **SEARCH** — type one short code into the search box.
2. **FIND** — a list of rows appears under it.
3. **PUSH** — tick the rows named in the milestone (ticked items go to the other side / become table columns).
4. **READ** — each pushed item shows its own number (its total across the 259 facilities). Add / divide as the milestone says.

Set up once before the first milestone:
- **Period** = **August 2026** (the month shown on the tracker chip).
- **Organisation units** = the **259 Daraja facilities** (drill Embu · Meru · Nyandarua · Tharaka-Nithi and tick them, or tick the "Daraja – FAA" group if CHAK admin has created it — do NOT tick a whole county, that adds extra facilities).
- Nothing else on the table.

> SAME-NAME TRAP: some rows share a name (e.g. "Tx_ML"). Every line below that is risky shows the item's **code in brackets** — tick the row whose code matches. Code shown = same item, zero doubt.

---

## 1. The one-line story

> "The tracker now reads **live MOH 731 data from CHAK DHIS2** across the **259 Daraja facilities** and converts each milestone's actual performance into the **Performance %** and the **Earned $** (monthly schedule amount × unlock %). It matches facility-by-facility by the national **MFL code**, and it **auto-refreshes** so new data flows in without a restart."

## 2. Before you start

1. Server: `python run_flask.py 5100` (from `train/`).
2. Open `http://127.0.0.1:5100/#/milestone_tracker`.
3. Fresh numbers right before the demo: open `http://127.0.0.1:5100/api/milestone/data?refresh=1` in a tab, then reload the tracker.
4. Top-right chip shows the data month: `📡 KHIS baseline · August 2026 · 259 Daraja facilities`.

## 3. "Is this September?" (boss question)

- CHAK facilities report **after** a month closes → the newest full month is **August 2026** (September is still being entered).
- When September data appears, the tracker **moves to September by itself** on the next refresh. Nothing to change.
- So in the pivot use the **month shown on the chip** (today: August 2026).

---

## 4. THE SIX DHIS2 MILESTONES — search / find / push / read / calculate

> Every milestone below now uses the **official CHAK DHIS2 indicator** (not a hand-built list of data elements). Same 4 moves — but usually just **one search code and one or two ticks**.

### #6 · HIV Case Identification — tracker says **26.5% → Earn $0**

1. **SEARCH:** `HTS_TST`
2. **PUSH — the ONE official indicator `HTS_TST : Numerator` [`MSdR6p2OEmx`]** (the *indicator* list sits above the data-element list in the search results — pick the indicator).
3. **SEARCH again:** `HTS_TST_POS` → **PUSH the ONE indicator `HTS_TST_POS : Numerator` [`smzxVpKXbR5`]**.
4. **READ:** tested = **5,718** · positive = **107**.
5. **CALCULATE:** 5,718 ÷ target 21,584 = **26.5%**  ·  107 ÷ target 306 = 35.0%  ·  the milestone % = the **smaller = 26.5%**.
6. **MATCHES:** 26.5% is under the 70% band → **Unlock 0% → Earned $0**.
   *Say: "5,718 people tested and 107 positive in August. The monthly target is 21,584 tests — we're at 26%, so no payment yet."*

### #7 · Linkage to ART — tracker says **91.6% → Earn $8,300 (90% band)**

1. **SEARCH:** `TX_NEW` → **PUSH — the row `TX_NEW: Starting ART` [`vTTEybkXZ53`]** (skip any `TX_NEW_TOTAL` / cumulative row).
2. **SEARCH:** `HTS_TST_POS` → **PUSH** `HTS_TST_POS : Numerator` [`smzxVpKXbR5`] (same one as #6).
3. **READ:** TX_NEW = **98** · positive = **107**.
4. **CALCULATE:** 98 ÷ 107 = **91.6%**
5. **MATCHES:** 91.6% falls in the **85–94% band → Unlock 90% → Earned $8,300** (the $9,222 M1 amount × 0.90).
   *Say: "98 of the 107 newly-diagnosed were started on ART — 91.6%. That's the 90% band, so we earn 90% of the monthly amount."*

### #8 · PrEP Initiation — tracker says **23.0% → Earn $0**

1. **SEARCH:** `PrEP_New`
2. **PUSH — the ONE row `PrEP_New: PrEP, New Clients` [`VIg3ciXYUQn`]** (skip every `PREP_ALLMod …` row — they sit at zero for these facilities).
3. **READ:** **112** new PrEP clients.
4. **CALCULATE:** 112 ÷ target 486 = **23.0%** (486 = the 2,918 six-month target ÷ 6).
5. **MATCHES:** 23.0% is under the 70% band → **Unlock 0% → Earned $0**.
   *Say: "112 people started PrEP in August against a 486/month target — 23%. Note August is only about half-reported; on the **six-month cumulative** we're at **86% (2,519 of 2,918)**."*
   > ⚠ August is a part-reported month (39 of 259 facilities filed). Jul was 516. Flag the anchor choice to the manager.

### #9 · Retention / IIT — tracker says **0.86% → Earn $48,562 (full)** — LOWER IS BETTER

1. **SEARCH:** `TX_CURR` → **PUSH — the row named exactly `TX_CURR` [`kgzd9LfXZXq`]** (skip TX_CURR New / TX_CURR_Total).
2. **SEARCH:** `Tx_ML` → **PUSH — the row `C&T (facility) - Tx_ML, Outcomes` [`bv9nAL9x5Q5`]**, then expand its **Outcome** category and read **only** the three `Interruption in Treatment …` options.
   - ⚠ Do NOT use `Tx_ML, COD` [`G9HTTIls3L6`] — that is *Cause of Death*, not a treatment interruption.
   - ⚠ DHIS2 cannot filter a single category option in the address bar; expand the category in Pivot Tables and read the Interruption rows only.
3. **READ:** TX_CURR (June = the quarter close) = **40,929** on ART · IIT (Aug) = **354**.
4. **CALCULATE:** 354 ÷ (40,929 + 309 started on ART in Jul+Aug = **41,238**) = **0.86%**. Ceiling is **2.0%**.
5. **MATCHES:** 0.86% is under 2.0% → **Unlock 100% → Earned $48,562** (full).
   *Say: "354 of 41,238 on ART (0.86%) had a treatment interruption — well under the 2% ceiling. Fully earned."*

### #15 · TB Preventive Therapy — tracker says **94.6% → Earn $38,932 (full)**

1. **SEARCH:** `TB_PREV`
2. **PUSH — the TWO official indicator rows:**
   - `TB_PREV Numerator Total` [`D73JcPGIIIA`] = **initiated on TPT**
   - `TB_PREV Denominator Total` [`cJoXKb6p94M`] = **eligible for TPT**
3. **READ:** numerator = **70** · denominator = **74**
4. **CALCULATE:** 70 ÷ 74 = **94.6%**
5. **MATCHES:** ≥ 90% → **Unlock 100% → Earned $38,932** (full).
   *Say: "70 of the 74 eligible PLHIV were started on TPT — 94.6%, above the 90% bar. Fully earned."*
   > ⚠ The old tracker divided the **TPT TX_Curr** indicator by TX_CURR — that is a TPT *volume* measure (≈9%) and NOT what the FAA asks. The FAA asks for the share of **eligible** clients initiated on TPT, which is exactly the `TB_PREV` pair above. This is the corrected source.

### #16 · Viral Load Suppression — tracker says **96.0% → Earn $44,402 (full)**

1. **SEARCH:** `TX_PVLS`
2. **PUSH — tick the 2 ROUTINE rows** (skip the Non-Routine ones):
   - `VL Monitoring (All): TX_PVLS (D) Routine` [`JGd3MwmKBuM`] = **VL done**
   - `VL Monitoring (All): TX_PVLS (N) Routine` [`FloZph8hN9z`] = **VL suppressed**
3. **READ:** done = **21,326** · suppressed = **20,483**
4. **CALCULATE:** 20,483 ÷ 21,326 = **96.0%**
5. **MATCHES:** ≥ 95% → **Unlock 100% → Earned $44,402** (full).
   *Say: "96.0% of patients with a viral load result are suppressed — above the 95% target. Fully earned."*
   > ⚠ FAA note: #16 is verified **with a 2-quarter measurement lag**. The workbook's 96.22% is the **May 2026** value; the live tracker shows the newest month (96.0%). Both are ≥95% → identical unlock.

---

## 5. Quick-reference (August 2026 · 259 facilities)

| # | Milestone | Search codes (official indicators / elements) | Aug totals | % | Unlock | Earned (M1) |
|---|-----------|-----------------------------------------------|------------|-----|--------|-------------|
| 6 | Case ID | `HTS_TST : Numerator` [`MSdR6p2OEmx`] + `HTS_TST_POS : Numerator` [`smzxVpKXbR5`] | 5,718 / 107 | 26.5% | 0% | $0 |
| 7 | Linkage | `TX_NEW: Starting ART` [`vTTEybkXZ53`] + `HTS_TST_POS : Numerator` [`smzxVpKXbR5`] | 98 / 107 | 91.6% | 90% | **$8,300** |
| 8 | PrEP | `PrEP_New: PrEP, New Clients` [`VIg3ciXYUQn`] | 112 | 23.0% | 0% | $0 |
| 9 | Retention | `TX_CURR` [`kgzd9LfXZXq`] + `Tx_ML, Outcomes` [`bv9nAL9x5Q5`] (Interruption only) | 354 / 41,238 | 0.86% | 100% | **$48,562** |
| 15 | TPT | `TB_PREV Numerator Total` [`D73JcPGIIIA`] ÷ `TB_PREV Denominator Total` [`cJoXKb6p94M`] | 70 / 74 | 94.6% | 100% | **$38,932** |
| 16 | VL | `TX_PVLS` (2 Routine) [`JGd3MwmKBuM`, `FloZph8hN9z`] | 20,483 / 21,326 | 96.0% | 100% | **$44,402** |
| — | 11 · 14 | not available in DHIS2 → GOR verifies from documents | — | — | — | manual |

## 5b. Which facilities are covered (the wiring audit)

- The tracker pulls **all 259 Daraja facilities in a single query**. Verified: the app's exact call returns **14,256 rows across exactly 259 distinct org units** — byte-identical to querying the facilities one-by-one in chunks. **No facility is dropped.**
- The census is clean: `Site_Census - Daraja.xlsx` has **259 MFL codes, zero duplicates, and 259/259 match a DHIS2 org unit**. The tracker joins on the national **MFL code**, not on names.
- All 259 sit at **level 5**, under ~130 wards and **15 counties** (Meru 79 · Embu 50 · Nyandarua 47 · Tharaka-Nithi 33 · Kitui 14 · Kiambu 11 · others 25). Those counties hold **6,107 level-5 sites — only our 259 are in scope**, so ticking a whole county in a pivot would over-count. Use the facility list (or the Daraja group if CHAK creates one).
- **Thin coverage is a reporting issue, not a wiring bug.** Of 259 facilities, the number that filed in the last 12 months: TX_CURR 159 · HTS tested 195 · HTS positive 175 · TX_NEW 152 · PrEP 116 · VL 150 · **TB_PREV only 48** · IIT 197. Three facilities (`S4GqmehPtUY`, `qofxRUgcFyD`, `sijQjq4rhfT`) have filed **nothing at all**.
- ⚠ **The anchor month matters:** TX_CURR is most complete in **July 2026 (158 filers)**; **August 2026 has only 126 filers**, which is why #6/#8 look low. The tracker currently uses the newest month. **Recommendation to the manager:** anchor on the last *well-reported* month (July) or use the six-month cumulative.

## 6. Why only the M1 tab has numbers (M2–M6 show "—")

- The August baseline is attached to **M1 only**, as a **test of the indicator wiring** (treat M1 as "assume August" for now).
- **M2–M6 show "—" on purpose** — GOR must verify each real project month before numbers are entered. Nothing is copied forward or faked.
- The rows that always show "—" are **deliverable-based** (workplans, reports, DSD, eVTP, SHA, final pay) — GOR verifies them from submitted documents, not DHIS2.
- **#11 (AHD) and #14 (TB/HIV) are deliberately NOT wired:** we checked every candidate in DHIS2 and there is **no data element and no official indicator** that measures "% of PLHIV with AHD assessed" or "% of PLHIV screened for TB". The only TB-screening element counts **all** OPD patients (it returns 153–250% of everyone on ART — impossible for a PLHIV-only measure). Both milestones' means of verification are *TaifaCare/KenyaEMR, registers, TIBU, NDWH* + a **GOR desk review** — i.e. **document-based, not DHIS2**. They stay as GOR-verified/manual entries.

## 7. "Proof it's live" moment (2 minutes)

1. Tracker → click **M1** → show the six rows with numbers (6–9, 15, 16) + chip `August 2026 · 259`.
2. Pivot Tables (same month + 259 facilities) → do **#9** (2 search codes, 2 ticks) → grand totals **40,929** (TX_CURR) and **354** (IIT) match the tracker.
3. Do **#16** (1 search code, 2 ticks) → **21,326** and **20,483** → 96.0% matches.
4. Do **#15** (1 search code, 2 ticks) → **70** and **74** → 94.6% matches.
5. Click **M2** in the tracker → the same rows now read "—" (nothing pre-faked for future months).
6. Wow: edit a facility's August number in DHIS2 → hit `?refresh=1` → reload → the % moves.
