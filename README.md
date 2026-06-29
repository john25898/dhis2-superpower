# DHIS2 Superpower

A small Python tool for translating plain-English DHIS2 requests into analytics queries, with a simple Streamlit front end.

## Run the CLI

```bash
python ai_translator.py -q "Get me HTS_TST_POS for Nkubu Mission Hospital for March 2026"
```

## Run the web UI

```bash
streamlit run app.py
```

## CSV export

In the web UI, check **Save the returned table as CSV** before running the query.
The CLI also supports `--csv` or an explicit request like "save as csv" in the prompt.
