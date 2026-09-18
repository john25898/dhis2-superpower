# CHAK Metrics → DHIS2 Data Elements: the 62-Facility ("CHAP Stawisha") Dataset

**Source of truth:** `train/CHAK Visuals (3).pbix` (Power BI semantic model, decoded with `pbixray`).
**Machine-readable map:** `train/data/chak_metric_de_map.json`
**Roster of the 62:** `train/_pbix_new62.csv`

---

## 1. The root cause, in one line

The Daraja roster holds **259 facilities that report into TWO different DHIS2 "attribute option combos" (datasets)**:

| Project (AOC)                                                | DHIS2 AOC id  | Facilities | TX_CURR DE family                  |
| ------------------------------------------------------------ | ------------- | ---------- | ---------------------------------- |
| `84477 - USAID Jamii Tekelezi` — _the "previous" facilities_ | `T1rTe8Xa4CX` | **187**    | `kgzd9LfXZXq` ("TX_CURR")          |
| `85745 - CHAP Stawisha` — **the "62"**                       | `vZjyS5WF2aV` | **62**     | `aMp82zBYPnx` + 8 regimen-line DEs |

Cross-tab of the 259 Daraja OUs at period **202607**:

- previous-only (Jamii): **158**
- 62-only (Stawisha): **62**
- reporting under neither: **39** (inactive)
- **reporting under both: 0** — the split is perfectly clean, so summing both namespaces can never double-count.

The app currently queries **only the Jamii Tekelezi data elements**. Every one of them returns **0** for the 62 facilities — that is why those facilities look empty.

### Live proof against CHAK DHIS2 (Maua Methodist Hospital, OU `pnELrefcHxQ`, period `202607`)

```
NEW-62   TX_CURR regimen-split DEs  -> 2,550   ✔ (8/8 DEs return data)
NEW-62   TX_CURR aMp82zBYPnx        -> 2,550   ✔
MHU tab  TX_CURR Patients on Care   -> 2,550   ✔  (tab is already wired correctly)
OLD      TX_CURR kgzd9LfXZXq        ->     0   ✘  (no data at all)
```

Maua's `kgzd9LfXZXq` has **zero rows**; the value 2,550 sits entirely under `aMp82zBYPnx` / the regimen-line DEs.

---

## 2. Which app data elements are wrong

| App spec                         | Current UID                                                   | Value for the 62 (202607)    | Verdict             |
| -------------------------------- | ------------------------------------------------------------- | ---------------------------- | ------------------- |
| `tx_curr.aggregate`              | `kgzd9LfXZXq`                                                 | 0                            | **MISSING**         |
| `tx_new.aggregate`               | `vTTEybkXZ53`                                                 | 0                            | **MISSING**         |
| `vl.aggregate` (D)               | `JGd3MwmKBuM`                                                 | 0                            | **MISSING**         |
| `vl.vl_pvls_n` (N)               | `FloZph8hN9z`                                                 | 0                            | **MISSING**         |
| `hts_tested[1,2,3,6]`            | `vFlUDposW0Y, XKAlilawdhN, THJbtDzxplR, XYhYAMivUX5`          | 0                            | **MISSING**         |
| `hts_positive`                   | `CcOr3MB7Mh4`                                                 | **44**                       | OK — already shared |
| `art_opt.*` (regimen lines, DTG) | `zZGNba5d34c`, `F0xtjHxDZ2e`, `Pk1PMmG4ml7`, `s62uidROGjG`, … | no data at all (any project) | dead DEs            |

Only **HTS positive** (`CcOr3MB7Mh4`, `MOH731_HV01-19`) is a shared UID that both projects report into.

---

## 3. ✅ The correct metrics & data elements for the 62 facilities

### 3.1 TX_CURR — currently on ART

Primary (simplest, exactly equals the split):

| UID           | Name                     |
| ------------- | ------------------------ |
| `aMp82zBYPnx` | TX_CURR Patients on Care |

Equivalent regimen-line split (use only if you need the treatment-regimen breakdown):

| UID           | Name                    |
| ------------- | ----------------------- |
| `wJ0vH5TRFHw` | TX_CURR on EFV          |
| `EgNQnR23En1` | TX_CURR on PI 1st line  |
| `KsDSjjJo6GD` | TX_CURR on PI 2nd line  |
| `VIz7xRli13H` | TX_CURR on RAL 1st line |
| `KEAYcGVL6Bk` | TX_CURR on RAL 2nd line |
| `qDjo1L1VfmP` | TX_CURR on Third Line   |
| `JOldQxWZWso` | TX_CURR on DTG 1st line |
| `HzXPYZqLgqj` | TX_CURR on DTG 2nd line |

> Sanity check (Maua, 202607): DTG-1st 2,373 + DTG-2nd 177 = 2,550 = `aMp82zBYPnx`. ✔

### 3.2 TX_NEW — newly started on ART

| UID           | Name               |
| ------------- | ------------------ |
| `Syg8KH15VW6` | TX_New CD4<200     |
| `gxEX3f1Wi4i` | TX_New CD4>200     |
| `r2X4WnVpKQG` | TX_New CD4 unknown |

