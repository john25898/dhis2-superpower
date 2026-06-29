import io
import contextlib
import os
import requests
import pandas as pd
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth

import ai_translator as t


def total(session, base_url, dx, ou, pe):
    r = session.get(
        base_url + "analytics.json",
        params=[("dimension", f"dx:{dx}"), ("dimension", f"ou:{ou}"), ("dimension", f"pe:{pe}")],
        timeout=45,
    )
    if r.status_code != 200:
        return None
    j = r.json()
    headers = [h.get("name") for h in j.get("headers", [])]
    rows = j.get("rows", [])
    if "value" not in headers:
        return 0.0
    idx = headers.index("value")
    acc = 0.0
    for row in rows:
        try:
            acc += float(row[idx])
        except Exception:
            pass
    return acc


def main():
    load_dotenv()
    base_url = os.getenv("DHIS_BASE_URL")
    username = os.getenv("DHIS_USERNAME")
    password = os.getenv("DHIS_PASSWORD")

    session = requests.Session()
    session.auth = HTTPBasicAuth(username, password)

    cases = [
        ("Show AHD CALHIV KEPI in Meru county this year", "g0s65Dm47CA", "Y52XNJ50hYb", "THIS_YEAR"),
        ("Show AHD CALHIV Pneumo in Meru county this year", "vFByuxLPFX7", "Y52XNJ50hYb", "THIS_YEAR"),
        ("Show AHD CALHIV Rota in Meru county this year", "iBsCVgCGyQ7", "Y52XNJ50hYb", "THIS_YEAR"),
        ("Show CALHIV OVC enrolled in Meru county this year", "Ml7NYiKXKJ9", "Y52XNJ50hYb", "THIS_YEAR"),
        ("Show HIV_ST kits distributed unassisted in Meru county this year", "GcN1zIpraSK", "Y52XNJ50hYb", "THIS_YEAR"),
        ("Show HIV_ST number tested in Meru county this year", "x1FaP831rVG", "Y52XNJ50hYb", "THIS_YEAR"),
        ("Show HIV_ST number tested negative in Meru county this year", "EVmz5PbY4fU", "Y52XNJ50hYb", "THIS_YEAR"),
        ("Show HIV_ST unassisted kits distribution sexual partner in Meru county this year", "j0qyAOxRLbG", "Y52XNJ50hYb", "THIS_YEAR"),
        ("Show HTS_INDEX monthly known HIV positive contacts in Meru county this year", "jwdD1sNc2qV", "Y52XNJ50hYb", "THIS_YEAR"),
        ("Show GBV_MNCH_BF_SV_Tested_HIV in Meru county this year", "FSri933Oq6t", "Y52XNJ50hYb", "THIS_YEAR"),
        ("Show GBV_MNCH_PG_SV_Tested_HIV in Meru county this year", "hTRW1MxhnbS", "Y52XNJ50hYb", "THIS_YEAR"),
        ("Show FMAPS_ATPT1C HIV Negative 3HP in Meru county this year", "XXfQBQJ7UUF", "Y52XNJ50hYb", "THIS_YEAR"),
        ("Show FMAPS_HPB1A DF 3TC HIV-ve HepB patients in Meru county this year", "U1yuKNNhp4U", "Y52XNJ50hYb", "THIS_YEAR"),
        ("Show FMAPS_HPB1B TDF FTC HIV-ve HepB patients in Meru county this year", "mxdOiBRUqX1", "Y52XNJ50hYb", "THIS_YEAR"),
        ("Show HIV_ST kits distributed directly assisted in Meru county this year", "F2xJbmWy7Ci", "Y52XNJ50hYb", "THIS_YEAR"),
    ]

    rows = []
    for prompt, expected_dx, expected_ou, expected_pe in cases:
        with contextlib.redirect_stdout(io.StringIO()):
            url = t.generate_dhis2_url(prompt)
        pred_dx, pred_ou, pred_pe = t.extract_dims_from_url(url) if url else (None, None, None)

        expected_total = total(session, base_url, expected_dx, expected_ou, expected_pe)
        pred_total = total(session, base_url, pred_dx, pred_ou, pred_pe) if pred_dx and pred_ou and pred_pe else None

        rows.append(
            {
                "prompt": prompt,
                "expected_dx": expected_dx,
                "pred_dx": pred_dx,
                "expected_ou": expected_ou,
                "pred_ou": pred_ou,
                "expected_pe": expected_pe,
                "pred_pe": pred_pe,
                "expected_total": expected_total,
                "pred_total": pred_total,
                "exact_dim_match": pred_dx == expected_dx and pred_ou == expected_ou and pred_pe == expected_pe,
                "value_match": (pred_total is not None and expected_total is not None and abs(pred_total - expected_total) < 1e-9),
            }
        )

    df = pd.DataFrame(rows)
    exact = int(df["exact_dim_match"].sum())
    value_match = int(df["value_match"].sum())

    ids = ";".join([x[1] for x in cases])
    r = session.get(
        base_url + "analytics.json",
        params=[("dimension", "dx:" + ids), ("dimension", "ou:Y52XNJ50hYb"), ("dimension", "pe:THIS_YEAR")],
        timeout=120,
    )
    r.raise_for_status()
    j = r.json()
    headers = [h.get("name") for h in j.get("headers", [])]
    meta_items = j.get("metaData", {}).get("items", {})
    table_rows = j.get("rows", [])
    full = pd.DataFrame(table_rows, columns=headers) if table_rows else pd.DataFrame(columns=headers)
    if not full.empty:
        full["dx_name"] = full["dx"].map(lambda x: meta_items.get(x, {}).get("name", x))
        full["value"] = pd.to_numeric(full["value"], errors="coerce").fillna(0)
        full = full[["dx", "dx_name", "value"]].sort_values("dx_name")

    out_path = "hiv_eval_report.txt"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"CASES: {len(df)}\n")
        f.write(f"EXACT_DIM_MATCH: {exact}/{len(df)}\n")
        f.write(f"VALUE_MATCH: {value_match}/{len(df)}\n")
        f.write("\nMISMATCHES:\n")
        mismatches = df[~df["exact_dim_match"]]
        if mismatches.empty:
            f.write("None\n")
        else:
            f.write(mismatches[["prompt", "expected_dx", "pred_dx", "expected_total", "pred_total"]].to_string(index=False))
            f.write("\n")
        f.write("\nDIRECT_DHIS_FULL_TABLE:\n")
        if full.empty:
            f.write("No rows\n")
        else:
            f.write(full.to_string(index=False))
            f.write("\n")


if __name__ == "__main__":
    main()
