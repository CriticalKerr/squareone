
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Float, JSON
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
    floorplan_urls = Column(JSON, default=list)  # Changed to match Pydantic model

# Create tables
async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# Initialize database
async def init_db():
    await create_tables()