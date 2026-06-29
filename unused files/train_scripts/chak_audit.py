import streamlit as st
import pandas as pd
import plotly.express as px

# 1. PAGE CONFIGURATION
st.set_page_config(page_title="CHAK M&E Audit Engine", page_icon="🏥", layout="wide")

# 2. DATA PIPELINE & PRE-PROCESSING
@st.cache_data
def load_and_prep_data():
    try:
        df = pd.read_csv("golden_executive_record.csv")
        
        # CORE FIX: Hard cap outliers before they ever reach the charts
        df = df[df['Total_Visits'] > 0].copy() # Remove zero-visit ghosts
        df['Total_Visits'] = df['Total_Visits'].clip(upper=5000) # Cap insane database errors
        
        # ALGORITHMIC AUDIT: Categorize clinics into Risk Tiers
        def categorize_risk(cost):
            if cost < 5: return "1. Highly Efficient (<$5)"
            elif cost < 15: return "2. Standard Operation ($5-$15)"
            else: return "3. Critical: Audit Required (>$15)"
            
        df['Risk_Tier'] = df['Cost_Per_ANC_Visit'].apply(categorize_risk)
        return df
    except FileNotFoundError:
        st.error("🚨 'golden_executive_record.csv' not found.")
        st.stop()

df = load_and_prep_data()

# --- ADMIN CONTROLS ---
with st.sidebar:
    st.header("⚙️ Engine Controls")
    if st.button("🔄 Force Data Refresh"):
        st.cache_data.clear()
        st.rerun()

# 3. HEADER & AUTOMATED NARRATIVE
st.title("🏥 CHAK Automated Efficiency Audit")
st.markdown("### Algorithmic M&E and Financial Triage System")
st.divider()

# Calculate global metrics
total_spend = df['Monthly_Expenditure_USD'].sum()
total_visits = df['Total_Visits'].sum()
avg_cost = total_spend / total_visits
critical_clinics = len(df[df['Risk_Tier'] == "3. Critical: Audit Required (>$15)"])

# THE AUTOMATED NARRATIVE: Let Python write the report
st.info(f"**🤖 SYSTEM AUDIT SUMMARY:** The network processed **{total_visits:,}** ANC visits at a total cost of **${total_spend:,.2f}**. The system average is **${avg_cost:,.2f}** per visit. However, the algorithm has flagged **{critical_clinics} facilities** operating at a critical financial burn rate (>$15/visit). Immediate administrative triage is recommended for the red zones below.")

# 4. GLOBAL KPIs
col1, col2, col3, col4 = st.columns(4)
col1.metric("Total Monthly Expenditure", f"${total_spend:,.2f}")
col2.metric("Total ANC Visits", f"{total_visits:,}")
col3.metric("System Average Cost", f"${avg_cost:,.2f}")
col4.metric("🚨 Critical Facilities Flagged", f"{critical_clinics}", delta="Action Required", delta_color="inverse")

st.divider()

# 5. ADVANCED CHART 1: The Executive Treemap
st.subheader("1. The Heat Map: Volume vs. Efficiency")
st.markdown("The **size** of the box represents patient volume. The **color** represents the financial burn rate. (Dark Red = Burning Cash).")

# Filter out tiny clinics just so the Treemap looks clean and beautiful
tree_df = df[df['Total_Visits'] > 50].copy()
tree_df['Color_Cap'] = tree_df['Cost_Per_ANC_Visit'].clip(upper=30) 

fig_tree = px.treemap(
    tree_df, 
    path=[px.Constant("CHAK Network"), 'Risk_Tier', 'Facility'], 
    values='Total_Visits',
    color='Color_Cap',
    hover_data={'Cost_Per_ANC_Visit': ':.2f'},
    color_continuous_scale='RdYlGn_r', 
    color_continuous_midpoint=10 
)
fig_tree.update_layout(height=600, margin=dict(t=20, l=10, r=10, b=10))
st.plotly_chart(fig_tree, use_container_width=True)

st.divider()

# Create two columns for the next two charts
left_col, right_col = st.columns(2)

with left_col:
    # 6. ADVANCED CHART 2: The Triage Funnel
    st.subheader("2. Network Triage Funnel")
    st.markdown("Categorization of all facilities by efficiency.")
    
    funnel_data = df.groupby('Risk_Tier').size().reset_index(name='Facility Count')
    funnel_data = funnel_data.sort_values('Risk_Tier')
    
    fig_funnel = px.funnel(
        funnel_data, 
        y='Risk_Tier', 
        x='Facility Count',
        color='Risk_Tier',
        color_discrete_map={
            "1. Highly Efficient (<$5)": "#2ca02c", 
            "2. Standard Operation ($5-$15)": "#ff7f0e", 
            "3. Critical: Audit Required (>$15)": "#d62728"
        }
    )
    fig_funnel.update_layout(height=450, showlegend=False)
    st.plotly_chart(fig_funnel, use_container_width=True)

with right_col:
    # 7. ADVANCED CHART 3: The Precision Radar (Top 10 Worst)
    st.subheader("3. Immediate Audit Targets")
    st.markdown("The top 10 facilities with the highest Cost-per-Visit.")
    
    top_10 = df.sort_values('Cost_Per_ANC_Visit', ascending=False).head(10)
    
    fig_bar = px.bar(
        top_10, 
        x='Cost_Per_ANC_Visit', 
        y='Facility',
        orientation='h', 
        color='Cost_Per_ANC_Visit',
        color_continuous_scale='Reds',
        text='Cost_Per_ANC_Visit'
    )
    fig_bar.update_traces(texttemplate='$%{text:.2f}', textposition='inside')
    fig_bar.update_layout(yaxis={'categoryorder':'total ascending'}, height=450, showlegend=False)
    st.plotly_chart(fig_bar, use_container_width=True)

# 8. RAW DATA
with st.expander("🔍 View Raw Audit Dataset"):
    st.dataframe(df.style.highlight_max(subset=['Cost_Per_ANC_Visit'], color='#ffcccc'), use_container_width=True)