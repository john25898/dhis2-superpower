"""DHIS2 live-query clients (CHAK server) and indicator specifications."""
from __future__ import annotations

import os

from services.superpower import HAS_SUPERPOWER, _superpower_fetch_result, _superpower_load_dict


# ── CHAK DHIS2 config (for MOH 740 / MOH 731) ──────────────────────
CHAK_BASE = "http://ereporting.chak.or.ke:8500/api"
CHAK_USER = "Johnbrian"
CHAK_PASS = "JOHNb123\\"


def _parse_dhis2_rows(rows, meta, coc_ids=None):
    """Parse DHIS2 analytics rows into a dict."""
    if not rows:
        return {}
    out = {}
    if coc_ids:
        # COC-disaggregated: keyed by (period, coc_id)
        # Row format: [dx, coc, pe, ou, value] when ou dimension is present
        for row in rows:
            if len(row) < 4:
                continue
            coc = str(row[1]) if len(row) > 1 else ""
            pe_code = str(row[2]) if len(row) > 2 else ""
            pe_name = meta.get(pe_code, {}).get("name", pe_code)
            val = float(row[-1]) if row[-1] else 0
            out[(pe_name, coc)] = out.get((pe_name, coc), 0) + val
    else:
        # Simple period-summed
        for row in rows:
            pe_code = str(row[1]) if len(row) > 1 else ""
            pe_name = meta.get(pe_code, {}).get("name", pe_code)
            val = float(row[-1]) if row[-1] else 0
            out[pe_name] = out.get(pe_name, 0) + val
    return out


def _dhis2_fetch(dx_ids, ou_id, pe="LAST_12_MONTHS", coc_ids=None):
    """Fetch analytics rows from DHIS2.
    Returns:
      - Without coc_ids: dict of {period_label: summed_value}
      - With coc_ids: dict of {(period_label, coc_id): value}
    dx_ids can be a single string or a list/set of strings.
    """
    import requests as _req
    from requests.auth import HTTPBasicAuth

    # Always use the CHAK DHIS2 server
    dhis_base = "http://ereporting.chak.or.ke:8500/api"
    url_base = dhis_base + "/analytics.json"
    username = os.getenv("DHIS_USERNAME", "Johnbrian")
    password = os.getenv("DHIS_PASSWORD", "JOHNb123\\")
    auth = HTTPBasicAuth(username, password)

    if isinstance(dx_ids, (list, set, tuple)):
        dx_str = ";".join(dx_ids)
    else:
        dx_str = dx_ids

    if not dx_str or not dx_str.strip():
        return {}  # no DX IDs to query

    # Build dimensions – ou_id can be a single ID or list
    if isinstance(ou_id, (list, set, tuple)):
        ou_str = ";".join(ou_id)
    else:
        ou_str = ou_id
    dimensions = [f"dx:{dx_str}", f"pe:{pe}", f"ou:{ou_str}"]
    if coc_ids:
        if isinstance(coc_ids, (list, set, tuple)):
            coc_str = ";".join(coc_ids)
        else:
            coc_str = coc_ids
        dimensions.append(f"co:{coc_str}")

    # Try superpower first if available
    if HAS_SUPERPOWER:
        api_url = f"{url_base}?" + "&".join(
            f"dimension={d}" for d in dimensions
        ) + "&displayProperty=NAME"
        try:
            result = _superpower_fetch_result(api_url)
            if result.get("ok") and result.get("rows"):
                return _parse_dhis2_rows(result["rows"], result.get("metaData", {}).get("items", {}), coc_ids)
        except Exception:
            pass  # fall through to direct HTTP

    # Direct HTTP fallback
    params = {
        "dimension": dimensions,
        "displayProperty": "NAME",
    }
    resp = _req.get(url_base, params=params, auth=auth, timeout=120)
    if not resp.ok:
        return {}
    data = resp.json()
    rows = data.get("rows", [])
    meta = data.get("metaData", {}).get("items", {})
    return _parse_dhis2_rows(rows, meta, coc_ids)


def _chak_analytics_fetch(dx_ids, ou_id, pe="LAST_12_MONTHS"):
    """Fetch analytics rows from CHAK DHIS2.
    Returns {dx_id: {period_name: value, ...}, ...}
    """
    import requests as _req
    from requests.auth import HTTPBasicAuth

    from services.khis import _khis_parse_per_de

    auth = HTTPBasicAuth(CHAK_USER, CHAK_PASS)
    if isinstance(dx_ids, (list, set, tuple)):
        dx_str = ";".join(dx_ids)
    else:
        dx_str = dx_ids
    if not dx_str or not dx_str.strip():
        return {}
    if isinstance(ou_id, (list, set, tuple)):
        ou_str = ";".join(ou_id)
    else:
        ou_str = ou_id

    url = CHAK_BASE.rstrip("/") + "/analytics.json"
    params = {
        "dimension": [f"dx:{dx_str}", f"pe:{pe}", f"ou:{ou_str}"],
        "displayProperty": "NAME",
    }
    try:
        resp = _req.get(url, params=params, auth=auth, verify=False, timeout=120)
        if not resp.ok:
            return {}
        data = resp.json()
        rows = data.get("rows", [])
        meta = data.get("metaData", {}).get("items", {})
        return _khis_parse_per_de(rows, meta)
    except Exception:
        return {}


