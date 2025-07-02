
import os
from pathlib import Path
from dotenv import load_dotenv

# Get the current file's directory
current_dir = Path(__file__).parent

# Load .env file from the correct location
env_path = current_dir / '.env'
print(f"Looking for .env file at: {env_path}")
load_dotenv(env_path)

# Print the API key
api_key = os.getenv('SCRAPFLY_API_KEY')
print(f"API Key found: {'Yes' if api_key else 'No'}")
if api_key:
    # Print first and last 4 chars of the key for verification
    print(f"API Key starts with {api_key[:4]}... and ends with ...{api_key[-4:]}")