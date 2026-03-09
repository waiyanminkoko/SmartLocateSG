import os
import requests
import json
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

AUTH_URL = "https://www.onemap.gov.sg/api/auth/post/getToken"
ECONOMIC_STATUS_URL = "https://www.onemap.gov.sg/api/public/popapi/getEconomicStatus"
PLANNING_AREAS_URL = "https://www.onemap.gov.sg/api/public/popapi/getPlanningAreas"
PLANNING_AREA_BY_POINT_URL = "https://www.onemap.gov.sg/api/public/popapi/getPlanningarea"
HOUSEHOLD_MONTHLY_INCOME_URL = "https://www.onemap.gov.sg/api/public/popapi/getHouseholdMonthlyIncomeWork"
HOUSEHOLD_SIZE_URL = "https://www.onemap.gov.sg/api/public/popapi/getHouseholdSize"
INCOME_FROM_WORK_URL = "https://www.onemap.gov.sg/api/public/popapi/getIncomeFromWork"
POPULATION_AGE_GROUP_URL = "https://www.onemap.gov.sg/api/public/popapi/getPopulationAgeGroup"
HOUSEHOLD_STRUCTURE_URL = "https://www.onemap.gov.sg/api/public/popapi/getHouseholdStructure"

def _clean_env_value(key: str) -> str:
    value = os.environ.get(key, "")
    return value.strip().strip("\"' ")


def _print_onemap_api_error(response: requests.Response, api_name: str) -> None:
    """Print OneMap API error guidance in simple, readable format."""
    status = response.status_code
    response_text = (response.text or "").strip()
    response_text_lower = response_text.lower()

    print(f"\n{api_name} failed with HTTP {status}.")

    if status == 400:
        if "access token" in response_text_lower:
            print("400 - Please send the access token either in the request header as a bearer token.")
        elif "valid year" in response_text_lower:
            print("400 - Please enter valid year.")
        elif "planning area" in response_text_lower:
            print("400 - Please enter planning area.")
        elif "gender" in response_text_lower:
            print("400 - Your gender must be either male or female.")
        else:
            print("400 - Bad request. Please check your input parameters.")
    elif status == 401:
        print("401 - Token has expired: Session expired. Please refresh your token (if still within refresh window) or re-login.")
    elif status == 403:
        print("403 - Access Forbidden. GET access to component 'xxx' of service 'xxx' is not allowed by this user's role.")
    elif status == 429:
        print("429 - API limit(s) exceeded.")

    if response_text:
        print(f"Server response: {response_text}")


def _raise_with_onemap_error(response: requests.Response, api_name: str) -> None:
    if response.ok:
        return
    _print_onemap_api_error(response, api_name)
    response.raise_for_status()

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

def get_onemap_economic_status_by_planning_area(
    planning_area: str,
    year: str,
    gender: Optional[str] = None,
):
    """
    Get economic status by planning area.

    Parameters:
    - planningArea (string, required): Planning area name can be retrieved from
      "Names of planning area".
    - year (string, required): Years available are 2000, 2010, 2015, and 2020.
    - gender (string, optional): Male or female, returns all results by default.
    """
    if not planning_area:
        raise ValueError("planning_area is required.")
    if not year:
        raise ValueError("year is required. Use one of: 2000, 2010, 2015, 2020.")
    if gender and gender.lower() not in {"male", "female"}:
        raise ValueError("gender must be either 'male' or 'female'.")

    token = get_onemap_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    params = {"planningArea": planning_area, "year": year}
    if gender:
        params["gender"] = gender.lower()
    response = requests.get(ECONOMIC_STATUS_URL, headers=headers, params=params, timeout=30)
    _raise_with_onemap_error(response, "getEconomicStatus")
    print(response.text)
    return response.json()

def get_planning_area(latitude: str, longitude: str):
    """
    Get planning area using a latitude/longitude point.

    Parameters:
    - latitude (string, required): This represents the latitude of the point.
    - longitude (string, required): This represents the longitude of the point.
    - year (string, optional): If not specified, the latest data will be provided.
      Else, values available are 1998, 2008, 2014, and 2019.

    Note: We intentionally do not send `year` so OneMap returns the latest data.
    """
    token = get_onemap_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    params = {"latitude": latitude, "longitude": longitude}

    response = requests.get(
        PLANNING_AREA_BY_POINT_URL,
        headers=headers,
        params=params,
        timeout=30,
    )
    _raise_with_onemap_error(response, "getPlanningarea")
    print(response.text)
    return response.json()


