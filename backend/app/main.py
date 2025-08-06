import os
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from .db import (get_all_listings, search_listings_by_location, get_listings_in_bounds,init_db)
from .db import save_listing, get_listing_by_id
from contextlib import asynccontextmanager
from .pipeline import process_listing
from fastapi.staticfiles import StaticFiles
from .models import Listing

#______________________________________________________
# APPLICATION SETUP
# Creates the FastAPI app instance with metadata and configures CORS settings.
app = FastAPI(title="Property Listings API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#______________________________________________________
# DATABASE INITIALIZATION ON STARTUP
# Ensures that the database is initialized before handling any requests.
@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    await init_db()

#______________________________________________________
# LIFESPAN CONTEXT MANAGER
# Provides an alternative way to initialize the database for the app's lifespan.
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")

#______________________________________________________
# STATIC FILES
# Mounts the 'static' directory to serve CSS, JS, images, and other static assets.
app.mount(
    "/static",
    StaticFiles(directory=STATIC_DIR),
    name="static",
)

#______________________________________________________
# ADD LISTING ENDPOINT
# Accepts listing data in JSON, saves it into the database, and returns the saved record or an error.
@app.post("/add-listing", response_model=Listing)
async def add_listing(listing: Listing):
    success = await save_listing(listing.model_dump())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save listing")
    return listing

#______________________________________________________
# HEALTH CHECK ENDPOINT
# Provides a simple root endpoint to verify the API is running.
@app.get("/")
async def root():
    return {"message": "Property Listings API is running"}

#______________________________________________________
# GET LISTINGS ENDPOINT
# Retrieves all listings or filters by an optional search query on location, title, or property type.
@app.get("/listings")
async def get_listings(search: Optional[str] = Query(None, description="Search by location (address, title, property type)")):

    try:
        if search:
            print(f"Searching for listings with query: '{search}'")
            listings = await search_listings_by_location(search)
        else:
            print("Fetching all listings")
            listings = await get_all_listings()
        
        print(f"Returning {len(listings)} listings")
        return {"listings": listings}
        
    except Exception as e:
        print(f"Error in get_listings: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

#______________________________________________________
# GET LISTINGS IN BOUNDS ENDPOINT
# Retrieves listings within specified geographic bounds (bounding box coordinates).
@app.get("/listings/in-bounds")
async def get_listings_in_bounds_endpoint(
    minLng: float = Query(..., description="Minimum longitude"),
    minLat: float = Query(..., description="Minimum latitude"), 
    maxLng: float = Query(..., description="Maximum longitude"),
    maxLat: float = Query(..., description="Maximum latitude")
):
    try:
        print(f"Searching for listings in bounds: lng({minLng}, {maxLng}), lat({minLat}, {maxLat})")
        listings = await get_listings_in_bounds(minLng, minLat, maxLng, maxLat)
        
        print(f"Found {len(listings)} listings in bounds")
        return {"listings": listings}
        
    except Exception as e:
        print(f"Error in get_listings_in_bounds: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

#______________________________________________________
# ANALYZE LISTING ENDPOINT
# Triggers analysis of a single listing's images and floorplans, saving the processed results back to the database.
@app.post("/analyze-listing/{listing_id}")
async def analyze_single_listing(listing_id: int):
    listing = await get_listing_by_id(listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    processed = await process_listing(listing)
    await save_listing(processed)

    return {"message": f"Analysis complete for listing ID {listing_id}"}