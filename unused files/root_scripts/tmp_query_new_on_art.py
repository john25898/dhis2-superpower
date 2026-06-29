from ai_translator import generate_dhis2_url, fetch_query_result

q = "Show the number of newly started on ART for Meru County June 2025"
print("QUESTION:", q)
url = generate_dhis2_url(q)
print("GENERATED_URL:", url)
if not url:
    print("No URL generated")
else:
    res = fetch_query_result(url, export_csv=False, user_question=q)
    print("RESULT_OK:", res.get("ok"))
    print("TOTAL:", res.get("total"))
    print("MESSAGE:", res.get("message"))
    rows = res.get("rows", [])
    for r in rows:
        print(f'  - {r["period"]}: {r["value"]} ({r["metric"]})')