_(The PBIX `TX_NEW` measure sums these three **together with** the Jamii-only `TX_NEW: Starting ART` family — a UNION, so summing both sides is safe.)_

### 3.3 VL Monitoring (TX_PVLS)

| Role                   | UID                                         | Name                      |
| ---------------------- | ------------------------------------------- | ------------------------- |
| Denominator            | `XfG4IcrxsAL`                               | VL results <50 cps/ml     |
| Denominator            | `ya8yqHMBz1z`                               | VL results 50-199 cps/ml  |
| Denominator            | `JkR9WcfccpF`                               | VL results 200-399 cps/ml |
| Denominator            | `Ub1rdwX3AQK`                               | VL results >1000 cps/ml   |
| Numerator (suppressed) | `XfG4IcrxsAL`, `ya8yqHMBz1z`, `JkR9WcfccpF` | (first three)             |

### 3.4 HTS — HIV Testing Services _Tested_ (28 DEs)

`FeL9n4JPBwR` PITC IPD HP Tested · `U5p3md08al7` PITC IPD NHP Tested ·
`z4SijuAuj8u` PITC OPD HP Tested · `EBUHaKNgr76` PITC OPD NHP Tested ·
`m0TGh0x0BKG` 1st ANC Post ANC1 Initial testing · `eIgi7HI0dHC` MAT Post ANC1 Initial Test ·
`EbemQ1YUsS4` PNC Post ANC1 Initial Test · `geC2CBzyQme` 1st ANC tested ·
`JEOphdexA5h` 2nd ANC Number Tested · `oRcQ7WvMSbg` MAT Post ANC1 Retesting ·
`GpUsEYocjeF` PNC Post ANC1 Retesting · `n1gIS3iRf5b` SNS NAss Tested AGYW ·
`iWTSCEnAzth` SNS NAss Tested AYP · `ZMvTVuvnujj` SNS NAss Tested GP ·
`sE6Fiu7oCWG` SNS NAss Tested FSW · `dkX4EY6cwl9` SNS NAss Tested MSM ·
`U60JE807fKl` SNS NAss Tested PWID · `Zc6u4IbiDtI` SNS NAss Tested PiP ·
`DR7CJrCb99O` SNS NAss Tested TG · `qfGXWJ4dyfq` PAEDS Tested ·
`lU61bvd4vFS` MALN Tested · `qrOHMHfq6vW` PITC TB Tested ·
`fan1vuTrnfZ` PITC VCT Tested · `lm2vXVEzxgd` PITC STI Tested ·
`WFBz2SqHikz` PITC EM Tested · `F2vqHaV3SIV` PITC PNS Contacts Tested ·
`DDYp26Y2pLU` PITC FT Contacts Tested · `j1Ovy0UzWKC` FP Tested

### 3.5 HTS — _Positive_ (28 DEs — positivity is embedded in the DE name, no COC filter needed)

`AqIZwh2gOUs` PITC IPD HP New Positive · `FNCubo2RFGW` PITC IPD NHP New Positive ·
`Cwn1ZLCXt6B` PITC OPD HP New Positive · `fryB6XsrdEX` PITC OPD NHP New Positive ·
`WgrVvWg6CEI` 1st ANC newly identified positive · `xZvJ5UT2EK2` 1st ANC Post ANC1 Initial testing positive ·
`BIQZfMkMzr6` 2nd ANC Newly Identified Positive · `ObNBXpybAaC` MAT Post ANC1 Initial HIV Positive ·
`FX0DHPMp83V` MAT Post ANC1 Retesting Positive · `BhnzHXFnEM3` PNC Post ANC1 Initial HIV Positive ·
`iOfdKICx6r9` PNC Post ANC1 Retesting Positive · `b6RjSYPtLvy` SNS NAss NP AGYW ·
`ztdFfMQWrSF` SNS NAss NP AYP · `S6KQd8Rmjad` SNS NAss NP GP ·
`doYJQ4Ieqc7` SNS NAss NP FSW · `g3NOJTsqayy` SNS NAss NP MSM ·
`LdO5qX5j238` SNS NAss NP PWID · `SBGWvCJYoHl` SNS NAss NP PiP ·
`wrU23YQYX0l` SNS NAss NP TG · `wuNiGmPCvjF` PAEDS Newly Identified Positive ·
`MADCCrhi2wC` MALN Newly Identified Positive · `jO8zNMIrakZ` PITC TB New Positive ·
`hzRWjr4PtME` PITC VCT New Positive · `BpItig3EWij` PITC STI New Positive ·
`R9mc3S56hWD` PITC EM New Positive · `jbyp2irkHnt` FP Newly positive ·
`KhG8T1IxFNF` PITC PNS Contacts New Positive · `HvXNwm2FiDE` PITC FT Contacts New Positive

### 3.6 PMTCT / ANC

