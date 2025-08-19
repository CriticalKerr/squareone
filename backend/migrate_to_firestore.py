import asyncio
import json
import os
import sys
from dotenv import load_dotenv
from firebase_admin import credentials, initialize_app, firestore
import firebase_admin

# Load environment variables
load_dotenv()

# Add the current directory to Python path so we can import from app
sys.path.append('.')

from app.db import get_all_listings

def initialize_firebase():
    """Initialize Firebase Admin SDK"""
    if not firebase_admin._apps:
        cred_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS', './firebase-service-account.json')
        project_id = os.getenv('FIREBASE_PROJECT_ID', 'squareone-47b22')
        
        print(f"🔍 Looking for credentials at: {cred_path}")
        
        if not os.path.exists(cred_path):
            raise Exception(f"Firebase credentials not found at {cred_path}")
        
        print(f"✅ Found credentials file")
        
        cred = credentials.Certificate(cred_path)
        initialize_app(cred, {'projectId': project_id})
        print(f"✅ Firebase initialized for project: {project_id}")
    
    return firestore.client()

async def migrate_sqlite_to_firestore():
    """Migrate all listings from SQLite to Firestore"""
    
    print("🚀 Starting migration from SQLite to Firestore...")
    
    try:
        # Initialize Firestore
        print("\n1. Initializing Firestore connection...")
        db = initialize_firebase()
        print("   ✅ Firestore connected successfully")
        
        # Get all listings from SQLite
        print("\n2. Reading listings from SQLite database...")
        listings = await get_all_listings()
        
        if not listings:
            print("   ❌ No listings found in SQLite database")
            return False
            
        print(f"   ✅ Found {len(listings)} listings in SQLite")
        
        # Check what's already in Firestore
        print("\n3. Checking existing data in Firestore...")
        existing_docs = list(db.collection('listings').stream())
        existing_count = len(existing_docs)
        print(f"   📊 Found {existing_count} existing listings in Firestore")
        
        if existing_count > 0:
            print("   ⚠️  Firestore already has data!")
            for doc in existing_docs[:3]:
                data = doc.to_dict()
                print(f"      - {doc.id}: {data.get('title', 'No title')}")
            response = input("   Continue with migration anyway? (y/N): ")
            if response.lower() != 'y':
                print("   ❌ Migration cancelled by user")
                return False
        
        # Migrate each listing
        print("\n4. Migrating listings to Firestore...")
        migrated = 0
        errors = 0
        
        batch = db.batch()
        batch_size = 10
        
        for i, listing in enumerate(listings):
            try:
                # Remove the SQLAlchemy ID since Firestore will generate its own
                listing_data = listing.copy()
                original_id = listing_data.pop('id', None)
                
                # Create a new document reference
                doc_ref = db.collection('listings').document()
                batch.set(doc_ref, listing_data)
                
                print(f"   📝 Prepared listing {i+1}/{len(listings)} (Original ID: {original_id})")
                print(f"      Title: {listing.get('title', 'No title')[:50]}...")
                
                # Commit batch every batch_size documents
                if (i + 1) % batch_size == 0:
                    batch.commit()
                    print(f"   ✅ Committed batch of {batch_size} listings")
                    batch = db.batch()  # Create new batch
                
                migrated += 1
                
            except Exception as e:
                print(f"   ❌ Error preparing listing {i+1}: {e}")
                errors += 1
        
        # Commit remaining documents
        if migrated % batch_size != 0:
            batch.commit()
            print(f"   ✅ Committed final batch")
        
        print(f"\n🎉 Migration completed!")
        print(f"   ✅ Successfully migrated: {migrated} listings")
        if errors > 0:
            print(f"   ❌ Errors encountered: {errors} listings")
        
        # Verify the migration
        print("\n5. Verifying migration...")
        final_docs = list(db.collection('listings').stream())
        final_count = len(final_docs)
        print(f"   📊 Firestore now contains {final_count} listings")
        
        # Show sample of migrated data
        print("\n📋 Sample of migrated listings:")
        for i, doc in enumerate(final_docs[:5]):
            data = doc.to_dict()
            title = data.get('title', 'No title')
            address = data.get('address', 'No address')
            print(f"   {i+1}. ID: {doc.id}")
            print(f"      Title: {title}")
            print(f"      Address: {address}")
        
        return migrated > 0
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    try:
        success = asyncio.run(migrate_sqlite_to_firestore())
        if success:
            print("\n🎉 Migration completed successfully!")
            print("Your data is now safely stored in Firestore.")
            print("\nNext steps:")
            print("1. Update your backend code to use Firestore")
            print("2. Test your app with the new database")
            print("3. Keep SQLite as backup until everything works")
        else:
            print("\n❌ Migration failed or was cancelled.")
    except Exception as e:
        print(f"Migration error: {e}")
