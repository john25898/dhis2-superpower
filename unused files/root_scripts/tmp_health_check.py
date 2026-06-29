"""Quick health check for the DHIS2 Superpower tool."""
from ai_translator import generate_dhis2_url, fetch_query_result

print("=" * 60)
print("DHIS2 SUPERPOWER HEALTH CHECK")
print("=" * 60)

tests = [
    ("Give me TX_CURR for Meru County March 2026", "Standard TX_CURR"),
    ("Show the number of newly started on ART for Meru County June 2025", "TX_NEW"),
]

passed = 0
failed = 0

for q, label in tests:
    print("")
    print("--- TEST [{}]: {} ---".format(label, q))
    try:
        url = generate_dhis2_url(q)
        if not url:
            print("  FAIL: No URL generated")
            failed += 1
            continue
        print("  URL: {}...".format(url[:100]))

        res = fetch_query_result(url, export_csv=False, user_question=q)
        if res.get("ok"):
            total = res.get("total", 0)
            rows = res.get("rows", [])
            print("  PASS: Total={}, Rows={}".format(total, len(rows)))
            if rows:
                for r in rows[:3]:
                    print("    - {}: {} ({})".format(r["period"], r["value"], r["metric"]))
            passed += 1
        else:
            print("  FAIL: {}".format(res.get("error", "Unknown error")))
            failed += 1
    except Exception as e:
        print("  ERROR: {}".format(e))
        failed += 1

print("")
print("=" * 60)
print("RESULTS: {} passed, {} failed out of {}".format(passed, failed, len(tests)))
print("=" * 60)
