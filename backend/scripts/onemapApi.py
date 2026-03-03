import os
import requests
import json
from pathlib import Path
from dotenv import load_dotenv

def test_onemap_auth():
    # Resolve project root and load local env files explicitly.
    project_root = Path(__file__).resolve().parents[2]
    env_local_path = project_root / ".env.local"
    env_path = project_root / ".env"
    load_dotenv(dotenv_path=env_local_path)
    load_dotenv(dotenv_path=env_path)

    # Get credentials from environment variables
    email = os.environ.get("ONEMAP_EMAIL")
    password = os.environ.get("ONEMAP_PASSWORD")

    if not email or not password:
        print("Error: ONEMAP_EMAIL or ONEMAP_PASSWORD not found in .env.local or .env.")
        return

    url = "https://www.onemap.gov.sg/api/auth/post/getToken"
    
    payload = {
        "email": email,
        "password": password
    }
    
    headers = {
        "Content-Type": "application/json"
    }

    print(f"Attempting to authenticate with OneMap using email: {email}")
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        
        # Check if the request was successful
        response.raise_for_status()
        
        # Parse the JSON response
        data = response.json()
        
        print("\nAuthentication Successful!")
        print("Response Data:")
        print(json.dumps(data, indent=2))
        
        # Extract the token if present
        token = data.get("access_token")
        if token:
            print(f"\nSuccessfully retrieved access token (first 20 chars): {token[:20]}...")
            
    except requests.exceptions.HTTPError as e:
        print(f"\nHTTP Error: {e}")
        print(f"Response content: {response.text}")
    except Exception as e:
        print(f"\nAn error occurred: {e}")

if __name__ == "__main__":
    test_onemap_auth()