def _find_dx_by_pattern(prefix_pattern, age_bands):
    """Find male & female DX IDs from the data element dictionary.
    prefix_pattern: e.g. 'Tx_New STA' or 'TX_Curr STA'
    age_bands: list of strings like ['<1','1-4',...]
    Returns (males_list, females_list) of 11-char UIDs each.
    """
    try:
        df_elements, _ = _superpower_load_dict()
    except Exception:
        return [], []
    names = df_elements["name"].astype(str)
    males, females = [], []
    for age in age_bands:
        # Handle both "Tx_New STA <1M" (no comma) and "TX_Curr STA <1,M" (comma)
        pat_m = rf"{prefix_pattern}\s+{age},?\s*M\b"
        pat_f = rf"{prefix_pattern}\s+{age},?\s*F\b"
        m_match = df_elements[names.str.match(pat_m, case=False, na=False)]
        f_match = df_elements[names.str.match(pat_f, case=False, na=False)]
        if not m_match.empty:
            males.append(m_match.iloc[0]["id"])
        if not f_match.empty:
            females.append(f_match.iloc[0]["id"])
    return males, females


# ── Indicator specs for each subtab type ───────────────────────────
# DX IDs verified against dictionaries/master_data_elements.csv (2025-06-28)
# ── COC IDs for "Finer Age Bands and Gender" category combo ──────
# Age bands → Category Option Combo IDs (verified against CHAK DHIS2)
_COC_MALES = [
    "AwerOu6rx5q","g2zP3yNwOOa","WTfu1bBSG12","X65JamO5tyb","hKHprPKwjL6",
    "uSDHHGh2DZo","sLaLEIDVusT","b91xfEPrY4D","EU7hVFz5Yyt","AR2E4Yiuo8Z",
    "dfkyp7ZQZSr","lswMoqT008e","Z6zV5L8i14I","XIc55yRW4aQ","g5bVF4b8hmV",
]  # <1,M  1-4,M  5-9,M  10-14,M  15-19,M  20-24,M  25-29,M  30-34,M  35-39,M  40-44,M  45-49,M  50-54,M  55-59,M  60-64,M  65+,M
_COC_FEMALES = [
    "dcv8Lowu94w","D2aMSzo7SEw","HIS0TcFAoo8","Rr3uh3eAvKi","DYDpnZWu1XK",
    "m7Y0ddB212k","qy1vJGvFJeB","sk5UiD3PrxH","Vb7KzTvF83C","dchngmvBGvb",
    "VP1zCgdzuBb","uefSjW3VtZr","llt7APqVWyq","gs3y2muDLIK","YAtW6LDL24J",
]  # <1,F  1-4,F  5-9,F  10-14,F  15-19,F  20-24,F  25-29,F  30-34,F  35-39,F  40-44,F  45-49,F  50-54,F  55-59,F  60-64,F  65+,F

INDICATOR_SPECS = {
    "tx_new": {
        "title": "Newly Started on ART",
        "aggregate": "vTTEybkXZ53",  # TX_NEW: Starting ART (CHAK DHIS2)
        "male_cocs": _COC_MALES,
        "female_cocs": _COC_FEMALES,
        "age_bands": ["<1","1-4","5-9","10-14","15-19","20-24",
                      "25-29","30-34","35-39","40-44","45-49",
                      "50-54","55-59","60-64","65+"],
        "color_total": "#2563eb",
        "color_male": "#10b981",
        "color_female": "#ec4899",
    },
    "tx_curr": {
        "title": "Current on ART",
        "aggregate": "kgzd9LfXZXq",  # TX_CURR (CHAK DHIS2)
        "male_cocs": _COC_MALES,
        "female_cocs": _COC_FEMALES,
        "age_bands": ["<1","1-4","5-9","10-14","15-19","20-24",
                      "25-29","30-34","35-39","40-44","45-49",
                      "50-54","55-59","60-64","65+"],
        "color_total": "#7c3aed",
        "color_male": "#10b981",
        "color_female": "#ec4899",
    },
    "vl": {
        "title": "VL Monitoring",
        "aggregate": "JGd3MwmKBuM",  # TX_PVLS (D) Routine
        "color_total": "#0891b2",
        "vl_pvls_d": "JGd3MwmKBuM",
        "vl_pvls_n": "FloZph8hN9z",   # TX_PVLS (N) Routine
    },
}

