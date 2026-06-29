import pandas as pd
import numpy as np

print("🟢 Starting Phase 3: The Finance-M&E Data Fusion...")

try:
    # 1. Load the clinical data you just extracted
    clinical_df = pd.read_csv("clinical_mch_data.csv")
    print(f"✅ Loaded {len(clinical_df)} clinical records.")
except FileNotFoundError:
    print("🔴 Error: Could not find 'clinical_mch_data.csv'.")
    exit()

# 2. Extract the unique facilities to generate fake financial data
unique_facilities = clinical_df['Facility'].unique()
months = clinical_df['Month'].unique()
print(f"✅ Found {len(unique_facilities)} unique facilities.")

# 3. Generate Synthetic Financial Data (The "ERP" Export)
finance_records = []
for facility in unique_facilities:
    for month in months:
        # Generate a random monthly expenditure between $500 and $3000 USD
        budget_spent = np.random.uniform(500, 3000)
        finance_records.append({
            'Facility': facility,
            'Month': month,
            'Monthly_Expenditure_USD': round(budget_spent, 2)
        })

finance_df = pd.DataFrame(finance_records)
print(f"✅ Generated {len(finance_df)} fake financial records.")

# 4. THE FUSION (SQL-style JOIN in Pandas)
print("🟢 Merging Clinical and Financial Datasets...")
golden_df = pd.merge(clinical_df, finance_df, on=['Facility', 'Month'], how='inner')

# 5. THE EXECUTIVE METRIC: Cost per Outcome
# Calculate how much money was spent to get one woman to attend an ANC visit
golden_df['Cost_Per_ANC_Visit'] = golden_df['Monthly_Expenditure_USD'] / golden_df['Total_Visits']

# Clean up infinite values (in case a facility had 0 visits but still spent money)
golden_df.replace([np.inf, -np.inf], np.nan, inplace=True)
golden_df['Cost_Per_ANC_Visit'] = golden_df['Cost_Per_ANC_Visit'].round(2)

# 6. Export the Final Asset
golden_df.to_csv("golden_executive_record.csv", index=False)
print("\n✅ FUSION COMPLETE! Exported 'golden_executive_record.csv'")

# Find the worst performing facility (Highest cost per visit)
worst_performer = golden_df.sort_values(by='Cost_Per_ANC_Visit', ascending=False).dropna().iloc[0]

print("\n🚨 EXECUTIVE ALERT (Flagging Inefficiency):")
print(f"Facility: {worst_performer['Facility']}")
print(f"Month: {worst_performer['Month']}")
print(f"ANC Visits: {worst_performer['Total_Visits']}")
print(f"Money Spent: ${worst_performer['Monthly_Expenditure_USD']}")
print(f"Cost per single ANC visit: ${worst_performer['Cost_Per_ANC_Visit']}")