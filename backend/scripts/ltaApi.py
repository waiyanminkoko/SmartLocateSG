import os
import requests
from dotenv import load_dotenv
from supabase import create_client, Client


load_dotenv()


SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


MRT_EXITS_ID = "d_b39d3a0871985372d7e1637193335da5"
BUS_STOPS_ID = "d_3f172c6feb3f4f92a2f47d93eed2908a"


def save_mrt_exits():
    url = f"https://api-open.data.gov.sg/v1/public/api/datasets/{MRT_EXITS_ID}/poll-download"
    response = requests.get(url)
    json_data = response.json()
    if json_data['code'] != 0:
        print(json_data['errMsg'])
        exit(1)

    download_url = json_data['data']['url']
    geojson = requests.get(download_url).json()
    
    records_dict = {}
    for feature in geojson['features']:
        props = feature['properties']
        coords = feature['geometry']['coordinates']
        key = (props["STATION_NA"], props["EXIT_CODE"])

        # Keep the first occurrence only
        if key not in records_dict:
            records_dict[key] = {
            "station_name": props["STATION_NA"],
            "exit_number": props["EXIT_CODE"],
            "latitude": coords[1],
            "longitude": coords[0]
        }

    records = list(records_dict.values())
    print(f"Prepared {len(records)} unique MRT exits for upsert.")

    try:
        resp = supabase.table("datagov_mrt_exits").upsert(
        records,
            on_conflict="station_name, exit_number"
            ).execute()
        inserted = len(resp.data) if getattr(resp, "data", None) is not None else len(records)
        print(f"Upserted {inserted} MRT exits successfully.")
    except Exception as err:
        print("Error upserting data:", err)
        
        
def save_bus_stops():
    url = f"https://api-open.data.gov.sg/v1/public/api/datasets/{BUS_STOPS_ID}/poll-download"
    response = requests.get(url)
    json_data = response.json()
    if json_data['code'] != 0:
        print(json_data['errMsg'])
        exit(1)

    download_url = json_data['data']['url']
    geojson = requests.get(download_url).json()
    
    records_dict = {}
    for feature in geojson['features']:
        props = feature['properties']
        coords = feature['geometry']['coordinates']
        key = props["BUS_STOP_NUM"]

        # Keep the first occurrence only
        if key not in records_dict:
            records_dict[key] = {
            "bus_stop_number": props["BUS_STOP_NUM"],
            "latitude": coords[1],
            "longitude": coords[0]
        }

    records = list(records_dict.values())
    print(f"Prepared {len(records)} unique bus stops for upsert.")

    try:
        resp = supabase.table("datagov_bus_stops").upsert(
            records,
            on_conflict="bus_stop_number"
        ).execute()
        inserted = len(resp.data) if getattr(resp, "data", None) is not None else len(records)
        print(f"Upserted {inserted} bus stops successfully.")
    except Exception as err:
        print("Error upserting data:", err)


if __name__ == "__main__":
    save_mrt_exits()
    save_bus_stops()