# ── JTP (Jamii Tekelezi Program) Treatment subtab specs ────────────
# Data elements from JTP Monthly HIV Care and Treatment dataset
JTP_SPECS = {
    "art_optimization": {
        "title": "ART Optimization",
        "metrics": {
            "regimen_1st_line": {"ids": ["zZGNba5d34c"], "label": "TX_CURR on 1st Line"},
            "regimen_2nd_line": {"ids": ["F0xtjHxDZ2e"], "label": "TX_CURR on 2nd Line"},
            "regimen_3rd_line": {"ids": ["Pk1PMmG4ml7"], "label": "TX_CURR on 3rd Line"},
            "on_dtg": {"ids": ["s62uidROGjG"], "label": "TX_CURR on DTG"},
            "eligible_dtg": {"ids": ["bsQdHW8sJ4b"], "label": "Eligible for DTG"},
            "efv_600": {"ids": ["lr1YorhNrJT"], "label": "Active on EFV-600"},
            "efv_400": {"ids": ["ggO3YzjB9j4"], "label": "Active on EFV-400"},
            "pi_based": {"ids": ["Z4g3jskQn9c"], "label": "Active on PI Regimen"},
            "viremia_clinic": {"ids": ["JGIZOGP6bGU"], "label": "Active in Viremia Clinic"},
        },
    },
    "dsd": {
        "title": "Differentiated Service Delivery (DSD)",
        "metrics": {
            "eligible_dc": {"ids": ["zkZIEcm0mFs"], "label": "Eligible for DC"},
            "on_dc": {"ids": ["qfLHg1lbN3W"], "label": "Clients Put on DC"},
            "eligible_dcm": {"ids": ["oJfkiD0C599"], "label": "Eligible for DCM"},
            "dcm_community": {"ids": ["oHTbEMaKn7L"], "label": "DCM - Community"},
            "dcm_facility": {"ids": ["cPEthRR8Zs1"], "label": "DCM - Facility"},
            "arv_dispensing": {"ids": ["Lo3GoG3lxOF"], "label": "ARV Dispensing"},
        },
    },
    "treatment_outcomes": {
        "title": "Treatment Outcomes",
        "metrics": {
            "iit_3m": {"ids": ["Cn2q8OMIHDD"], "label": "IIT > 3 Months"},
            "iit_1m": {"ids": ["Gg3ZzBADtz8"], "label": "IIT <= 3 Months"},
            "stopped": {"ids": ["HjRScpxwVQn"], "label": "Stopped Treatment"},
            "died": {"ids": ["DrtGJ1cgA3J"], "label": "Died this Month"},
            "transfers_out": {"ids": ["YX65zEg6s5R"], "label": "Transferred Out"},
            "transfers_in": {"ids": ["vODolOs8eBi"], "label": "Transferred In"},
            "rtt": {"ids": ["tCFth5mfGz5"], "label": "Return to Treatment (RTT)"},
        },
    },
    "otz": {
        "title": "OTZ (O and Teen Club)",
        "metrics": {
            "booked": {"ids": ["ep6NJHQ9LJa"], "label": "OTZ Booked"},
            "adher_95": {"ids": ["kMe6SRtZ6pn"], "label": "Adherence >95%"},
            "basevl_lt1000": {"ids": ["O6wVcguUXbQ"], "label": "Baseline VL <1000"},
            "basevl_lt200": {"ids": ["caFpNcJu2q2"], "label": "Baseline VL <200"},
            "basevl_ldl": {"ids": ["JFfFnMNV2dL"], "label": "Baseline VL LDL"},
        },
    },
    "ovc": {
        "title": "OVC (Orphans and Vulnerable Children)",
        "metrics": {
            "calhiv_enrolled": {"ids": ["Ml7NYiKXKJ9"], "label": "CALHIV OVC Enrolled"},
            "prev_15_24": {"ids": ["d7PKefTNRPT"], "label": "ICT PREV 15-24yrs"},
            "prev_lt15": {"ids": ["jgtv4fG2Vpm"], "label": "ICT PREV <15yrs"},
            "prev_gt25": {"ids": ["s8sJolX8W8I"], "label": "ICT PREV >25yrs"},
            "ovc_hivstat": {"ids": ["vd42QeUMvb2"], "label": "OVC HIV Status Known"},
            "ovc_serv": {"ids": ["CNdhjjVHiHp"], "label": "OVC Services"},
        },
    },
    "covid": {
        "title": "COVID-19",
        "metrics": {
            "screened": {"ids": ["z4ylGRyQ7Rl"], "label": "CCC Screened for COVID"},
        },
    },
    "ahd": {
        "title": "Advanced HIV Disease (AHD)",
        "metrics": {
            "kepi": {"ids": ["g0s65Dm47CA"], "label": "CALHIV KEPI"},
            "not_imm": {"ids": ["oWSf2zNhstC"], "label": "CALHIV Not Immunized"},
            "pneumo": {"ids": ["vFByuxLPFX7"], "label": "CALHIV Pneumo"},
            "rota": {"ids": ["iBsCVgCGyQ7"], "label": "CALHIV Rota"},
            "cd4_smearpos": {"ids": ["R5KyL0fYJle"], "label": "CD4 TB Smear+"},
            "iit_cd4": {"ids": ["KRvAhAQ5O46"], "label": "IIT CD4"},
            "iit_cd4_lt200": {"ids": ["rrfFv94aqgy"], "label": "IIT CD4 <200"},
        },
    },
    "adverse_events": {
        "title": "Adverse Events (AE)",
        "metrics": {
            "cod_tb": {"ids": ["LIvYFVNx00M"], "label": "COD - TB"},
            "cod_cancer": {"ids": ["RlKpuE0qv0q"], "label": "COD - Cancer"},
            "cod_other_hiv": {"ids": ["ZnmeKVBraIA"], "label": "COD - Other HIV Disease"},
            "cod_other_natural": {"ids": ["hgV3WXdiPbZ"], "label": "COD - Other Natural Causes"},
            "cod_non_natural": {"ids": ["Lw7SrH10igs"], "label": "COD - Non Natural Causes"},
            "cod_unknown": {"ids": ["yrERSv923Qh"], "label": "COD - Unknown Causes"},
        },
    },
}

