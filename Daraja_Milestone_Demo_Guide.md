# Daraja FAA Milestone Tracker — Boss Demo Guide (2026-09-09)

## 1. The one-line story

> "The tracker now reads **live MOH 731 data from CHAK DHIS2** across the **259 Daraja facilities** and converts each milestone's actual performance into the **Performance %** and the **Earned $** (schedule amount × unlock %). It matches facility-by-facility by the national **MFL code**, and it **auto-refreshes** so new data-entry flows in without a restart."

## 2. Before you start

1. Server is running: `python run_flask.py 5100` (from `train/`).
2. Open `http://127.0.0.1:5100/#/milestone_tracker`.
3. For a truly fresh pull right before the demo:
   - Easy: hit `http://127.0.0.1:5100/api/milestone/data?refresh=1` once in a browser tab, then reload the tracker page.
   - Or run the server with a short TTL so it self-refreshes during the demo:
     `$env:MILESTONE_CACHE_TTL="60"; python run_flask.py 5100` (default is 300 s).
4. The blue chip top-right shows the month the numbers come from:
   `📡 KHIS baseline · <month> · 259 Daraja facilities`.

## 3. The period question (boss will ask "is this September?")

- The tracker uses the **most recent month in which the 259 facilities have actually submitted data** (rule: latest month with TX_CURR > 0). Today that is **August 2026** — September data is not in yet because facilities report after the month closes.
- **Once September numbers start appearing in CHAK DHIS2, the tracker advances to September automatically** on its next refresh. Nothing to change.
- So when comparing against a pivot: **use the exact month shown on the chip** (August 2026 today). If the boss asks "why not September?" the answer is above — it self-advances.

## 4. Facilities in the pivot — EXACT steps (do this once, before milestone checks)

- The tracker joins the census MFL codes to CHAK org units → 259 facilities. **There is no "Daraja" org-unit group yet**, so the pivot must select facilities one of these two ways:

  - **Best (recommend to CHAK admin — one click afterwards):** create an org-unit group "Daraja – FAA" from the census roster (we can supply the list of MFL codes + org-unit UIDs). Then in Pivot Tables: **Organisation units → Groups** → tick **Daraja – FAA**.
  - **Works today (no admin needed):** **Organisation units → select level → Facility** → use the **name search box** and drill each county: **Embu, Meru, Nyandarua, Tharaka-Nithi**. Tick **only** the Daraja facilities in the roster. ⚠️ Selecting a whole **county** is **over-inclusive** — it adds non-Daraja facilities, so never use county-only for an exact check.

- **Layout for EVERY check below (same each time):**
  1. Open **Pivot Tables** (grid icon, top-right under the app menu).
  2. **Data items** (left panel) → type the exact search string from the milestone below → **tick the listed items** (tick exactly those named; verify against the name in the list).
  3. **Organisation units** (left panel) → select the 259 Daraja facilities as above.
  4. **Period** → set the month shown on the chip (today: **August 2026**).
  5. Do **not** add anything else to rows/columns → the **grand total** cell is the tracker number.
  - Optional but safest cross-check: tick the item, look at its small code shown in the panel (or hover) and compare to the **UID in brackets** in section 5 — identical code = identical item, zero ambiguity.

## 5. Milestone-by-milestone — EXACT search string + which items to tick

> The names below are copied verbatim from CHAK DHIS2 (ereporting) — type the **search string**, then tick the items whose **full name** appears in the "tick these" list. Count the ticks: the lists are sized so you can immediately see if one is missing or extra.

### #6 — HIV Case Identification (Tier 1, monthly)

- **What it measures:** volume of people tested and positives found, vs FAA monthly targets (21,584 tested / 306 positive).
- **Search string 1:** `HTS_TST` → tick the **8** items whose name **ends in `- HIV Testing`** (skip anything ending "- Positive", "- Linked within", "- Linked outside Facility"):
  1. `HTS_TST (facility) - Malnutrition clinic - HIV Testing`
  2. `HTS_TST (facility) - Other PITC - HIV Testing`
  3. `HTS_TST (facility) - PITC Emergency - HIV Testing`
  4. `HTS_TST (facility) - PITC Inpatient Services - HIV Testing`
  5. `HTS_TST (facility) - PITC Pediatric Services - HIV Testing`
  6. `HTS_TST (facility) - STI clinic - HIV Testing`
  7. `HTS_TST (facility) - TB Clinic - HIV Testing`
  8. `HTS_TST (facility) - VCT - HIV Testing`
