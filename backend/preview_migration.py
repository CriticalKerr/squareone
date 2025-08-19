import asyncio
import sys
sys.path.append('.')

from app.db import get_all_listings

async def preview_migration():
    print("🔍 Previewing what would be migrated...")
    
    listings = await get_all_listings()
    print(f"📊 Found {len(listings)} listings in SQLite")
    
    if listings:
        print("\n📋 First 3 listings that would be migrated:")
        for i, listing in enumerate(listings[:3]):
            print(f"\n   Listing {i+1}:")
            print(f"   - ID: {listing.get('id')}")
            print(f"   - Title: {listing.get('title')}")
            print(f"   - Address: {listing.get('address', 'N/A')}")
            print(f"   - Price: {listing.get('price', 'N/A')}")
            print(f"   - Property Type: {listing.get('property_type', 'N/A')}")
            print(f"   - Condition: {listing.get('condition_analysis', 'N/A')}")
    
    print(f"\n✅ Preview complete. {len(listings)} listings ready for migration.")

if __name__ == "__main__":
    asyncio.run(preview_migration())