# ── HTS (HIV Testing Services) indicator specs ────────────────────
HTS_SPECS = {
    "hts_uptake": {
        "title": "HIV Testing Services Uptake",
        "metrics": {
            "hts_tested": {
                "ids": ["ymKviaHZtQN","vFlUDposW0Y","XKAlilawdhN","THJbtDzxplR",
                        "Lwtqyjus0Mb","QBsyLQZRdiH","XYhYAMivUX5","J4zibSjbBCt"],
                "label": "HTS TST Numerator",
            },
            "hts_positive": {
                "ids": ["CcOr3MB7Mh4"],  # MOH731_HV01-19: Total HIV Positive
                "label": "HIV Positive",
            },
        },
        # positivity_rate computed in endpoint
    },
    "hts_linkage": {
        "title": "HIV Testing Services Linkage",
        "metrics": {
            "linked_within": {
                "ids": ["wQ5AA7GTs9G","YroUdlNVeR2","h13L1gcUaCS"],
                "label": "Linked Within Facility",
            },
            "linked_outside": {
                "ids": ["DdPzCAtN3J2","ZnetI7sd8Ub","BeO9dmxTBMg"],
                "label": "Linked Outside Facility",
            },
            "total_tested": {
                "ids": ["ymKviaHZtQN","vFlUDposW0Y","XKAlilawdhN","THJbtDzxplR",
                        "Lwtqyjus0Mb","QBsyLQZRdiH","XYhYAMivUX5","J4zibSjbBCt"],
                "label": "Total Tested (Ref)",
            },
        },
    },
    "partner_notification": {
        "title": "Partner Notification Services",
        "metrics": {
            "index_offered": {
                "ids": ["gp0RYhjsc1f"],
                "label": "Index Clients Offered PNS",
            },
            "index_accepted": {
                "ids": ["sTBggmuuiGR"],
                "label": "Index Clients Accepting PNS",
            },
            "contacts_tested": {
                "ids": ["DtJ8Kpaquhx"],
                "label": "Contacts Tested",
            },
        },
    },
    "prep": {
        "title": "PrEP",
        "metrics": {
            "prep_new": {
                "ids": ["HmUEZ2yWtAE","tSOqRYW3fUp","CYLF8hUOHpv","Q57YuHsnTKm",
                        "OOhFACMqmKp","hxfjIrnxHBF","EmzN6C78vFE","BSx4nKKwK1r",
                        "mbSrJM6OvQo","N3IsvP0sUF5","DQR7sycvi6V","JJsuQUWLYsD",
                        "qvhr1STgYAD","N6iP1PPLmyX","EX7lZNXZXDe"],
                "label": "PrEP New",
            },
            "prep_curr": {
                "ids": ["UhOTGSCLcvz","ENYVWNfmlWi","m0sXEku2oeB","McHzszUZFtf"],
                "label": "PrEP Current",
            },
            "prep_screened": {
                "ids": ["Th1loMyxBhR","C0z7kQZw2LZ","dc0q1SbjyPU"],
                "label": "PrEP Screened",
            },
        },
    },
}
