# Property filing cabinet. Saves and finds listings in the cloud database.

import os
from typing import List, Optional, Dict, Any
from firebase_admin import credentials, initialize_app, firestore
import firebase_admin
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class FirestoreDB:
    def __init__(self):
        self._db = None
        self._initialize_firebase()

    def _initialize_firebase(self):
        """Initialize Firebase Admin SDK if not already initialized"""
        if not firebase_admin._apps:
            project_id = os.getenv('FIREBASE_PROJECT_ID', 'squareone-47b22')

            # IMPORTANT:
            # - On Cloud Run, do NOT use a JSON key file. Use ADC (service identity).
            # - For local dev, you *may* set GOOGLE_APPLICATION_CREDENTIALS to a JSON file path.
            cred_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')  # no default repo file

            if cred_path and os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
            else:
                cred = credentials.ApplicationDefault()

            initialize_app(cred, {'projectId': project_id})

        self._db = firestore.client()

    @property
    def db(self):
        """Get Firestore database client"""
        if self._db is None:
            self._initialize_firebase()
        return self._db


# Create a singleton instance
firestore_db = FirestoreDB()


#______________________________________________________
# FIRESTORE DATABASE FUNCTIONS
#______________________________________________________

async def init_db():
    """Initialize database - for Firestore, this is mostly a no-op"""
    print("✅ Firestore database ready")
    return True

#______________________________________________________
# SAVE A LISTING
async def save_listing(listing_data: dict) -> bool:
    """Save or update a listing in Firestore"""
    try:
        db = firestore_db.db

        # If there's an 'id' field, use it as document ID and remove from data
        doc_id = listing_data.pop('id', None)

        if doc_id:
            # Update existing document
            doc_ref = db.collection('listings').document(str(doc_id))
            doc_ref.set(listing_data, merge=True)
            print(f"Updated listing with ID: {doc_id}")
        else:
            # Create new document
            doc_ref = db.collection('listings').add(listing_data)[1]
            print(f"Created new listing with ID: {doc_ref.id}")

        return True
    except Exception as e:
        print(f"Error saving listing to Firestore: {e}")
        return False

#______________________________________________________
# GET ALL LISTINGS
async def get_all_listings() -> List[dict]:
    """Get all listings from Firestore"""
    try:
        db = firestore_db.db
        docs = db.collection('listings').stream()

        listings = []
        for doc in docs:
            listing_data = doc.to_dict()
            listing_data['id'] = doc.id  # Add Firestore document ID
            listings.append(listing_data)

        print(f"Retrieved {len(listings)} listings from Firestore")
        return listings
    except Exception as e:
        print(f"Error retrieving all listings from Firestore: {e}")
        return []

#______________________________________________________
# GET LISTING BY ID
async def get_listing_by_id(listing_id: str) -> Optional[dict]:
    """Get a specific listing by its Firestore document ID"""
    try:
        db = firestore_db.db
        doc_ref = db.collection('listings').document(str(listing_id))
        doc = doc_ref.get()

        if doc.exists:
            listing_data = doc.to_dict()
            listing_data['id'] = doc.id
            print(f"Retrieved listing with ID: {listing_id}")
            return listing_data
        else:
            print(f"No listing found with ID: {listing_id}")
            return None
    except Exception as e:
        print(f"Error retrieving listing {listing_id} from Firestore: {e}")
        return None

#______________________________________________________
# SEARCH LISTINGS BY LOCATION
async def search_listings_by_location(search_query: str) -> List[dict]:
    """Search listings by address, title, or property type"""
    try:
        db = firestore_db.db
        search_term = search_query.strip().lower()

        # Firestore doesn't have case-insensitive search, so we'll get all and filter
        docs = db.collection('listings').stream()

        matching_listings = []
        for doc in docs:
            listing_data = doc.to_dict()
            listing_data['id'] = doc.id

            # Check if search term matches any of these fields (case-insensitive)
            address = (listing_data.get('address', '') or '').lower()
            title = (listing_data.get('title', '') or '').lower()
            property_type = (listing_data.get('property_type', '') or '').lower()

            if (search_term in address or
                    search_term in title or
                    search_term in property_type):
                matching_listings.append(listing_data)

        print(f"Search for '{search_query}' returned {len(matching_listings)} results")
        return matching_listings
    except Exception as e:
        print(f"Error searching listings in Firestore: {e}")
        return []

#______________________________________________________
# GET LISTINGS IN BOUNDS
async def get_listings_in_bounds(min_lng: float, min_lat: float, max_lng: float, max_lat: float) -> List[dict]:
    """Get listings within geographical bounds"""
    try:
        db = firestore_db.db

        # Firestore geo queries are complex, so we'll get all and filter in Python
        docs = db.collection('listings').stream()

        listings_in_bounds = []
        for doc in docs:
            listing_data = doc.to_dict()
            listing_data['id'] = doc.id

            lat = listing_data.get('latitude', 0.0)
            lng = listing_data.get('longitude', 0.0)

            # Check if coordinates are within bounds
            if (min_lng <= lng <= max_lng and min_lat <= lat <= max_lat):
                listings_in_bounds.append(listing_data)

        print(f"Bounds search returned {len(listings_in_bounds)} results")
        return listings_in_bounds
    except Exception as e:
        print(f"Error retrieving listings in bounds from Firestore: {e}")
        return []

#______________________________________________________
# DEBUG: CHECK ALL LISTINGS
async def debug_check_listings():
    """Print out IDs and titles of all listings"""
    try:
        db = firestore_db.db
        docs = db.collection('listings').stream()

        listings = []
        for doc in docs:
            listing_data = doc.to_dict()
            listings.append({
                'id': doc.id,
                'title': listing_data.get('title', 'No title')
            })

        print(f"Found {len(listings)} listings in Firestore:")
        for listing in listings:
            print(f"  ID: {listing['id']}, Title: {listing['title']}")
        return listings
    except Exception as e:
        print(f"Error checking listings in Firestore: {e}")
        return []