| Metric             | UIDs                                                                     |
| ------------------ | ------------------------------------------------------------------------ |
| 1st ANC attendance | `ylYJBde9kjh` (1st ANC known positive), `coybVr4mYpf` (1st ANC eligible) |
| PMTCT known status | `ylYJBde9kjh`, `geC2CBzyQme` (1st ANC tested)                            |
| PMTCT positive     | `ylYJBde9kjh`, `WgrVvWg6CEI` (1st ANC newly identified positive)         |

### 3.7 PrEP

| Metric                                  | UIDs                                                     |
| --------------------------------------- | -------------------------------------------------------- |
| PrEP New (Pregnant/Breastfeeding women) | `KFp4UYTJ4Q6` (PREP New PG), `S8VvgOzJRkX` (PREP New BF) |

### 3.8 TB

| Metric        | UIDs                                                                                   |
| ------------- | -------------------------------------------------------------------------------------- |
| TB_STAT (Num) | `dBzqPLo74oR` (Known Positive), `uyUkKIQC2lA` (Known Negative), `qrOHMHfq6vW` (Tested) |
| TB_ART (Den)  | `dBzqPLo74oR`, `jO8zNMIrakZ` (PITC TB New Positive)                                    |

---

## 4. Age × Sex disaggregation — already correct

The 62's `aMp82zBYPnx` and the 8 regimen-line DEs carry **exactly the same 30 category option combos** as the Jamii `kgzd9LfXZXq`, and those are the same 30 COCs the MHU tab already uses (`TX_CURR_MALE_COCS` / `TX_CURR_FEMALE_COCS` in `train/js/mhu.js`).

| Sex | Age band | COC           |
| --- | -------- | ------------- |
| M   | <1       | `AwerOu6rx5q` |
| M   | 1-4      | `g2zP3yNwOOa` |
| M   | 5-9      | `WTfu1bBSG12` |
| M   | 10-14    | `X65JamO5tyb` |
| M   | 15-19    | `hKHprPKwjL6` |
| M   | 20-24    | `uSDHHGh2DZo` |
| M   | 25-29    | `sLaLEIDVusT` |
| M   | 30-34    | `b91xfEPrY4D` |
| M   | 35-39    | `EU7hVFz5Yyt` |
| M   | 40-44    | `AR2E4Yiuo8Z` |
| M   | 45-49    | `dfkyp7ZQZSr` |
| M   | 50-54    | `lswMoqT008e` |
| M   | 55-59    | `Z6zV5L8i14I` |
| M   | 60-64    | `XIc55yRW4aQ` |
| M   | 65+      | `g5bVF4b8hmV` |
| F   | <1       | `dcv8Lowu94w` |
| F   | 1-4      | `D2aMSzo7SEw` |
| F   | 5-9      | `HIS0TcFAoo8` |
| F   | 10-14    | `Rr3uh3eAvKi` |
| F   | 15-19    | `DYDpnZWu1XK` |
| F   | 20-24    | `m7Y0ddB212k` |
| F   | 25-29    | `qy1vJGvFJeB` |
| F   | 30-34    | `sk5UiD3PrxH` |
| F   | 35-39    | `Vb7KzTvF83C` |
| F   | 40-44    | `dchngmvBGvb` |
| F   | 45-49    | `VP1zCgdzuBb` |
| F   | 50-54    | `uefSjW3VtZr` |
| F   | 55-59    | `llt7APqVWyq` |
| F   | 60-64    | `gs3y2muDLIK` |
| F   | 65+      | `YAtW6LDL24J` |

**No COC change is required.** Only the _data element ids_ differ.

---

## 5. Expected effect of wiring this in (period 202607, whole Daraja roster of 259)

| Metric         | Now (app)                               | After fix                                    |
| -------------- | --------------------------------------- | -------------------------------------------- |
| TX_CURR        | 16,442 (Meru only) / 40,900 (all-Jamii) | **~81,900** (Jamii 40,900 + Stawisha 41,028) |
| TX_NEW         | 210                                     | **331** (210 + 121)                          |
| VL denominator | 31,766                                  | **~61,000**                                  |

---

## 6. Recommended app change

Because **no OU reports under both namespaces**, the safest and simplest fix mirrors the PBIX exactly:

```python
TX_CURR = sum(both DE families)     # kgzd9LfXZXq  +  aMp82zBYPnx (or regimen split)
TX_NEW  = sum(both DE families)     # vTTEybkXZ53  +  Syg8KH15VW6/gxEX3f1Wi4i/r2X4WnVpKQG
VL_D    = sum(both DE families)     # JGd3MwmKBuM  +  4 × "VL results …"
VL_N    = sum(both DE families)     # FloZph8hN9z  +  3 × "VL results …"
```

Change sites:

- `train/services/dhis2.py` → `INDICATOR_SPECS["tx_curr"]["aggregate"]`, `["tx_new"]["aggregate"]`, `["vl"]`
- `train/blueprints/hiv.py` → `homepage_summary()` DX map (`TX_CURR_DX`, `TX_NEW_DX`) and the HTS lists
- `train/js/mhu.js` → **no change needed**, already correct

The alternative — facility-scoped switching (if OU ∈ the 62, use the Stawisha DEs) — is also valid but adds a branch that the data does not require.