- **Search string 2:** `HV01-19` → tick the single item `MOH731_HV01-19` (positive tests).
- **Read from grand totals:** tested = sum of the 8 items; positive = HV01-19.
- **Expected August 2026 (the tracker's M1 test month):** tested **2,575**, positive **43**.
- **Calculate:** `% = min(tested ÷ 21,584, positives ÷ 306) × 100` → min(11.9%, 14.1%) = **11.9%** → below the 70% band → **Unlock 0% → Earned $0**.
- **Say:** "We found 2,575 people tested and 43 HIV-positive across Daraja. The FAA target needs 21,584 tests a month, so we're at ~12% of the volume target — no payment unlocks yet."

### #7 — Linkage of HIV Positive Clients to ART (Tier 2, monthly)

- **What it measures:** % of newly diagnosed positives linked to ART — target ≥95%.
- **Search string 1:** `Linked within` → tick the **3** items **ending exactly `- Linked within`**:
  1. `HTS_TST (facility) - Malnutrition clinic - Linked within`
  2. `HTS_TST (facility) - Other PITC - Linked within`
  3. `HTS_TST (facility) - PITC Emergency - Linked within`
- **Search string 2:** `Linked outside` → tick the **3** items **ending exactly `- Linked outside Facility`**:
  1. `HTS_TST (facility) - Malnutrition clinic - Linked outside Facility`
  2. `HTS_TST (facility) - Other PITC - Linked outside Facility`
  3. `HTS_TST (facility) - PITC Emergency - Linked outside Facility`
- **Search string 3:** `HV01-19` → tick `MOH731_HV01-19` (same as #6; already ticked, no need to add twice).
- **Read from grand totals:** linked = (within sum) + (outside sum); positive = HV01-19.
- **Expected August 2026:** linked **42** of **43**.
- **Calculate:** `% = (linked within + linked outside) ÷ positive × 100` = **97.7%** → ≥95% → **Unlock 100% → full monthly amount**.
- **Say:** "42 of the 43 people newly diagnosed were linked into ART — that's 97.7%, above the 95% target, so this milestone is fully earned this month." (Note: it looked poor at ~72% before the 19 recovered facilities were added — this is why exact facility matching matters.)

### #8 — PrEP Initiation (Tier 1, monthly)

- **What it measures:** new PrEP starts vs FAA monthly target (486/mo).
- **Search string:** `PREP_ALLMod` → tick the **15** items whose name **ends in `New F` or `New M`** (i.e. the word "New" is present — skip all the "Cum"/cumulative and other rows). Tick exactly these 15:
  1. `PREP_ALLMod CCC New F` · 2. `PREP_ALLMod CCC New M`
  3. `PREP_ALLMod Community DSD New F` · 4. `PREP_ALLMod Community DSD New M`
  5. `PREP_ALLMod IPD New F` · 6. `PREP_ALLMod IPD New M`
  7. `PREP_ALLMod MNCH BF New F` · 8. `PREP_ALLMod MNCH New M` · 9. `PREP_ALLMod MNCH PG New F`
  10. `PREP_ALLMod OPD New F` · 11. `PREP_ALLMod OPD New M`
  12. `PREP_ALLMod PNS SNS New F` · 13. `PREP_ALLMod PNS SNS New M`
  14. `PREP_ALLMod TB New F` · 15. `PREP_ALLMod TB New M`
- **Read from grand total:** PrEP new = sum of the 15.
- **Expected August 2026:** **92**.
- **Calculate:** `% = PrEP new ÷ 486 × 100` = **18.9%** → below the 70% band → **Unlock 0% → Earned $0**.
- **Say:** "92 people started PrEP in August against a 486/month target — 19%. Below the payment band."

### #9 — HIV Care, Treatment Continuity & Retention (Tier 1, monthly)

- **What it measures:** treatment interruptions (IIT) as a % of patients on ART — **lower is better**; target < 2.0%.
- **Search string 1:** `TX_CURR` → tick the single item `TX_CURR` (active ART patients).
- **Search string 2:** `Tx_ML` → tick **only** `C&T (facility) - Tx_ML, COD` (this is the IIT-total element — interruptions including deaths; do **not** tick `Tx_ML, Outcomes` or any other Tx_ML row).
- **Read from grand totals:** TX_CURR = as ticked; IIT = Tx_ML, COD.
- **Expected August 2026:** **17** interrupted of **21,732** on ART.
- **Calculate:** `IIT% = Tx_ML ÷ TX_CURR × 100` = **0.08%** → under the 2.0% ceiling → **Unlock 100% → full monthly amount**.
- **Say:** "Of 21,732 patients on ART across Daraja, only 17 (0.08%) had a treatment interruption — far below the 2% ceiling, so fully earned."

### #15 — TB Preventive Therapy (Tier 1, monthly)

- **What it measures:** TPT coverage (proxy: TPT ÷ TX_CURR — the DHIS2 TPT *indicator* sums all TPT modalities); target 90% of eligible (the app uses the TX_CURR proxy).
- **Search string:** `TPT TX_Curr` → tick the single **indicator** `TPT TX_Curr  Total` (note the two spaces between "TX_Curr" and "Total" — the *indicator*, not a data element).
- **Search string (denominator):** `TX_CURR` → tick `TX_CURR` (already ticked from #9 if on the same pivot).
- **Expected August 2026:** **285** on TPT of **21,732** TX_CURR.
- **Calculate:** `% = TPT ÷ TX_CURR × 100` = **1.3%** → below the 60% band → **Unlock 0% → Earned $0**.
- **Say:** "TPT initiation is still low — 285 patients on TPT against ~21.7k on ART. This is an area needing a push; no unlock this month."

### #16 — Viral Load Suppression (Tier 1, monthly)

- **What it measures:** % suppressed among PLHIV with a documented VL — target ≥95%.
- **Search string:** `TX_PVLS` → tick the **2** items that contain the word **Routine** (skip the Non-Routine rows):
  1. `VL Monitoring (All): TX_PVLS (D) Routine` → VL **done**
  2. `VL Monitoring (All): TX_PVLS (N) Routine` → VL **suppressed**
- **Expected August 2026:** **15,682** suppressed of **16,374** done.
- **Calculate:** `% = suppressed ÷ done × 100` = **95.8%** → ≥95% → **Unlock 100% → full monthly amount**.
- **Say:** "95.8% of patients with a viral load this month are suppressed — above the 95% target. Fully earned."

## 6. Quick-reference table (expected — August 2026 · 259 facilities)

| Milestone    | Numerator             | Denominator         | %     | Unlock |
| ------------ | --------------------- | ------------------- | ----- | ------ |
| #6 Case ID   | 2,575 tested / 43 pos | 21,584 / 306 target | 11.9% | 0%     |
| #7 Linkage   | 42 linked             | 43 positive         | 97.7% | 100%   |
| #8 PrEP      | 92 new                | 486 target          | 18.9% | 0%     |
| #9 Retention | 17 IIT                | 21,732 TX_CURR      | 0.08% | 100%   |
| #15 TPT      | 285 TPT               | 21,732 TX_CURR      | 1.3%  | 0%     |
| #16 VL       | 15,682 supp           | 16,374 done         | 95.8% | 100%   |

## 7. Why the numbers appear in M1 only — and M2–M6 show "—"

- The live DHIS2 baseline is attached to the **M1 tab only**, as a **test of the indicator wiring** (M1 is being treated as "assume August" for now).
- **M2–M6 deliberately show "—"** — the same August baseline is **not** copied into future months, because those months' confirmed performance has to be **verified by GOR** (actual reports + deliverables for Sep/Oct/Nov/Dec/Jan), not guessed from August.
- So during the demo: click **M1** → the six DHIS2 milestones (6–9, 15, 16) show Performance % and Earned $; click **M2, M3, M4, M5 or M6** → those same rows show **—** until each project month is verified and its real numbers are entered.
- The 19 rows that always show **—** for Performance/Earned are **deliverable-based** (workplans, reports, DSD enrolment, AHD, eVTP cascade, SHA, final pay, etc.). They are verified by **GOR against submitted deliverables/artefacts**, not by DHIS2.

## 8. "Proof it's live" moment

1. Open the tracker → click **M1** → note `baseline · August 2026 · 259` and the six rows with numbers (ids 6–9, 15, 16).
2. Open CHAK DHIS2 **Pivot Tables** with the month + the 259 facilities per section 4 → search each milestone's items per section 5 → the grand-total numbers match the table above.
3. Then click **M2** → show that the same rows now read **—** (nothing is pre-faked for future months).
4. Optional wow: if a facility enters/edits data in DHIS2, hit `?refresh=1` (or wait the TTL) → reload → the % moves.
