"""Jamii Tekelezi filter → DHIS2 organisation unit resolution."""
from __future__ import annotations

from services.paths import BASE_DIR

_JT_OU_CACHE = None  # {facility_name: facility_id, subcounty_name: [facility_id, ...]}


def _load_jt_ou_map():
    """Load Jamii Tekelezi filter CSV into OU lookup maps."""
    global _JT_OU_CACHE
    if _JT_OU_CACHE is not None:
        return _JT_OU_CACHE
    jt_path = BASE_DIR / "data" / "jamii_tekelezi_filters.csv"
    if not jt_path.exists():
        _JT_OU_CACHE = {}
        return _JT_OU_CACHE
    import pandas as _pd
    jt_df = _pd.read_csv(jt_path)
    # facility name → OU ID
    name_to_id = {}
    subcounty_to_ids = {}
    for _, row in jt_df.iterrows():
        fid = str(row.get("facility_id", "")).strip()
        fname = str(row.get("facility_name", "")).strip()
        sc = str(row.get("subcounty_name", "")).strip()
        if fid and fname:
            name_to_id[fname] = fid
        if sc and fid:
            subcounty_to_ids.setdefault(sc, []).append(fid)
    # deduplicate subcounty lists
    for sc in subcounty_to_ids:
        subcounty_to_ids[sc] = list(dict.fromkeys(subcounty_to_ids[sc]))
    _JT_OU_CACHE = {"name_to_id": name_to_id, "subcounty_to_ids": subcounty_to_ids}
    return _JT_OU_CACHE


def _resolve_ou_ids(county, subcounty=None, facility=None):
    """Resolve facility/subcounty filters to DHIS2 OU IDs.
    Returns (ou_id_or_list, is_multi) where is_multi means we have multiple OUs.
    """
    JT_COUNTY_IDS = {
        "Meru County": "Y52XNJ50hYb",
        "Embu County": "PFu8alU2KWG",
        "Nyandarua County": "mYZacFNIB3h",
        "Tharaka Nithi County": "T4urHM47nlm",
    }
    default_ou = JT_COUNTY_IDS.get(county, "Y52XNJ50hYb")

    if not facility and not subcounty:
        return default_ou, False

    jt_map = _load_jt_ou_map()
    if not jt_map:
        return default_ou, False

    # Facility takes precedence
    if facility and facility != "all":
        fid = jt_map["name_to_id"].get(facility)
        if fid:
            return fid, False
        # facility not found in JT, fall through to subcounty or county

    # Subcounty → list of facility IDs
    if subcounty and subcounty != "all":
        ids = jt_map["subcounty_to_ids"].get(subcounty, [])
        if ids:
            return ids, True

    return default_ou, False
