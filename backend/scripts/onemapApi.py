import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

AUTH_URL = "https://www.onemap.gov.sg/api/auth/post/getToken"
ECONOMIC_STATUS_URL = "https://www.onemap.gov.sg/api/public/popapi/getEconomicStatus"
PLANNING_AREAS_URL = "https://www.onemap.gov.sg/api/public/popapi/getPlanningAreas"
HOUSEHOLD_MONTHLY_INCOME_URL = "https://www.onemap.gov.sg/api/public/popapi/getHouseholdMonthlyIncome"
HOUSEHOLD_SIZE_URL = "https://www.onemap.gov.sg/api/public/popapi/getHouseholdSize"
INCOME_FROM_WORK_URL = "https://www.onemap.gov.sg/api/public/popapi/getIncomeFromWork"
POPULATION_AGE_GROUP_URL = "https://www.onemap.gov.sg/api/public/popapi/getPopulationAgeGroup"

def get_onemap_access_token() -> str:
    response = requests.post(
        AUTH_URL,
        json={"email": os.environ.get("ONEMAP_EMAIL"), "password": os.environ.get("ONEMAP_PASSWORD")},
        headers={"Content-Type": "application/json"},
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    token = data.get("access_token")
    if not token:
        raise ValueError(f"OneMap auth succeeded but no access token in response: {data}")
    return token

def test_onemap_auth():
    email = _clean_env_value("ONEMAP_EMAIL")
    password = _clean_env_value("ONEMAP_PASSWORD")

    if not email or not password:
        print("Error: ONEMAP_EMAIL or ONEMAP_PASSWORD not found in .env file.")
        return

    payload = {
        "email": email,
        "password": password
    }
    
    headers = {
        "Content-Type": "application/json"
    }

    print(f"Attempting to authenticate with OneMap using email: {email}")
    
    try:
        response = requests.post(AUTH_URL, json=payload, headers=headers, timeout=30)
        
        # Check if the request was successful
        response.raise_for_status()
        
        # Parse the JSON response
        data = response.json()
        
        print("\nAuthentication Successful!")
        print("Response Data:")
        print(json.dumps(data, indent=2))
            
    except requests.exceptions.HTTPError as e:
        print(f"\nHTTP Error: {e}")
        print(f"Response content: {response.text}")
    except Exception as e:
        print(f"\nAn error occurred: {e}")

def get_onemap_economic_status_by_planning_area(planning_area: str):
    token = _clean_env_value("ONEMAP_ACCESS_TOKEN") or get_onemap_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    params = {"planningArea": planning_area, "year": 2020, "gender": "male"}
    response = requests.get(ECONOMIC_STATUS_URL, headers=headers, params=params, timeout=30)
    print(response.text)
    return response.json()

def get_planning_areas():
    get_onemap_access_token()


if __name__ == "__main__":
    test_onemap_auth()
    get_onemap_economic_status_by_planning_area("Bedok")
   
