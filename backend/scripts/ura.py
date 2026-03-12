import os
from pathlib import Path
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Initialise Supabase
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


FILE = "retail_transactions.csv"


def save_ura_retail_transactions():
    script_dir = Path(__file__).parent
    base = script_dir.parent.parent
    csv_path = base / "database" / "retail_transactions.csv"
    df = pd.read_csv(csv_path)
    
    df.rename(columns={
        "Project Name": "project_name",
        "Street Name": "street_name",
        "Property Type": "property_type",
        "Sale Date": "sale_date",
        "Transacted Price ($)": "transacted_price",
        "Unit Price ($ PSF)": "unit_price_psf",
        "Area (SQFT)": "area_sqft",
        "Postal District": "postal_district",
        "Floor Level": "floor_level",
        "Tenure": "tenure",
        "latitude": "latitude",
        "longitude": "longitude",
        "geocoded_address": "geocoded_address",
        "price_level": "price_level",
        "psf_level": "psf_level"
    }, inplace=True)
    
    df = df.drop_duplicates(subset=["project_name", "street_name", "sale_date", "floor_level"])

    records = df.to_dict(orient="records")
    try:
        supabase.table("ura_retail_transactions").upsert(
            records,
            on_conflict="project_name, street_name, sale_date, floor_level"
        ).execute()
        print(f"Saved retail transactions successfully.")
    except Exception as e:
        print("Exception occurred:", e)
    
    
    
if __name__ == "__main__":
    save_ura_retail_transactions()