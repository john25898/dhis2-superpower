import os
import requests
from requests.auth import HTTPBasicAuth
import pandas as pd
from dotenv import load_dotenv

# 1. Load credentials securely
load_dotenv()
BASE_URL = os.getenv("DHIS_BASE_URL")
USERNAME = os.getenv("DHIS_USERNAME")
PASSWORD = os.getenv("DHIS_PASSWORD")

def clean_html(raw_html):
    """DHIS2 descriptions often contain HTML tags. This cleans them out."""
    if pd.isna(raw_html):
        return ""
    import re
    cleanr = re.compile('<.*?>')
    return re.sub(cleanr, '', str(raw_html)).strip()

def extract_master_dictionary():
    print("🚀 Booting up Master Extractor: Deep System Scan Initiated...")
    os.makedirs("dictionaries", exist_ok=True)
    
    # Use a Session for faster, persistent connections
    session = requests.Session()
    session.auth = (USERNAME, PASSWORD)
    
    # The ultimate list of fields to ensure NO text is missed
    fields = "fields=id,name,displayName,shortName,code,description&paging=false"
    
    # The 6 buckets of DHIS2 Analytics Data
    endpoints = [
        ("dataElements", "Data Element"),
        ("indicators", "Indicator"),
        ("programIndicators", "Program Indicator (Tracker)"),
        ("dataSets", "Data Set (Form)"),
        ("dataElementGroups", "Data Element Group"),
        ("indicatorGroups", "Indicator Group")
    ]
    
    all_metrics = []

    for endpoint, metric_type in endpoints:
        print(f"📥 Scanning {metric_type}s...")
        url = f"{BASE_URL}{endpoint}.json?{fields}"
        
        try:
            response = session.get(url, timeout=30)
            
            if response.status_code == 200:
                data = response.json().get(endpoint, [])
                
                # Normalize the data and add our custom 'type' label
                for item in data:
                    all_metrics.append({
                        "id": item.get("id", ""),
                        "type": metric_type,
                        "name": item.get("name", ""),
                        "displayName": item.get("displayName", ""),
                        "shortName": item.get("shortName", ""),
                        "code": item.get("code", ""),
                        "description": clean_html(item.get("description", ""))
                    })
                print(f"   -> Found {len(data)} items.")
            else:
                print(f"   ⚠️ Warning: Server returned {response.status_code} for {endpoint}")
                
        except requests.exceptions.Timeout:
            print(f"   🚨 Timeout Error: The {endpoint} endpoint took too long to respond.")
        except Exception as e:
            print(f"   🚨 Error fetching {endpoint}: {e}")

    print("\n🧬 Merging and structuring the Master Brain...")
    
    # Convert to Pandas DataFrame
    df_combined = pd.DataFrame(all_metrics)
    
    # Create the ULTIMATE search string column for the AI
    # This combines every possible text field into one giant string, forcing it to lowercase
    df_combined['search_text'] = (
        df_combined['name'].fillna('') + " | " +
        df_combined['displayName'].fillna('') + " | " +
        df_combined['shortName'].fillna('') + " | " +
        df_combined['code'].fillna('') + " | " +
        df_combined['description'].fillna('')
    ).str.lower()
    
    # Save to CSV
    filepath = os.path.join("dictionaries", "master_data_elements.csv")
    df_combined.to_csv(filepath, index=False)
    
    print("✅ DEEP SCAN COMPLETE!")
    print(f"📦 Total Unique Metrics Extracted: {len(df_combined)}")
    print(f"📁 Saved Master Dictionary to: {filepath}")
    
    # Final sanity check for the user
    malaria_count = df_combined['search_text'].str.contains('malaria', case=False, na=False).sum()
    print(f"\n🔍 Quick Sanity Check: Found the word 'Malaria' in {malaria_count} different metrics!")

if __name__ == "__main__":
    extract_master_dictionary()