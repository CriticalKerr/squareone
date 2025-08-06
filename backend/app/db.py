from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Float, JSON, select, or_, and_
from typing import List
import os

#______________________________________________________
# DATABASE CONFIGURATION
# Make a database connection and session maker so we can save and get items
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite+aiosqlite:///./listings.db')
engine = create_async_engine(DATABASE_URL, echo=True) # This talks to the database and shows SQL in logs
AsyncSessionLocal = async_sessionmaker( # Create an async session factory
    engine,
    class_=AsyncSession,
    expire_on_commit=False # Keep data available after saving
)
Base = declarative_base() # Base class for our tables

#______________________________________________________
# LISTING TABLE MODEL
# Define how a property listing looks in the database
class ListingORM(Base):
    __tablename__ = 'listings'
    id = Column(Integer, primary_key=True, index=True)
    listing_link = Column(String, nullable=False)
    title = Column(String, nullable=False)
    address = Column(String, nullable=False)
    price = Column(String, nullable=False)
    latitude = Column(Float, default=0.0)
    longitude = Column(Float, default=0.0)
    image_urls = Column(JSON, default=list)
    floorplan_urls = Column(JSON, default=list)
    bedrooms_count = Column(Integer, default=0)
    bathrooms_count = Column(Integer, default=0)
    property_type = Column(String, default='')

    # Defines the listings
    condition_analysis   = Column(JSON, default=list)
    floorplan_analysis   = Column(JSON, default=list)
    refurb_cost_estimate = Column(JSON, default=dict)



#______________________________________________________
# MAKE TABLES
# Create the listings table if it doesn't already exist
async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def init_db():
    await create_tables()

#______________________________________________________
# SAVE A LISTING
# Put a listing into the database or update it if it's already there
async def save_listing(listing_data: dict) -> bool:
    async with AsyncSessionLocal() as session:
        try:
            obj = ListingORM(**listing_data)
            await session.merge(obj)
            await session.commit()
            return True
        except Exception as e:
            await session.rollback()
            print(f"Error saving listing: {e}")
            return False



#______________________________________________________
# FETCH SINGLE LISTING BY ID
# Retrieves a specific listing by its ID
async def get_listing_by_id(listing_id: int) -> dict:
    async with AsyncSessionLocal() as session:
        try:
            stmt = select(ListingORM).where(ListingORM.id == listing_id)
            result = await session.execute(stmt)
            db_listing = result.scalar_one_or_none()

            if not db_listing:
                return None

            listing_dict = {
                "id": db_listing.id,
                "listing_link": db_listing.listing_link,
                "title": db_listing.title,
                "address": db_listing.address,
                "price": db_listing.price,
                "latitude": db_listing.latitude,
                "longitude": db_listing.longitude,
                "image_urls": db_listing.image_urls or [],
                "floorplan_urls": db_listing.floorplan_urls or [],
                "bedrooms_count": db_listing.bedrooms_count,
                "bathrooms_count": db_listing.bathrooms_count,
                "property_type": db_listing.property_type,
                "condition_analysis": db_listing.condition_analysis or [],
                "floorplan_analysis": db_listing.floorplan_analysis or [],
            }
            return listing_dict
        except Exception as e:
            print(f"Error retrieving listing {listing_id}: {e}")
            return None

#______________________________________________________
# FETCH SINGLE LISTING BY ID
# Retrieves a specific listing by its ID
async def get_listing_by_id(listing_id: int) -> dict:
    async with AsyncSessionLocal() as session:
        try:
            stmt = select(ListingORM).where(ListingORM.id == listing_id)
            result = await session.execute(stmt)
            db_listing = result.scalar_one_or_none()

            if not db_listing:
                print(f"No listing found with ID {listing_id}")
                return None

            listing_dict = {
                "id": db_listing.id,
                "listing_link": db_listing.listing_link,
                "title": db_listing.title,
                "address": db_listing.address,
                "price": db_listing.price,
                "latitude": db_listing.latitude,
                "longitude": db_listing.longitude,
                "image_urls": db_listing.image_urls or [],
                "floorplan_urls": db_listing.floorplan_urls or [],
                "bedrooms_count": db_listing.bedrooms_count,
                "bathrooms_count": db_listing.bathrooms_count,
                "property_type": db_listing.property_type,
                "condition_analysis": db_listing.condition_analysis or [],
                "floorplan_analysis": db_listing.floorplan_analysis or [],
                "refurb_cost_estimate": db_listing.refurb_cost_estimate or {},
            }
            print(f"Successfully retrieved listing {listing_id}")  # Added debug logging
            return listing_dict
        except Exception as e:
            print(f"Error retrieving listing {listing_id}: {e}")
            return None

