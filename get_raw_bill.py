import os
import requests
import json
from dotenv import load_dotenv

# Load the CONGRESS_API_KEY from your .env file
load_dotenv()
API_KEY = os.environ.get("CONGRESS_API_KEY")

def get_raw_bill(congress, bill_type, bill_number):
    # Construct the Congress API URL
    url = f"https://api.congress.gov/v3/bill/{congress}/{bill_type}/{bill_number}?api_key={API_KEY}&format=json"
    
    # Fetch the data
    response = requests.get(url)
    data = response.json()
    
    # Extract just the 'bill' object (this matches your screenshot perfectly)
    if 'bill' in data:
        bill_data = data['bill']
        # Print it out beautifully formatted just like your image
        print(json.dumps(bill_data, indent=2))
    else:
        print("Bill not found or error occurred.")

# Example: Fetching HR 8401 from the 118th Congress
get_raw_bill("118", "hr", "8401")
