import re

import pandas as pd
import streamlit as st

from ai_translator import (
    fetch_query_result,
    fetch_geo_hierarchy_result,
    fetch_metadata_result,
    detect_geo_hierarchy_intent,
    generate_dhis2_url,
    detect_metadata_list_intent,
    has_explicit_location_context,
    wants_csv_export,
)


st.set_page_config(
    page_title="DHIS2 Superpower",
    page_icon="📊",
    layout="wide",
)

st.markdown(
    """
    <style>
        .block-container {
            padding-top: 2rem;
            padding-bottom: 2rem;
            max-width: 1200px;
        }
        .hero {
            padding: 1.5rem 1.75rem;
            border-radius: 20px;
            background: linear-gradient(135deg, #0f4c5c 0%, #116466 55%, #1f7a8c 100%);
            color: white;
            box-shadow: 0 18px 50px rgba(15, 76, 92, 0.24);
            margin-bottom: 1.25rem;
        }
        .hero h1 {
            margin: 0;
            font-size: 2.1rem;
            line-height: 1.05;
        }
        .hero p {
            margin: 0.5rem 0 0;
            opacity: 0.92;
            font-size: 1rem;
        }
        .card {
            padding: 1rem 1.1rem;
            border-radius: 16px;
            background: #ffffff;
            border: 1px solid rgba(17, 100, 102, 0.12);
            box-shadow: 0 10px 24px rgba(18, 27, 38, 0.06);
            margin-bottom: 1rem;
        }
        .compact-panel {
            max-width: 760px;
        }
        div[data-testid="stSelectbox"],
        div[data-testid="stTextInput"] {
            max-width: 360px;
        }
        div[data-testid="stButton"] button {
            max-width: 360px;
        }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    """
    <div class="hero">
        <h1>DHIS2 Superpower</h1>
        <p>Ask for a table in plain English, then optionally save the result as CSV.</p>
    </div>
    """,
    unsafe_allow_html=True,
)

left, right = st.columns([1.2, 0.8], gap="large")

TABLE_PRESETS = {
    "Custom / free text": "",
    "TX_CURR": "Can i have the TX_CURR data for March 2026",
    "HTS_TST - Index Testing": "Get me HTS_TST (facility) - Index Testing for March 2026",
    "HTS_TST - PITC Malnutrition Clinics": "Get me HTS_TST (facility) - PITC Malnutrition Clinics for March 2026",
    "HTS_TST - PITC Inpatient Services": "Get me HTS_TST (facility) - PITC Inpatient Services for March 2026",
    "HTS_TST - PITC Pediatric Services": "Get me HTS_TST (facility) - PITC Pediatric Services for March 2026",
}


def clean_facility_text(value):
    """Normalize facility input so users can type it naturally."""
    facility = (value or "").strip()
    facility = re.sub(r"^for\s+", "", facility, flags=re.IGNORECASE)
    return facility


def build_question_from_ui(selected_table, question_text, facility_text):
    """Build the final translator prompt from the preset/question/facility inputs."""
    facility = clean_facility_text(facility_text)
    preset_question = TABLE_PRESETS.get(selected_table, "")
    question = (question_text or "").strip()

    if selected_table != "Custom / free text":
        # If the user types a vague phrase like "the whole table", prefer the preset request.
        if not question or question.lower() in {"the whole table", "whole table", "table", "all"}:
            question = preset_question

    if facility and not has_explicit_location_context(question):
        question = f"{question} for {facility}" if question else facility

    return question.strip()

with left:
    st.markdown('<div class="card compact-panel">', unsafe_allow_html=True)
    mode_col, table_col = st.columns(2, gap="medium")
    with mode_col:
        request_mode = st.selectbox(
            "What do you want to do?",
            ["Extract analytics table", "List hospitals / counties / facilities", "Geographical hierarchy"],
            index=0,
        )
    with table_col:
        selected_table = st.selectbox(
            "Choose a table",
            list(TABLE_PRESETS.keys()) if request_mode == "Extract analytics table" else (
                ["Custom / free text", "All hospitals", "All counties", "All facilities"] if request_mode == "List hospitals / counties / facilities" else ["Custom / free text", "Subcounties in a county", "Wards in a subcounty", "Hospitals in a county", "Hospitals in a subcounty"]
            ),
            index=0,
        )

    question = st.text_area(
        "What do you want to extract?",
        value=TABLE_PRESETS[selected_table],
        height=120,
        placeholder="Type the table you want in plain English...",
    )

    facility_required = request_mode == "Extract analytics table" and (selected_table != "Custom / free text" or not has_explicit_location_context(question))
    hierarchy_required = request_mode == "Geographical hierarchy" and selected_table != "Custom / free text"
    facility_name = ""
    lower_left, lower_right = st.columns(2, gap="medium")
    with lower_left:
        if facility_required or hierarchy_required:
            facility_name = st.text_input(
                "Which facility / base geography?",
                placeholder="Enter the facility, county, subcounty, or ward name",
            )
    with lower_right:
        save_csv = st.checkbox("Save the returned table as CSV", value=False)
    run_query = st.button("Run DHIS2 query", type="primary", use_container_width=False)
    st.markdown("</div>", unsafe_allow_html=True)

with right:
    st.markdown('<div class="card">', unsafe_allow_html=True)
    st.subheader("How it works")
    st.write("1. Type the table you want.")
    st.write("2. Check CSV only if you want the result saved.")
    st.write("3. Run the query and inspect the returned rows.")
    st.caption("This UI uses the same translator logic as the CLI script.")
    st.markdown("</div>", unsafe_allow_html=True)

if run_query:
    if request_mode == "List hospitals / counties / facilities":
        final_question = (question or "").strip()
        if selected_table == "All hospitals":
            final_question = final_question or "list all hospitals"
        elif selected_table == "All counties":
            final_question = final_question or "list all counties"
        elif selected_table == "All facilities":
            final_question = final_question or "list all facilities"
    elif request_mode == "Geographical hierarchy":
        final_question = (question or "").strip()
        if selected_table == "Subcounties in a county":
            final_question = final_question or "list all subcounties in a county"
        elif selected_table == "Wards in a subcounty":
            final_question = final_question or "list all wards in a subcounty"
        elif selected_table == "Hospitals in a county":
            final_question = final_question or "list all hospitals in a county"
        elif selected_table == "Hospitals in a subcounty":
            final_question = final_question or "list all hospitals in a subcounty"
    else:
        final_question = build_question_from_ui(selected_table, question, facility_name)

    if (facility_required or hierarchy_required) and not clean_facility_text(facility_name):
        st.error("That request needs a base geography. Please type one in the location box.")
    else:
        if not final_question:
            st.error("Please enter a question.")
        else:
            with st.spinner("Translating and fetching DHIS2 data..."):
                if request_mode == "Geographical hierarchy" or detect_geo_hierarchy_intent(final_question):
                    final_question = f"{final_question} for {clean_facility_text(facility_name)}" if clean_facility_text(facility_name) and not has_explicit_location_context(final_question) else final_question
                    result = fetch_geo_hierarchy_result(
                        final_question,
                        export_csv=save_csv or wants_csv_export(final_question),
                    )
                    generated_url = None
                elif request_mode == "List hospitals / counties / facilities" or detect_metadata_list_intent(final_question):
                    result = fetch_metadata_result(
                        final_question,
                        export_csv=save_csv or wants_csv_export(final_question),
                    )
                    generated_url = None
                else:
                    generated_url = generate_dhis2_url(final_question)
                    if not generated_url:
                        st.error("Could not generate a valid DHIS2 URL for that request.")
                        result = None
                    else:
                        result = fetch_query_result(
                            generated_url,
                            export_csv=save_csv or wants_csv_export(final_question),
                            user_question=final_question,
                        )

                if result and not result["ok"]:
                    st.error(result["error"])
                elif result and not result["rows"]:
                    st.warning(result["message"])
                    if generated_url:
                        st.code(generated_url, language="text")
                elif result:
                    st.success(f"Total rows: {result['total']}")
                    if generated_url:
                        st.code(generated_url, language="text")
                    else:
                        st.caption(f"Final prompt used: {final_question}")

                    df = pd.DataFrame(result["rows"])
                    st.dataframe(df, use_container_width=True, hide_index=True)

                    csv_data = df.to_csv(index=False).encode("utf-8")
                    st.download_button(
                        label="Download CSV",
                        data=csv_data,
                        file_name="dhis2_table.csv",
                        mime="text/csv",
                        use_container_width=True,
                    )

                    if result["saved_path"]:
                        st.info(f"Saved to: {result['saved_path']}")


# --- Project exports utility -------------------------------------------------
try:
    import export_project_structures as _export_projects
    _EXPORTS_AVAILABLE = True
except Exception:
    _export_projects = None
    _EXPORTS_AVAILABLE = False

st.markdown('''
<div class="card">
    <h3>Project exports</h3>
    <p>Generate project-specific org-structure CSVs (Jamii Tekelezi, CHAP Stawisha) and download as a zip.</p>
</div>
''', unsafe_allow_html=True)

if st.button("Generate project CSVs and ZIP"):
    if not _EXPORTS_AVAILABLE:
        st.error("Project exporter not available in the workspace.")
    else:
        with st.spinner("Generating project CSVs..."):
            try:
                _export_projects.main()
                # build in-memory zip of CSVs
                import io, zipfile, os

                buf = io.BytesIO()
                with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
                    for fname in sorted(os.listdir("exports")):
                        if fname.lower().endswith('.csv'):
                            zf.write(os.path.join('exports', fname), arcname=fname)
                buf.seek(0)
                st.success("Project CSVs generated.")
                st.download_button(
                    label="Download exports.zip",
                    data=buf.getvalue(),
                    file_name="exports.zip",
                    mime="application/zip",
                    use_container_width=True,
                )
            except Exception as e:
                st.error(f"Failed to generate project exports: {e}")
