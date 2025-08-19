import os
from firebase_admin import credentials, initialize_app, firestore
import firebase_admin

def test_connection():
    try:
        # Check if the file exists
        cred_path = "./firebase-service-account.json"
        if not os.path.exists(cred_path):
            print(f"❌ Service account file not found at: {cred_path}")
            return False
        
        print(f"✅ Service account file found at: {cred_path}")
        
        # Initialize Firebase
        if not firebase_admin._apps:
            cred = credentials.Certificate(cred_path)
            initialize_app(cred, {
                'projectId': 'squareone-47b22',
            })
        
        # Test Firestore connection
        db = firestore.client()
        
        # Try to access Firestore (this will fail if permissions are wrong)
        collections = list(db.collections())
        print(f"✅ Successfully connected to Firestore!")
        print(f"📊 Found {len(collections)} collections")
        
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    test_connection()
