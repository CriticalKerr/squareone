from fastapi import FastAPI, HTTPException, Query
from .models import Listing
from .db import init_db, save_listing, get_all_listings
from contextlib import asynccontextmanager
from .pipeline import run_pipeline

#______________________________________________________
# INITIALISE DATABASE ON STARTUP
# Ensures database tables are created before handling any requests so listings can be stored and retrieved reliably.
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(lifespan=lifespan)

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
# LIST ALL LISTINGS ENDPOINT
# Retrieves every listing from the database and returns them along with a total count.
@app.get("/listings")
async def list_listings():
    listings = await get_all_listings()
    return {"listings": listings, "count": len(listings)}

#______________________________________________________
# RUN ANALYSIS PIPELINE ENDPOINT
# Triggers analysis of saved listings’ images and floorplans, optionally limiting to a specified number.
@app.post("/analyze-listings")
async def analyze_listings(
        limit: int = Query(None, ge=1, description="Max number of listings to analyze")
):
    await run_pipeline(limit)
    msg = f"Analysis complete for {limit} listing(s)" if limit else "Analysis complete for all listings"
    return {"message": msg}

#______________________________________________________
# HEALTH-CHECK ENDPOINT
# Provides a simple confirmation that the API service is running and reachable.
@app.get("/")
async def root():
    return {"message": "Property Analysis API is running"}