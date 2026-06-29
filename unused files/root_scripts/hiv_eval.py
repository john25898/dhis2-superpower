import os
import re
import requests
import pandas as pd
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth

import ai_translator as t


def make_session():
    load_dotenv()
    base_url = os.getenv("DHIS_BASE_URL")
    username = os.getenv("DHIS_USERNAME")
    password = os.getenv("DHIS_PASSWORD")
    session = requests.Session()
    session.auth = HTTPBasicAuth(username, password)
    return base_url, session


def analytics_total(base_url, session, dx, ou, pe):
    params = [
        ("dimension", f"dx:{dx}"),
        ("dimension", f"ou:{ou}"),
        ("dimension", f"pe:{pe}"),
    ]
    r = session.get(f"{base_url}analytics.json", params=params, timeout=60)
    if r.status_code != 200:
        return None
    data = r.json()
    headers = [h.get("name") for h in data.get("headers", [])]
    rows = data.get("rows", [])
    if "value" not in headers:
        return 0.0
    value_idx = headers.index("value")
    total = 0.0
    for row in rows:
        try:
            total += float(row[value_idx])
        except Exception:
            continue
    return total


def discover_hiv_nonzero_metrics(base_url, session, ou, pe, probe_limit=220, min_found=25):
    meta = session.get(f"{base_url}dataElements.json?fields=id,name&paging=false", timeout=120)
    meta.raise_for_status()
    items = meta.json().get("dataElements", [])
    df = pd.DataFrame(items)
    hiv = df[df["name"].astype(str).str.contains("HIV", case=False, na=False)].copy()

    found = []
    for _, row in hiv.head(probe_limit).iterrows():
        dx = str(row["id"])
        name = str(row["name"])
        total = analytics_total(base_url, session, dx, ou, pe)
        if total is None:
            continue
        if total > 0:
            found.append({"dx": dx, "name": name, "total": total, "ou": ou, "pe": pe})
            if len(found) >= min_found:
                break
    return pd.DataFrame(found)


def make_prompt(metric_name, ou_name="Meru county", pe_text="this year"):
    clean = re.sub(r"\s+", " ", metric_name).strip()
    return f"Show {clean} in {ou_name} {pe_text}"


def run_prompt_eval(base_url, session, benchmark_df):
    rows = []
    for _, r in benchmark_df.iterrows():
        expected_dx = r["dx"]
        expected_ou = r["ou"]
        expected_pe = r["pe"]
        expected_total = float(r["total"])
        prompt = make_prompt(r["name"])

        url = t.generate_dhis2_url(prompt)
        pred_dx = pred_ou = pred_pe = None
        pred_total = None
        if url:
            pred_dx, pred_ou, pred_pe = t.extract_dims_from_url(url)
            if pred_dx and pred_ou and pred_pe:
                pred_total = analytics_total(base_url, session, pred_dx, pred_ou, pred_pe)

        exact_dims = (pred_dx == expected_dx and pred_ou == expected_ou and pred_pe == expected_pe)
        value_match = (pred_total is not None and abs(float(pred_total) - expected_total) < 0.0001)

        rows.append(
            {
                "prompt": prompt,
                "metric_name": r["name"],
                "expected_dx": expected_dx,
                "pred_dx": pred_dx,
                "expected_total": expected_total,
                "pred_total": pred_total,
                "exact_dims": exact_dims,
                "value_match": value_match,
            }
        )

    return pd.DataFrame(rows)


def pull_full_table(base_url, session, benchmark_df):
    dx_list = benchmark_df["dx"].astype(str).tolist()
    params = [
        ("dimension", "dx:" + ";".join(dx_list)),
        ("dimension", f"ou:{benchmark_df.iloc[0]['ou']}"),
        ("dimension", f"pe:{benchmark_df.iloc[0]['pe']}"),
    ]
    r = session.get(f"{base_url}analytics.json", params=params, timeout=120)
    r.raise_for_status()
    data = r.json()
    items = data.get("metaData", {}).get("items", {})
    headers = [h.get("name") for h in data.get("headers", [])]
    rows = data.get("rows", [])
    df = pd.DataFrame(rows, columns=headers) if rows else pd.DataFrame(columns=headers)
    if df.empty:
        return df
    df["dx_name"] = df["dx"].map(lambda x: items.get(x, {}).get("name", x))
    df["ou_name"] = df["ou"].map(lambda x: items.get(x, {}).get("name", x))
    df["pe_name"] = df["pe"].map(lambda x: items.get(x, {}).get("name", x))
    df["value"] = pd.to_numeric(df["value"], errors="coerce").fillna(0)
    return df[["dx", "dx_name", "ou_name", "pe_name", "value"]].sort_values("dx_name")


def main():
    base_url, session = make_session()
    benchmark_ou = "Y52XNJ50hYb"  # Meru County
    benchmark_pe = "THIS_YEAR"

    print("=== STEP 1: Discover non-zero HIV metrics directly from DHIS ===")
    benchmark_df = discover_hiv_nonzero_metrics(base_url, session, benchmark_ou, benchmark_pe)
    if benchmark_df.empty:
        print("No non-zero HIV metrics discovered for benchmark scope.")
        return

    print(f"Discovered {len(benchmark_df)} non-zero HIV metrics.")
    print(benchmark_df[["dx", "name", "total"]].head(20).to_string(index=False))

    print("\n=== STEP 2: Evaluate dictionary+AI output against direct DHIS ===")
    result_df = run_prompt_eval(base_url, session, benchmark_df)
    exact = int(result_df["exact_dims"].sum())
    total = len(result_df)
    value_match = int(result_df["value_match"].sum())
    print(f"Exact dimension matches: {exact}/{total}")
    print(f"Exact value matches: {value_match}/{total}")

    mismatches = result_df[~result_df["exact_dims"]].copy()
    if mismatches.empty:
        print("No dimension mismatches found.")
    else:
        print("\nDimension mismatches:")
        print(mismatches[["metric_name", "expected_dx", "pred_dx", "expected_total", "pred_total"]].head(20).to_string(index=False))

    print("\n=== STEP 3: Pull full direct DHIS table for benchmark metrics ===")
    full_df = pull_full_table(base_url, session, benchmark_df)
    if full_df.empty:
        print("No rows returned in full table query.")
    else:
        print(full_df.to_string(index=False))


if __name__ == "__main__":
    main()
