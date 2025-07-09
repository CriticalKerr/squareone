<<<<<<< HEAD

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Float, JSON
=======
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Float, JSON, select
from typing import List
>>>>>>> 47609739 (003- WIP on Visions.py for LLM intergration and listings database populated. Getting errors on some openai imports and FastAPI 'on_event' startup issues.  Main.py ammended and scraper.py commented out for now.)
import os

# Database configuration
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite+aiosqlite:///./listings.db')

# Create async engine
engine = create_async_engine(DATABASE_URL, echo=True)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Create declarative base
Base = declarative_base()

# ORM Model for Listing
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
<<<<<<< HEAD
    floorplan_urls = Column(JSON, default=list)  # Changed to match Pydantic model
=======
    floorplan_urls = Column(JSON, default=list)
    bedrooms_count = Column(Integer, default=0)
    bathrooms_count = Column(Integer, default=0)
    property_type = Column(String, default='')
>>>>>>> 47609739 (003- WIP on Visions.py for LLM intergration and listings database populated. Getting errors on some openai imports and FastAPI 'on_event' startup issues.  Main.py ammended and scraper.py commented out for now.)

# Create tables
async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# Initialize database
async def init_db():
<<<<<<< HEAD
    await create_tables()
=======
    await create_tables()

# Database functions
async def save_listing(listing_data: dict) -> bool:
    """Save a listing to the database"""
    async with AsyncSessionLocal() as session:
        try:
            db_listing = ListingORM(**listing_data)
            session.add(db_listing)
            await session.commit()
            return True
        except Exception as e:
            await session.rollback()
            print(f"Error saving listing: {e}")
            return False

async def get_all_listings() -> List[dict]:
    """Retrieve all listings from the database"""
    async with AsyncSessionLocal() as session:
        try:
            stmt = select(ListingORM)
            result = await session.execute(stmt)
            db_listings = result.scalars().all()
            
            # Convert to dict format
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
                }
                listings.append(listing_dict)
            
            return listings
        except Exception as e:
            print(f"Error retrieving listings: {e}")
            return []
>>>>>>> 47609739 (003- WIP on Visions.py for LLM intergration and listings database populated. Getting errors on some openai imports and FastAPI 'on_event' startup issues.  Main.py ammended and scraper.py commented out for now.)
