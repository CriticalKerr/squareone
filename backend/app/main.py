import os
from fastapi import FastAPI, HTTPException, Query
from .models import Listing
from .db import init_db, save_listing, get_all_listings, get_listing_by_id
from contextlib import asynccontextmanager
from .pipeline import run_pipeline, process_listing
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

#______________________________________________________
# INITIALISE DATABASE ON STARTUP
# Ensures database tables are created before handling any requests so listings can be stored and retrieved reliably.
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
app = FastAPI(lifespan=lifespan)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")

#______________________________________________________
# VITE SERVER SET UP
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#______________________________________________________
# STATIC
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
# LIST ALL LISTINGS ENDPOINT
# Retrieves every listing from the database and returns them along with a total count.
@app.get("/listings")
async def list_listings():
    listings = await get_all_listings()
    return {"listings": listings, "count": len(listings)}

#______________________________________________________
# RUN ANALYSIS PIPELINE ENDPOINT
# Triggers analysis of saved listings’ images and floorplans, optionally limiting to a specified number.
@app.post("/analyze-listing/{listing_id}")
async def analyze_single_listing(listing_id: int):
    listing = await get_listing_by_id(listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    processed = await process_listing(listing)
    await save_listing(processed)

    return {"message": f"Analysis complete for listing ID {listing_id}"}

#______________________________________________________
# HEALTH-CHECK ENDPOINT
# Provides a simple confirmation that the API service is running and reachable.
@app.get("/")
async def root():
    return {"message": "Property Analysis API is running"}

#______________________________________________________
# GALLERY
@app.get("/gallery")
async def get_gallery():
    """
    Return a list of all images + their generated refurb renders (if any).
    """
    listings = await get_all_listings()
    gallery = []
    for l in listings:
        for cond in l.get("condition_analysis", []):
            analysis = cond.get("analysis", {})
            render = analysis.get("refurb_render_url")
            # only include entries that actually have a render
            if render:
                gallery.append({
                    "original_url": cond["image_url"],
                    "render_url": render,
                    "state": analysis.get("state"),
                })
    return {"gallery": gallery}