def get_population_age_group(planning_area: str, year: str, gender: Optional[str] = None):
    """Get population age group by planning area."""
    if not planning_area or not year:
        raise ValueError("planning_area and year are required.")
    
    token = get_onemap_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    params = {"planningArea": planning_area, "year": year}
    if gender:
        params["gender"] = gender.lower()
        
    response = requests.get(POPULATION_AGE_GROUP_URL, headers=headers, params=params, timeout=30)
    _raise_with_onemap_error(response, "getPopulationAgeGroup")
    print(f"--- Population Age Group ({planning_area}, {year}) ---")
    print(response.text)
    return response.json()


def get_household_monthly_income_work(planning_area: str, year: str):
    """Get household monthly income from work by planning area."""
    if not planning_area or not year:
        raise ValueError("planning_area and year are required.")

    token = get_onemap_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    params = {"planningArea": planning_area, "year": year}

    response = requests.get(HOUSEHOLD_MONTHLY_INCOME_URL, headers=headers, params=params, timeout=30)
    _raise_with_onemap_error(response, "getHouseholdMonthlyIncomeWork")
    print(f"--- Household Monthly Income ({planning_area}, {year}) ---")
    print(response.text)
    return response.json()


def get_income_from_work(planning_area: str, year: str, gender: Optional[str] = None):
    """
    Get income from work by planning area.

    Parameters:
    - planningArea (string, required): Planning area name can be retrieved from
      "Names of planning area".
    - year (string, required): Years available are 2000, 2010, 2015, and 2020.
    - gender (string, optional): Male or female, returns all results by default.
    """
    if not planning_area:
        raise ValueError("planning_area is required.")
    if not year:
        raise ValueError("year is required. Use one of: 2000, 2010, 2015, 2020.")
    if gender and gender.lower() not in {"male", "female"}:
        raise ValueError("gender must be either 'male' or 'female'.")

    token = get_onemap_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    params = {"planningArea": planning_area, "year": year}
    if gender:
        params["gender"] = gender.lower()
    response = requests.get(INCOME_FROM_WORK_URL, headers=headers, params=params, timeout=30)
    _raise_with_onemap_error(response, "getIncomeFromWork")
    print(f"--- Income From Work ({planning_area}, {year}) ---")
    print(response.text)
    return response.json()


def get_household_size(planning_area: str, year: str):
    """Get household size by planning area."""
    if not planning_area or not year:
        raise ValueError("planning_area and year are required.")

    token = get_onemap_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    params = {"planningArea": planning_area, "year": year}

    response = requests.get(HOUSEHOLD_SIZE_URL, headers=headers, params=params, timeout=30)
    _raise_with_onemap_error(response, "getHouseholdSize")
    print(f"--- Household Size ({planning_area}, {year}) ---")
    print(response.text)
    return response.json()


def get_household_structure(planning_area: str, year: str):
    """Get household structure by planning area."""
    if not planning_area or not year:
        raise ValueError("planning_area and year are required.")

    token = get_onemap_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    params = {"planningArea": planning_area, "year": year}

    response = requests.get(HOUSEHOLD_STRUCTURE_URL, headers=headers, params=params, timeout=30)
    _raise_with_onemap_error(response, "getHouseholdStructure")
    print(f"--- Household Structure ({planning_area}, {year}) ---")
    print(response.text)
    return response.json()


if __name__ == "__main__":
    test_onemap_auth()
    
    # Test retrieving the API requests mentioned
    try:
        get_population_age_group("Bedok", "2020", "female")
        get_household_monthly_income_work("Bedok", "2020")
        get_household_size("Bedok", "2020")
        get_household_structure("Bedok", "2020")
        get_planning_area("1.3", "103.8")
    except Exception as e:
        print(f"Test failed: {e}")