#______________________________________________________
# HELPER: CONVERT ORM TO DICT
# Turn a database object into a normal Python dict
def listing_orm_to_dict(db_listing: ListingORM) -> dict:
    return {
        "id": db_listing.id,
        "listing_link": db_listing.listing_link,
        "title": db_listing.title,
        "address": db_listing.address,
        "price": db_listing.price,
        "latitude": db_listing.latitude,
        "longitude": db_listing.longitude,
        "image_urls": db_listing.image_urls or [],
        "floorplan_urls": db_listing.floorplan_urls or [],
        "bedrooms_count": db_listing.bedrooms_count,
        "bathrooms_count": db_listing.bathrooms_count,
        "property_type": db_listing.property_type,
        "condition_analysis": db_listing.condition_analysis or [],
        "floorplan_analysis": db_listing.floorplan_analysis or [],
        "refurb_cost_estimate": db_listing.refurb_cost_estimate or {},
    }

#______________________________________________________
# GET ALL LISTINGS
# Grab every listing in the database and return a list of dicts
async def get_all_listings() -> List[dict]:
    async with AsyncSessionLocal() as session:
        try:
            stmt = select(ListingORM)
            result = await session.execute(stmt)
            db_listings = result.scalars().all()
            listings = [listing_orm_to_dict(db_listing) for db_listing in db_listings]
            return listings
        except Exception as e:
            print(f"Error retrieving listings: {e}")
            return []

#______________________________________________________
# SEARCH LISTINGS BY LOCATION
# Look for listings where the address, title, or type has the search words
async def search_listings_by_location(search_query: str) -> List[dict]:
    async with AsyncSessionLocal() as session:
        try:
            search_term = f"%{search_query.strip().lower()}%"
            
            stmt = select(ListingORM).where(
                or_(
                    ListingORM.address.ilike(search_term),
                    ListingORM.title.ilike(search_term),
                    ListingORM.property_type.ilike(search_term)
                )
            )
            
            result = await session.execute(stmt)
            db_listings = result.scalars().all()
            listings = [listing_orm_to_dict(db_listing) for db_listing in db_listings]
            
            print(f"Search for '{search_query}' returned {len(listings)} results")
            return listings
        except Exception as e:
            print(f"Error searching listings by location: {e}")
            return []

#______________________________________________________
# GET LISTINGS IN BOUNDS
# Find listings inside the box defined by min/max latitude and longitude
async def get_listings_in_bounds(min_lng: float, min_lat: float, max_lng: float, max_lat: float) -> List[dict]:
    async with AsyncSessionLocal() as session:
        try:
            stmt = select(ListingORM).where(
                and_(
                    ListingORM.longitude >= min_lng,
                    ListingORM.longitude <= max_lng,
                    ListingORM.latitude >= min_lat,
                    ListingORM.latitude <= max_lat
                )
            )
            
            result = await session.execute(stmt)
            db_listings = result.scalars().all()
            listings = [listing_orm_to_dict(db_listing) for db_listing in db_listings]
            
            print(f"Bounds search returned {len(listings)} results")
            return listings
        except Exception as e:
            print(f"Error retrieving listings in bounds: {e}")
            return []

#______________________________________________________
# DEBUG: CHECK ALL LISTINGS
# Print out IDs and titles of all listings to see what's inside
async def debug_check_listings():
    async with AsyncSessionLocal() as session:
        try:
            stmt = select(ListingORM.id, ListingORM.title)
            result = await session.execute(stmt)
            listings = result.all()
            print(f"Found {len(listings)} listings in database:")
            for listing in listings:
                print(f"  ID: {listing.id}, Title: {listing.title}")
            return listings
        except Exception as e:
            print(f"Error checking listings: {e}")
            return []