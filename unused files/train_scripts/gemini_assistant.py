import streamlit as st
import google.generativeai as genai
import pandas as pd
import sqlite3
import re
import os
from dotenv import load_dotenv

# 1. CREDENTIALS & CONFIGURATION
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
model_name = os.getenv("GEMINI_MODEL", "gemini-3.5-flash") 

if not api_key:
    st.error("🚨 API Key not found. Please check your .env file.")
    st.stop()
    
genai.configure(api_key=api_key)

st.set_page_config(page_title="CHAK AI", page_icon="✨", layout="wide", initial_sidebar_state="collapsed")

# 2. THE DATA PIPELINE
@st.cache_resource
def setup_database():
    conn = sqlite3.connect(':memory:', check_same_thread=False)
    try:
        df = pd.read_csv("golden_executive_record.csv")
        df.to_sql('clinics', conn, index=False, if_exists='replace')
        schema = pd.io.sql.get_schema(df, 'clinics')
        return conn, schema
    except FileNotFoundError:
        return None, None

conn, database_schema = setup_database()

if not conn:
    st.error("🚨 'golden_executive_record.csv' not found. Cannot build database.")
    st.stop()

# 3. AGENT SYSTEM INSTRUCTIONS (THE MAJOR UPGRADE)
# We have rewritten the prompt to force the AI to act like a Senior Consultant.
system_prompt = (
    "You are an elite Data Engineer and Senior M&E Consultant for the CHAK Network.\n"
    "You have access to a SQLite database. The main table is named 'clinics'.\n\n"
    f"Here is the exact schema for the table:\n{database_schema}\n\n"
    "When the user asks a question, produce a response with three parts in this order: a one-line brief (no headings), a concise explanation describing the data source (where the data comes from, how many clinics are represented, and example facilities), and finally a minimal SQL `SELECT` query in a ```sql code block that reproduces the data.\n\n"
    "Formatting rules: \n"
    "- Do NOT include Markdown headings like '### Short Brief' or '### Explanation'. The brief must be a single sentence on its own line.\n"
    "- The Explanation must focus on the data source (file/table), the scope (e.g., number of clinics), and example facilities — not on how to extract the data.\n"
    "- Then include a markdown code block with the SQL labeled as ```sql. Use exact column names from the schema and never use `SELECT *`.\n\n"
    "Example Response (no headings):\n"
    "Five clinics account for 48% of ANC costs — immediate review recommended.\n\n"
    "Data source: golden_executive_record.csv with ~3,000 clinics. Example facilities include County Hospital A, Sub-County Clinic B, and Dispensary C. The dataset contains columns: Facility, County, Cost_Per_ANC_Visit, Monthly_Expenditure_USD.\n\n"
    "```sql\n"
    "SELECT Facility, Cost_Per_ANC_Visit FROM clinics ORDER BY Cost_Per_ANC_Visit DESC LIMIT 5;\n"
    "```\n"
)

model = genai.GenerativeModel(
    model_name=model_name,
    system_instruction=system_prompt
)

# 4. UI & CHAT HISTORY
st.title("✨ CHAK Executive Intelligence")
st.markdown("Ask me to analyze the network. I will provide the context, and pull the exact data.")

if "chat_session" not in st.session_state:
    st.session_state.chat_session = model.start_chat(history=[])
    st.session_state.messages = [
        {"role": "assistant", "content": "Good morning. I am connected to the CHAK database. How can we optimize the network today?"}
    ]

for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])
        if "data_table" in message:
            st.dataframe(message["data_table"], hide_index=True, use_container_width=True)

# 5. THE AI ROUTING ENGINE
if prompt := st.chat_input("E.g., Which 5 clinics have the highest Cost Per ANC Visit?"):
    
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    try:
        with st.chat_message("assistant"):
            with st.spinner("🤖 Analyzing metrics and querying the database..."):
                response = st.session_state.chat_session.send_message(prompt)
                response_text = response.text
                
                # EXTRACT SQL
                sql_match = re.search(r"```sql\s*(.*?)\s*```", response_text, re.DOTALL | re.IGNORECASE)
                extracted_df = None
                
                # CLEAN TEXT: Hide the SQL engine from the user
                clean_text = re.sub(r"```sql.*?```", "", response_text, flags=re.DOTALL | re.IGNORECASE).strip()

                # Build a one-line brief (use model's first sentence if present)
                sentences = re.split(r'(?<=[\.\!\?])\s+', clean_text.strip(), maxsplit=1)
                brief_line = sentences[0].strip() if sentences and sentences[0] else ""

                # Gather data-source metadata from the database to create an explanation about the data itself
                explanation_parts = []
                try:
                    total_clinics_df = pd.read_sql_query("SELECT COUNT(*) AS cnt FROM clinics", conn)
                    total_clinics = int(total_clinics_df['cnt'].iloc[0])
                    explanation_parts.append(f"Data source: golden_executive_record.csv containing {total_clinics} clinics.")
                except Exception:
                    explanation_parts.append("Data source: golden_executive_record.csv (clinic count unavailable).")

                # Detect facility-like column name
                try:
                    cols_df = pd.read_sql_query("PRAGMA table_info(clinics)", conn)
                    cols = cols_df['name'].tolist()
                except Exception:
                    cols = []

                facility_col = None
                for c in cols:
                    if re.search(r'facility|site|name', c, re.IGNORECASE):
                        facility_col = c
                        break
                if not facility_col and cols:
                    facility_col = cols[0]

                # Example facilities
                try:
                    if facility_col:
                        sample_q = f'SELECT DISTINCT "{facility_col}" AS facility FROM clinics LIMIT 5'
                        sample_df = pd.read_sql_query(sample_q, conn)
                        sample_list = sample_df['facility'].dropna().astype(str).tolist()
                        if sample_list:
                            example_text = f"Example facilities include: {', '.join(sample_list)}."
                            explanation_parts.append(example_text)
                except Exception:
                    pass

                if cols:
                    explanation_parts.append(f"Columns available: {', '.join(cols)}.")

                explanation_text = ' '.join(explanation_parts)

                # If brief_line is empty, synthesize a neutral brief
                if not brief_line:
                    brief_line = "See the SQL below for the exact data results."

                # Final text: brief (no headings) then explanation about data source
                final_text = f"{brief_line}\n\n{explanation_text}"

                if sql_match:
                    sql_query = sql_match.group(1).strip()
                    try:
                        extracted_df = pd.read_sql_query(sql_query, conn)
                    except Exception:
                        clean_text += "\n\n*(Note: I encountered a slight issue formatting the exact table, but my analysis above still stands.)*"

            # Display the brief and data-source explanation first
            st.markdown(final_text)
            
            # Then reveal the data table underneath it
            if extracted_df is not None:
                st.dataframe(extracted_df, hide_index=True, use_container_width=True)

            # Save to history
            message_data = {"role": "assistant", "content": final_text}
            if extracted_df is not None:
                message_data["data_table"] = extracted_df
                
            st.session_state.messages.append(message_data)
            
    except Exception as e:
        st.error(f"Network Error: {e}")