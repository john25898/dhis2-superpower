# Daraja FAA Milestone Tracker — Demo Guide (2026-09-09) · SIMPLE STEP-BY-STEP

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

## 4. THE SIX MILESTONES — search / find / push / read / calculate

### #6 · HIV Case Identification — tracker says **11.9% → Earn $0**

1. **SEARCH:** `HTS_TST`
2. **FIND:** many rows all starting `HTS_TST (facility) -`
3. **PUSH — tick exactly these 8** (all END with `- HIV Testing`; skip every row ending Positive / Linked within / Linked outside Facility):
   Malnutrition clinic · Other PITC · PITC Emergency · PITC Inpatient Services · PITC Pediatric Services · STI clinic · TB Clinic · VCT
4. **READ:** 8 columns appear. **Add all 8 columns = 2,575** people tested. (Tracker shows "2,575 tested")
5. **SEARCH again:** `HV01-19` → **FIND:** 1 row `MOH731_HV01-19` → **PUSH it** → **READ:** **43** positive. (Tracker: "43 positive")
6. **CALCULATE:** tested 2,575 ÷ target 21,584 = **11.9%**  ·  positive 43 ÷ target 306 = 14.1%  ·  the milestone % = the **smaller = 11.9%**
7. **MATCHES:** 11.9% is under the 70% band → **Unlock 0% → Earned $0**.
   *Say: "2,575 people tested, 43 positive. Target is 21,584 tests/month — we're at ~12%, so no payment yet."*

### #7 · Linkage to ART — tracker says **97.7% → Earn $9,222 (full)**

