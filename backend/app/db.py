from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Float, JSON, select
from typing import List
import os

#______________________________________________________
# DATABASE CONFIGURATION
# Create an async engine based on DATABASE_URL and a sessionmaker for obtaining sessions
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite+aiosqlite:///./listings.db')
engine = create_async_engine(DATABASE_URL, echo=True) # Create async engine. Echo turned Off
AsyncSessionLocal = async_sessionmaker( # Create async session factory
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)
Base = declarative_base() # Create declarative base

#______________________________________________________
# OMR MODEL FOR LISTING
# Defines the listings table schema matching the Listing data structure
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
    condition_analysis   = Column(JSON, default=list)
    floorplan_analysis   = Column(JSON, default=list)

#______________________________________________________
# CREATE TABLE IF THEY DON'T EXIST
# Creates tables defined by ORM models if they don't exist
async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def init_db():
    await create_tables()

#______________________________________________________
# SAVE LISTING FUNCTION
# Inserts or updates a listing record by merging into the session and committing
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
# FETCH ALL LISTINGS FUNCTION
# Retrieves all listing rows, converts each ORM object to a dict, and returns the list
async def get_all_listings() -> List[dict]:
    async with AsyncSessionLocal() as session:
        try:
            stmt = select(ListingORM)
            result = await session.execute(stmt)
            db_listings = result.scalars().all()
            listings = []
            for db_listing in db_listings:
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
                listings.append(listing_dict)
            
            return listings
        except Exception as e:
            print(f"Error retrieving listings: {e}")
            return []
