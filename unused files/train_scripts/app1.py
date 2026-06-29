import streamlit as st
import pandas as pd
import plotly.express as px
import os
import re

try:
    from google import genai
except ImportError:
    genai = None

from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx

if __name__ == "__main__" and get_script_run_ctx(suppress_warning=True) is None:
    print("Run this app with: streamlit run app1.py")
    raise SystemExit(0)

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv():
        return None

# 1. PAGE CONFIGURATION (Must be the very first Streamlit command)
st.set_page_config(page_title="CHAK Executive Engine", page_icon="📊", layout="wide")

st.markdown(
    """
    <style>
    .assistant-launcher-anchor + div {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 9999;
        margin: 0;
        width: 78px;
        height: 78px;
    }

    .assistant-launcher-anchor + div > div {
        border-radius: 999px;
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.18);
        overflow: hidden;
    }

    .assistant-popup-anchor + div {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 10000;
        width: 300px;
        max-width: calc(100vw - 40px);
        margin: 0;
    }

    .assistant-popup-anchor + div > div {
        background: rgba(255, 255, 255, 0.98);
        border: 1px solid rgba(25, 55, 109, 0.16);
        border-radius: 16px;
        box-shadow: 0 22px 48px rgba(0, 0, 0, 0.20);
        padding: 0.75rem;
        backdrop-filter: blur(14px);
    }

    .assistant-popup-anchor + div h1,
    .assistant-popup-anchor + div h2,
    .assistant-popup-anchor + div h3,
    .assistant-popup-anchor + div p {
        margin-top: 0;
        margin-bottom: 0.35rem;
    }

    .assistant-popup-anchor + div [data-testid="stChatMessage"] {
        border-radius: 12px;
        margin-bottom: 0.35rem;
    }

    .assistant-popup-anchor + div [data-testid="stTextInput"] input {
        background: white;
        border: 1px solid rgba(25, 55, 109, 0.18);
        border-radius: 12px;
    }

    .assistant-popup-anchor + div [data-testid="stButton"] button {
        border-radius: 999px;
        height: 40px;
        font-weight: 650;
    }

    .assistant-popup-anchor + div [data-testid="stFormSubmitButton"] button {
        height: 36px;
        border-radius: 999px;
        font-weight: 650;
        font-size: 0.9rem;
    }

    .assistant-popup-anchor + div .assistant-popup-thread {
        max-height: 240px;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
model_name = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")

ai_model = None
if api_key and genai is not None:
    ai_model = genai.Client(api_key=api_key)

# 2. DATA LOADING & CACHING
# @st.cache_data prevents the app from re-reading the CSV every time you click a button
@st.cache_data
def load_data():
    try:
        df = pd.read_csv("golden_executive_record.csv")
        return df
    except FileNotFoundError:
        st.error("🚨 Critical Error: 'golden_executive_record.csv' not found. Please ensure it is in the same folder as this script.")
        st.stop()

df = load_data()


# ── ART Optimization Data ────────────────────────────────────────────────
@st.cache_data
def load_art_data():
    """Load HIV newly started on ART chart values and display export."""
    art_monthly = pd.DataFrame()
    art_facilities = pd.DataFrame()
    art_indicators = pd.DataFrame()
    try:
        chart_path = "data/dhis/processed/hiv_newly_started_art_chart_values.csv"
        display_path = "data/dhis/processed/hiv_newly_started_art_display_export.csv"
        if os.path.exists(chart_path):
            raw = pd.read_csv(chart_path)
            # Split into monthly trend vs top facilities
            art_monthly = raw[raw["chart"] == "New Starts on ART by Month"].copy()
            art_monthly["period_label"] = art_monthly["period_label"].astype(str)
            art_monthly["value"] = pd.to_numeric(art_monthly["total_new_starts_on_art"], errors="coerce")
            art_monthly = art_monthly.sort_values("period_dhis")
            art_facilities = raw[raw["chart"] == "Top Facilities – New Starts on ART"].copy()
            art_facilities["value"] = pd.to_numeric(art_facilities["total_new_starts_on_art"], errors="coerce")
            art_facilities = art_facilities.sort_values("value", ascending=True)
        if os.path.exists(display_path):
            art_indicators = pd.read_csv(display_path)
    except Exception:
        pass
    return art_monthly, art_facilities, art_indicators

art_monthly, art_facilities, art_indicators = load_art_data()


def build_ai_context(dataframe: pd.DataFrame) -> str:
    sample_facilities = dataframe["Facility"].dropna().astype(str).head(5).tolist()
    top_rows = dataframe[["Facility", "Cost_Per_ANC_Visit", "Monthly_Expenditure_USD"]].sort_values(
        "Cost_Per_ANC_Visit", ascending=False
    ).head(5)
    table_lines = ["| Facility | Cost Per ANC Visit | Monthly Expenditure USD |", "|---|---:|---:|"]
    for _, row in top_rows.iterrows():
        table_lines.append(f"| {row['Facility']} | {row['Cost_Per_ANC_Visit']:.2f} | {row['Monthly_Expenditure_USD']:.2f} |")
    return (
        f"Dataset: golden_executive_record.csv with {len(dataframe):,} clinics.\n"
        f"Sample facilities: {', '.join(sample_facilities) if sample_facilities else 'Unavailable'}.\n"
        f"Available columns: {', '.join(dataframe.columns)}.\n"
        f"Top clinics:\n{'\n'.join(table_lines)}"
    )


def get_ai_reply(prompt: str, dataframe: pd.DataFrame) -> str:
    if ai_model is None:
        return "AI Assistant is not configured yet. Add GEMINI_API_KEY to enable chat."

    context = build_ai_context(dataframe)
    response = ai_model.models.generate_content(
        model=model_name,
        contents=(
            f"Use this context to answer the question.\n\n{context}\n\nQuestion: {prompt}\n\n"
            "Format the answer with a short brief first, then a short explanation, then a tiny table if helpful."
        )
    )
    text = getattr(response, "text", "").strip()
    text = re.sub(r"```sql.*?```", "", text, flags=re.DOTALL | re.IGNORECASE).strip()
    return text or "I could not generate a response right now."


if "assistant_messages" not in st.session_state:
    st.session_state.assistant_messages = [
        {"role": "assistant", "content": "I am CHAK AI. Ask me about the clinic data, cost trends, or efficiency risks."}
    ]

# 3. HEADER UI
st.title("🏛️ CHAK Executive Intelligence")
st.markdown("### Cost-vs-Impact: ANC Maternal Health Analysis")
st.divider()

# 4. GLOBAL KPIs (The 3-Second Rule)
total_spend = df['Monthly_Expenditure_USD'].sum()
total_visits = df['Total_Visits'].sum()

# Prevent division by zero just in case
if total_visits > 0:
    avg_cost = total_spend / total_visits
else:
    avg_cost = 0

# Create three columns for the metric cards
col1, col2, col3 = st.columns(3)
col1.metric("Total Monthly Expenditure", f"${total_spend:,.2f}")
col2.metric("Total ANC Visits", f"{total_visits:,}")
col3.metric("Average System Cost per Visit", f"${avg_cost:,.2f}")

st.divider()

# 5. MAIN VISUALIZATION: The Inefficiency Radar (Bar Chart)
st.subheader("Top 20 Most Inefficient Facilities")
st.markdown("Immediate audit required for facilities with the highest cost per ANC visit.")

# THE FIX: Sort by highest cost and only grab the top 20 rows so it's readable
top_20_worst = df.sort_values('Cost_Per_ANC_Visit', ascending=False).head(20)

# Color the absolute worst one red, keep the rest standard blue
worst_facility = top_20_worst.iloc[0]['Facility']
color_discrete_map = {facility: 'red' if facility == worst_facility else '#1f77b4' for facility in top_20_worst['Facility']}

fig_bar = px.bar(
    top_20_worst, 
    x='Facility', 
    y='Cost_Per_ANC_Visit',
    color='Facility',
    color_discrete_map=color_discrete_map,
    text='Cost_Per_ANC_Visit',
    labels={'Cost_Per_ANC_Visit': 'Cost per Visit ($)', 'Facility': 'Clinic Name'}
)
fig_bar.update_traces(texttemplate='$%{text:.2f}', textposition='outside', showlegend=False)
# Angle the x-axis labels so they don't overlap
fig_bar.update_layout(uniformtext_minsize=10, uniformtext_mode='hide', height=500, xaxis_tickangle=-45)

st.plotly_chart(fig_bar, width='stretch')

st.divider()

# 6. SECONDARY VISUALIZATION: The Matrix (Scatter Plot)
st.subheader("Volume vs. Expenditure Matrix")
st.markdown("Visualizing the relationship between clinical impact (visits) and financial burn rate.")

# THE FIX: Apply realistic clinical boundaries to drop insane database outliers and ghosts
# We only plot clinics that saw between 10 and 5,000 patients.
clean_df = df[(df['Total_Visits'] >= 10) & (df['Total_Visits'] <= 5000)].copy()

# Cap the Cost_Per_ANC_Visit at $100 for the color scale so one crazy clinic doesn't wash out the colors
clean_df['Color_Score'] = clean_df['Cost_Per_ANC_Visit'].clip(upper=100)

fig_scatter = px.scatter(
    clean_df, 
    x='Total_Visits', 
    y='Monthly_Expenditure_USD', 
    size='Total_Visits', # Bigger clinics get larger bubbles
    color='Color_Score',
    hover_name='Facility',
    hover_data={'Cost_Per_ANC_Visit': ':.2f', 'Color_Score': False}, 
    color_continuous_scale=px.colors.sequential.YlOrRd, # Yellow to Red scale
    labels={
        'Total_Visits': 'Total Clinical Visits (Impact)',
        'Monthly_Expenditure_USD': 'Monthly Budget Spent (Cost)',
        'Color_Score': 'Efficiency Score'
    }
)

# Use a Logarithmic Scale to spread the squished dots out beautifully
fig_scatter.update_xaxes(type="log", title="Total Clinical Visits (Log Scale)")

fig_scatter.update_layout(height=500)
# Add dashed lines to show the average spend and average visits across the cleaned dataset
fig_scatter.add_hline(y=clean_df['Monthly_Expenditure_USD'].mean(), line_dash="dot", annotation_text="Avg Spend")
fig_scatter.add_vline(x=clean_df['Total_Visits'].mean(), line_dash="dot", annotation_text="Avg Visits")

st.plotly_chart(fig_scatter, width='stretch')

# 7. RAW DATA TABLE (For the Analysts)
with st.expander("🔍 View Raw Fused Dataset"):
    st.markdown("Complete underlying data joining DHIS2 clinical records with financial expenditure.")
    st.dataframe(df.style.highlight_max(subset=['Cost_Per_ANC_Visit'], color='#ffcccc'), width='stretch')

# ═══════════════════════════════════════════════════════════════════════════
# ART OPTIMIZATION DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════
st.divider()
st.title("💊 ART Optimization")
st.markdown("### HIV Program Performance: New Starts, Trends & Facility Insights")

if not art_monthly.empty:
    # ── ART KPIs ──────────────────────────────────────────────────────────
    total_new_starts = int(art_monthly["value"].sum())
    avg_monthly = round(art_monthly["value"].mean(), 1)
    peak_month_row = art_monthly.loc[art_monthly["value"].idxmax()]
    peak_month = f"{peak_month_row['period_label']} ({int(peak_month_row['value'])})"
    latest_month_row = art_monthly.iloc[-1]
    latest_starts = int(latest_month_row["value"])
    # MoM change
    if len(art_monthly) >= 2:
        prev_month_val = art_monthly.iloc[-2]["value"]
        mom_change = latest_starts - prev_month_val
        mom_change_pct = round((mom_change / prev_month_val) * 100, 1) if prev_month_val else 0
    else:
        mom_change = 0
        mom_change_pct = 0

    art_col1, art_col2, art_col3, art_col4 = st.columns(4)
    art_col1.metric("Total New ART Starts (All Time)", f"{total_new_starts:,}")
    art_col2.metric("Avg Monthly Starts", f"{avg_monthly:,.1f}")
    art_col3.metric("Peak Month", peak_month)
    art_col4.metric(
        f"Latest Month ({latest_month_row['period_label']})",
        f"{latest_starts:,}",
        delta=f"{mom_change:+,} ({mom_change_pct:+.1f}%)" if mom_change else None,
    )

    st.divider()

    # ── Chart 1: TX_NEW Monthly Trend ────────────────────────────────────
    art_col_left, art_col_right = st.columns([3, 2])

    with art_col_left:
        st.subheader("📈 Newly Started on ART – Monthly Trend")
        st.markdown("Total new ART initiates aggregated across all CHAK facilities.")

        fig_trend = px.area(
            art_monthly,
            x="period_label",
            y="value",
            markers=True,
            title="",
            labels={"period_label": "Month", "value": "New ART Starts"},
        )
        fig_trend.update_traces(
            line=dict(color="#059669", width=3),
            marker=dict(size=8, color="#047857"),
            fillcolor="rgba(5, 150, 105, 0.12)",
        )
        # Add average reference line
        fig_trend.add_hline(
            y=avg_monthly,
            line_dash="dash",
            line_color="#ef4444",
            annotation_text=f"Avg: {avg_monthly:,.0f}",
        )
        fig_trend.update_layout(height=420, hovermode="x unified", margin=dict(l=20, r=20, t=10, b=10))
        st.plotly_chart(fig_trend, width="stretch")

    # ── Chart 2: Month-over-Month Change ─────────────────────────────────
    with art_col_right:
        st.subheader("📊 Month-over-Month Δ")
        st.markdown("Change in new ART starts versus the previous month.")

        art_monthly["prev_value"] = art_monthly["value"].shift(1)
        art_monthly["mom_delta"] = art_monthly["value"] - art_monthly["prev_value"]
        art_monthly["mom_pct"] = (art_monthly["mom_delta"] / art_monthly["prev_value"] * 100).round(1)
        mom_df = art_monthly.dropna(subset=["mom_delta"]).copy()
        mom_df["color"] = mom_df["mom_delta"].apply(lambda x: "#059669" if x >= 0 else "#ef4444")

        fig_mom = px.bar(
            mom_df,
            x="period_label",
            y="mom_delta",
            title="",
            labels={"period_label": "Month", "mom_delta": "Change in Starts"},
            color="color",
            color_discrete_map={"#059669": "#059669", "#ef4444": "#ef4444"},
        )
        fig_mom.update_traces(
            marker=dict(color=mom_df["color"].tolist()),
            text=mom_df["mom_delta"].apply(lambda x: f"{x:+,.0f}"),
            textposition="outside",
            showlegend=False,
        )
        fig_mom.update_layout(height=420, hovermode="x unified", margin=dict(l=20, r=20, t=10, b=10))
        st.plotly_chart(fig_mom, width="stretch")

    # ── Chart 3: Top Facilities ──────────────────────────────────────────
    if not art_facilities.empty:
        st.divider()
        st.subheader("🏥 Top Facilities – New ART Starts")
        st.markdown("Cumulative new ART initiates by facility. Top 15 shown.")

        top_n = art_facilities.tail(15)
        fig_fac = px.bar(
            top_n,
            x="value",
            y="facility",
            orientation="h",
            title="",
            labels={"value": "Total New ART Starts", "facility": ""},
            color="value",
            color_continuous_scale=["#a7f3d0", "#047857"],
            text="value",
        )
        fig_fac.update_traces(
            texttemplate="%{text:,}",
            textposition="outside",
            showlegend=False,
            marker=dict(line=dict(width=0)),
        )
        fig_fac.update_layout(
            height=480,
            yaxis=dict(categoryorder="total ascending"),
            margin=dict(l=20, r=60, t=10, b=10),
            coloraxis_showscale=False,
        )
        st.plotly_chart(fig_fac, width="stretch")

    # ── Chart 4: Program Composition (if indicator data available) ───────
    if not art_indicators.empty:
        st.divider()
        st.subheader("🔬 ART Program Indicator Coverage")
        st.markdown("Available TX_NEW indicators disaggregated by age, sex, and clinical category.")

        indicator_count = len(art_indicators[art_indicators["record_type"] == "indicator"])
        chart_count = len(art_indicators[art_indicators["record_type"] == "chart_data"])
        meta_col1, meta_col2 = st.columns(2)
        meta_col1.metric("Unique TX_NEW Indicators", str(indicator_count))
        meta_col2.metric("Pre-computed Chart Series", str(chart_count))

        # Show indicator list
        with st.expander("📋 View All ART Indicators"):
            ind_list = art_indicators[art_indicators["record_type"] == "indicator"][
                ["indicator_name", "indicator_id"]
            ].drop_duplicates().sort_values("indicator_name")
            st.dataframe(ind_list, use_container_width=True, hide_index=True)

else:
    st.warning(
        "⚠️ ART data not yet loaded. Please ensure `data/dhis/processed/hiv_newly_started_art_chart_values.csv` "
        "exists in the workspace. Run the DHIS export to populate ART metrics."
    )

st.markdown('<div class="assistant-launcher-anchor"></div>', unsafe_allow_html=True)

with st.popover("AI Assist 💬", use_container_width=True):
    st.markdown('<div class="assistant-popup-anchor"></div>', unsafe_allow_html=True)
    st.markdown("**AI Assist**")
    st.caption("Concise help on the dashboard data.")

    st.markdown("<div class='assistant-popup-thread'>", unsafe_allow_html=True)
    for message in st.session_state.assistant_messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])
    st.markdown("</div>", unsafe_allow_html=True)

    with st.form("assistant_form", clear_on_submit=True):
        user_prompt = st.text_input(
            "Ask the assistant",
            placeholder="Ask about spend, risk tiers, or clinic performance...",
            key="assistant_prompt_input",
            label_visibility="collapsed",
        )

        send_col, reset_col = st.columns([1.4, 1])
        with send_col:
            submitted = st.form_submit_button("Send", use_container_width=True)
        with reset_col:
            reset_pressed = st.form_submit_button("Reset", use_container_width=True)

    if submitted:
        if user_prompt.strip():
            st.session_state.assistant_messages.append({"role": "user", "content": user_prompt.strip()})
            reply = get_ai_reply(user_prompt.strip(), df)
            st.session_state.assistant_messages.append({"role": "assistant", "content": reply})
            st.rerun()
        else:
            st.warning("Type a question first.")

    if reset_pressed:
        st.session_state.assistant_messages = [st.session_state.assistant_messages[0]]
        st.rerun()