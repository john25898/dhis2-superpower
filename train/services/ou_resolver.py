"""Daraja filter → DHIS2 organisation unit resolution."""
from __future__ import annotations

from services.paths import DARAJA_FILTERS_CSV

_JT_OU_CACHE = None  # {name_to_id, subcounty_to_ids, county_to_id, all_ids}

# The county that the Daraja project opens on by default. It is also the last
# resort when a caller passes a county name that is not on the roster at all.
DEFAULT_COUNTY = "Meru County"

# County OU ids, used only when the roster CSV cannot be read. The CSV itself
# carries a `county_id` for every one of the 15 Daraja counties, so this map is
# a safety net rather than the source of truth.
_FALLBACK_COUNTY_IDS = {
    "Embu County": "PFu8alU2KWG",
    "Kajiado County": "Hsk1YV8kHkT",
    "Kiambu County": "qKzosKQPl6G",
    "Kirinyaga County": "Ulj33KBau7V",
    "Kitui County": "j8o6iO4Njsi",
    "Laikipia County": "xuFdFy6t9AH",
    "Machakos County": "yhCUgGcCcOo",
    "Makueni County": "BoDytkJQ4Qi",
    "Meru County": "Y52XNJ50hYb",
    "Muranga County": "ahwTMNAJvrL",
    "Nakuru County": "ob6SxuRcqU4",
    "Narok County": "kqJ83J2D72s",
    "Nyandarua County": "mYZacFNIB3h",
    "Nyeri County": "ptWVfaCIdVx",
    "Tharaka Nithi County": "T4urHM47nlm",
}

# Values the top-bar filter sends when the user has not narrowed the scope.
_ALL_SENTINELS = {"", "all", "all counties", "all daraja counties", "none"}


def _clean(value) -> str:
    """Normalise a CSV cell to a stripped string (NaN/None → "")."""
    if value is None:
        return ""
    text = str(value).strip()
    return "" if text.lower() in ("nan", "none", "nat") else text


def _load_jt_ou_map():
    """Load Daraja filter CSV into OU lookup maps."""
    global _JT_OU_CACHE
    if _JT_OU_CACHE is not None:
        return _JT_OU_CACHE
    jt_path = DARAJA_FILTERS_CSV
    if not jt_path.exists():
        _JT_OU_CACHE = {
            "name_to_id": {}, "subcounty_to_ids": {}, "county_to_id": {}, "all_ids": [],
        }
        return _JT_OU_CACHE
    import pandas as _pd
    jt_df = _pd.read_csv(jt_path)
    name_to_id = {}          # facility name → OU ID
    subcounty_to_ids = {}    # sub-county name → [OU ID, ...]
    county_to_id = {}        # county name → county OU ID
    all_ids = []             # every roster facility OU ID, in roster order
    for _, row in jt_df.iterrows():
        fid = _clean(row.get("facility_id"))
        fname = _clean(row.get("facility_name"))
        sc = _clean(row.get("subcounty_name"))
        cname = _clean(row.get("county_name"))
        cid = _clean(row.get("county_id"))
        if fid and fname:
            name_to_id[fname] = fid
            if fid not in all_ids:
                all_ids.append(fid)
        if sc and fid:
            subcounty_to_ids.setdefault(sc, []).append(fid)
        if cname and cid and cname not in county_to_id:
            county_to_id[cname] = cid
    # deduplicate subcounty lists
    for sc in subcounty_to_ids:
        subcounty_to_ids[sc] = list(dict.fromkeys(subcounty_to_ids[sc]))
    _JT_OU_CACHE = {
        "name_to_id": name_to_id,
        "subcounty_to_ids": subcounty_to_ids,
        "county_to_id": county_to_id,
        "all_ids": all_ids,
    }
    return _JT_OU_CACHE


def _county_ou_ids() -> dict:
    """County name → county OU ID, roster first with the static map as backstop."""
    merged = dict(_FALLBACK_COUNTY_IDS)
    merged.update(_load_jt_ou_map().get("county_to_id") or {})
    return merged


def _resolve_ou_ids(county, subcounty=None, facility=None):
    """Resolve county/subcounty/facility filters to DHIS2 OU IDs.

    Returns (ou_id_or_list, is_multi) where is_multi means we have multiple OUs.

    Scope ladder (most specific wins):
      1. facility  → that one facility's OU
      2. subcounty → every roster facility OU in that sub-county
      3. county    → that county's OU
      4. "all"     → the whole Daraja roster (every county, every facility)

    Step 4 previously collapsed to Meru, which is why the other 14 counties
    appeared to hold Meru's data. The roster covers 100% of the reporting sites
    in every one of the 15 counties, so the roster list and the county OU return
    identical numbers — verified for TX_CURR and TX_NEW across all 15.
    """
    county = _clean(county)
    subcounty = _clean(subcounty)
    facility = _clean(facility)

    jt_map = _load_jt_ou_map()
    county_ids = _county_ou_ids()
    meru_ou = county_ids.get(DEFAULT_COUNTY) or _FALLBACK_COUNTY_IDS[DEFAULT_COUNTY]

    # Facility takes precedence over everything else.
    if facility and facility.lower() != "all":
        fid = (jt_map.get("name_to_id") or {}).get(facility)
        if fid:
            return fid, False
        # facility not on the roster — fall through to subcounty / county scope

    # Sub-county → every roster facility OU inside it.
    if subcounty and subcounty.lower() != "all":
        ids = (jt_map.get("subcounty_to_ids") or {}).get(subcounty) or []
        if ids:
            return list(ids), True

    # Whole project: every facility on the Daraja roster, all 15 counties.
    if not county or county.lower() in _ALL_SENTINELS:
        all_ids = jt_map.get("all_ids") or []
        if all_ids:
            return list(all_ids), True
        # Roster unreadable — approximate the project with its county OUs.
        counties = sorted(set(county_ids.values()))
        return (counties or [meru_ou]), True

    # A single, named county.
    ou = county_ids.get(county)
    if ou:
        return ou, False

    # County not on the roster at all (typo / non-Daraja name): keep the page
    # rendering rather than 500ing, but make the substitution visible upstream.
    return meru_ou, False
