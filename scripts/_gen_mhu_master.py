"""Generate train/data/chak_mhus_master.json — the full confirmed CHAK MHU list
from 'CHAK Member Health Units - CONFIRMED MFL codes ONLY.xlsx'
(586 rows, including duplicates where a facility serves multiple projects).
"""
import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
EXCEL = ROOT / "CHAK Member Health Units - CONFIRMED MFL codes ONLY.xlsx"
OUT = ROOT / "train" / "data" / "chak_mhus_master.json"


def main():
    if not EXCEL.exists():
        print(f"Missing: {EXCEL}")
        sys.exit(1)

    df = pd.read_excel(EXCEL, sheet_name="Confirmed facilities")
    rows = []
    for _, r in df.iterrows():
        rows.append(
            {
                "no": int(r["No."]) if pd.notna(r["No."]) else None,
                "mfl": str(r["MFL Code"]).strip(),
                "county": str(r["County"]) if pd.notna(r["County"]) else "",
                "subcounty": str(r["Sub County"]) if pd.notna(r["Sub County"]) else "",
                "name": str(r["Facility Name"]).strip(),
                "category": str(r["Category"]) if pd.notna(r["Category"]) else "",
                "region": str(r["Region"]) if pd.notna(r["Region"]) else "",
            }
        )

    out = {
        "generated": "2026-08-25",
        "source": str(EXCEL.name),
        "total": len(rows),
        "rows": rows,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    print(f"Wrote {len(rows)} rows → {OUT}")


if __name__ == "__main__":
    main()