1. **SEARCH:** `Linked within`
2. **PUSH — tick the 3** rows ending `- Linked within`: Malnutrition clinic · Other PITC · PITC Emergency
3. **SEARCH:** `Linked outside` → **PUSH — tick the 3** rows ending `- Linked outside Facility`: Malnutrition clinic · Other PITC · PITC Emergency
4. **SEARCH:** `HV01-19` → **PUSH** `MOH731_HV01-19` (same 43 as #6)
5. **READ:** add the 6 "Linked" columns = **42** linked. HV01-19 column = **43** positive.
6. **CALCULATE:** 42 ÷ 43 = **97.7%**
7. **MATCHES:** 97.7% is ≥ 95% → **Unlock 100% → Earned $9,222** (the full M1 amount for #7).
   *Say: "42 of 43 newly-diagnosed people were linked to ART — 97.7%, above the 95% target, fully earned."*

### #8 · PrEP Initiation — tracker says **18.9% → Earn $0**

1. **SEARCH:** `PREP_ALLMod`
2. **FIND:** rows `PREP_ALLMod …` (there are also "Cum" totals — skip those)
3. **PUSH — tick exactly these 15** (every row that ends `New F` or `New M`):
   CCC New F+M · Community DSD New F+M · IPD New F+M · MNCH BF New F · MNCH New M · MNCH PG New F · OPD New F+M · PNS SNS New F+M · TB New F+M
4. **READ:** **add all 15 columns = 92** (Tracker: "92 PrEP initiations")
5. **CALCULATE:** 92 ÷ target 486 = **18.9%**
6. **MATCHES:** under 70% band → **Unlock 0% → Earned $0**.
   *Say: "92 people started PrEP vs a 486/month target — 19%, below the payment band."*

### #9 · Retention / IIT — tracker says **0.08% → Earn $48,562 (full)** — LOWER IS BETTER

1. **SEARCH:** `TX_CURR` → **PUSH — the row named exactly `TX_CURR` [`kgzd9LfXZXq`]** (skip TX_CURR New / TX_CURR_Total)
2. **SEARCH:** `Tx_ML` → **PUSH — only the row `C&T (facility) - Tx_ML, COD` [`G9HTTIls3L6`]** (skip `Tx_ML, Outcomes` and any other Tx_ML row)
3. **READ:** TX_CURR = **21,732** on ART · Tx_ML, COD = **17** interrupted
4. **CALCULATE:** 17 ÷ 21,732 = **0.08%** (0.1% shown). Ceiling is **2.0%**.
5. **MATCHES:** 0.08% is under 2.0% → **Unlock 100% → Earned $48,562** (full).
   *Say: "Only 17 of 21,732 on ART (0.08%) had a treatment interruption — well under the 2% ceiling. Fully earned."*

### #15 · TB Preventive Therapy — tracker says **1.3% → Earn $0**

1. **SEARCH:** `TPT TX_Curr`
2. **PUSH — the single indicator row `TPT TX_Curr  Total` [`dysZutXWPTz`]** (note TWO spaces; it is an *indicator*, under a different tab than data elements — it sits in the search results with the others)
3. **SEARCH:** `TX_CURR` → **PUSH** the same `TX_CURR` [`kgzd9LfXZXq`] as #9 (skip if already pushed)
4. **READ:** TPT = **285** · TX_CURR = **21,732**
5. **CALCULATE:** 285 ÷ 21,732 = **1.3%**
6. **MATCHES:** under 60% band → **Unlock 0% → Earned $0**.
   *Say: "TPT is still low — 285 patients on TPT against ~21.7k on ART. Needs a push; no unlock."*

### #16 · Viral Load Suppression — tracker says **95.8% → Earn $44,402 (full)**

1. **SEARCH:** `TX_PVLS`
2. **PUSH — tick the 2 ROUTINE rows** (skip the Non-Routine ones):
   - `VL Monitoring (All): TX_PVLS (D) Routine` [`JGd3MwmKBuM`] = **VL done**
   - `VL Monitoring (All): TX_PVLS (N) Routine` [`FloZph8hN9z`] = **VL suppressed**
3. **READ:** done = **16,374** · suppressed = **15,682**
4. **CALCULATE:** 15,682 ÷ 16,374 = **95.8%**
5. **MATCHES:** ≥ 95% → **Unlock 100% → Earned $44,402** (full).
   *Say: "95.8% of patients with a viral load are suppressed — above the 95% target. Fully earned."*

---

## 5. Quick-reference (August 2026 · 259 facilities)

| # | Milestone | Search codes | Aug totals | % | Unlock | Earned (M1) |
|---|-----------|--------------|------------|-----|--------|-------------|
| 6 | Case ID | `HTS_TST`(8) + `HV01-19` | 2,575 tested / 43 pos | 11.9% | 0% | $0 |
| 7 | Linkage | `Linked within`(3) + `Linked outside`(3) + `HV01-19` | 42 / 43 | 97.7% | 100% | **$9,222** |
| 8 | PrEP | `PREP_ALLMod`(15 New) | 92 | 18.9% | 0% | $0 |
| 9 | Retention | `TX_CURR` + `Tx_ML, COD` | 17 / 21,732 | 0.08% | 100% | **$48,562** |
| 15 | TPT | `TPT TX_Curr` + `TX_CURR` | 285 / 21,732 | 1.3% | 0% | $0 |
| 16 | VL | `TX_PVLS`(2 Routine) | 15,682 / 16,374 | 95.8% | 100% | **$44,402** |

## 6. Why only the M1 tab has numbers (M2–M6 show "—")

- The August baseline is attached to **M1 only**, as a **test of the indicator wiring** (treat M1 as "assume August" for now).
- **M2–M6 show "—" on purpose** — GOR must verify each real project month before numbers are entered. Nothing is copied forward or faked.
- The rows that always show "—" are **deliverable-based** (workplans, reports, DSD, AHD, eVTP, SHA, final pay) — GOR verifies them from submitted documents, not DHIS2.

## 7. "Proof it's live" moment (2 minutes)

1. Tracker → click **M1** → show the six rows with numbers (6–9, 15, 16) + chip `August 2026 · 259`.
2. Pivot Tables (same month + 259 facilities) → do **#9** (2 search codes, 2 ticks) → grand totals 21,732 and 17 match the tracker.
3. Do **#16** (1 search code, 2 ticks) → 16,374 and 15,682 → 95.8% matches.
4. Click **M2** in the tracker → the same rows now read "—" (nothing pre-faked for future months).
5. Wow: edit a facility's August number in DHIS2 → hit `?refresh=1` → reload → the % moves.
