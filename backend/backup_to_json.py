import asyncio
import json
import os
import sys
from datetime import datetime

# Make sure we can import from the app directory
sys.path.append('.')

from app.db import get_all_listings, debug_check_listings

async def backup_to_json():
    """Export all listings to JSON file"""
    try:
        # Get all listings
        listings = await get_all_listings()
        
        # Create backup with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"listings_backup_{timestamp}.json"
        
        # Save to JSON
        with open(backup_filename, 'w') as f:
            json.dump({
                "backup_date": timestamp,
                "total_listings": len(listings),
                "listings": listings
            }, f, indent=2, default=str)
        
        print(f"✅ Successfully backed up {len(listings)} listings to {backup_filename}")
        
        # Also run debug check to see what we have
        print("\n📊 Database contents:")
        await debug_check_listings()
        
        return backup_filename
        
    except Exception as e:
        print(f"❌ Backup failed: {e}")
        return None

if __name__ == "__main__":
    asyncio.run(backup_to_json())
