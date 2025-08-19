import os                                                     #for file paths and project directories
from fastapi import FastAPI, Query, HTTPException             #for api app, query params, and http errors
from fastapi.middleware.cors import CORSMiddleware            #for allowing browser apps to call this api
from typing import Optional                                   #for optional type hints
from .db import (get_all_listings, search_listings_by_location, get_listings_in_bounds, init_db)  #for database reads and setup
from .db import save_listing, get_listing_by_id               #for saving a listing and fetching one by id
from contextlib import asynccontextmanager                    #for lifespan context
from .pipeline import process_listing, run_pipeline           #for image/plan analysis and batch pipeline
from fastapi.staticfiles import StaticFiles                   #for serving files like images and css
from .models import Listing                                   #for request/response validation with pydantic models

#______________________________________________________
# APPLICATION SETUP
#creates the fastapi app with a title and version
app = FastAPI(title="Property Listings API (Firestore)", version="2.0.0")

#add cors so the frontend can talk to this api from another domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  #in production, replace with your exact frontend url
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#______________________________________________________
# DATABASE INITIALIZATION ON STARTUP
#makes sure database connection is ready before the first request hits the server
@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    await init_db()  #initialize Firestore connection

#______________________________________________________
# LIFESPAN CONTEXT MANAGER
#another way to run setup on app start; kept for flexibility
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()  #ensure db is ready
    yield            #hand control back to fastapi until shutdown

#figure out where the static folder lives on disk
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  #project root
STATIC_DIR = os.path.join(BASE_DIR, "static") #static files folder

#______________________________________________________
# STATIC FILES
#serves /static/* urls directly from the static directory
app.mount(
    "/static",
    StaticFiles(directory=STATIC_DIR),
    name="static",
)

#______________________________________________________
# ADD LISTING ENDPOINT
#accepts a listing json, validates it, saves it, and echoes it back
@app.post("/add-listing", response_model=Listing)
async def add_listing(listing: Listing):
    success = await save_listing(listing.model_dump())  #write to Firestore
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save listing")  #tell client something went wrong
    return listing  #return what we saved

#______________________________________________________
# HEALTH CHECK ENDPOINT
#simple check so we know the api is alive
@app.get("/")
async def root():
    return {"message": "Property Listings API is running with Firestore! 🚀"}

#______________________________________________________
# GET LISTINGS ENDPOINT
#returns all listings or filters them if a search term is provided
@app.get("/listings")
async def get_listings(search: Optional[str] = Query(None, description="Search by location (address, title, property type)")):
    try:
        if search:
            print(f"Searching for listings with query: '{search}'")  #debug log
            listings = await search_listings_by_location(search)    #filtered results
        else:
            print("Fetching all listings from Firestore") #debug log
            listings = await get_all_listings() #all results

        print(f"Returning {len(listings)} listings from Firestore") #debug log
        return {"listings": listings}  #json response

    except Exception as e:
        print(f"Error in get_listings: {e}")  #server log
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")  #generic error to client

#______________________________________________________
# GET LISTINGS IN BOUNDS ENDPOINT
#returns listings inside a map box defined by four numbers
@app.get("/listings/in-bounds")
async def get_listings_in_bounds_endpoint(
        minLng: float = Query(..., description="Minimum longitude"),
        minLat: float = Query(..., description="Minimum latitude"),
        maxLng: float = Query(..., description="Maximum longitude"),
        maxLat: float = Query(..., description="Maximum latitude")
):
    try:
        print(f"Searching for listings in bounds: lng({minLng}, {maxLng}), lat({minLat}, {maxLat})")  #debug log
        listings = await get_listings_in_bounds(minLng, minLat, maxLng, maxLat)  #Firestore call

        print(f"Found {len(listings)} listings in bounds from Firestore")  #debug log
        return {"listings": listings}  #json response

    except Exception as e:
        print(f"Error in get_listings_in_bounds: {e}") #server log
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}") #generic error

#______________________________________________________
# ANALYSE LISTING ENDPOINT
#processes one listing: classifies rooms, creates refurb, estimates cost, then saves results
@app.post("/analyze-listing/{listing_id}")
async def analyse_single_listing(listing_id: str):  # Changed from int to str for Firestore IDs
    listing = await get_listing_by_id(listing_id) #fetch the listing from Firestore
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")  #not found

    processed = await process_listing(listing)  #run the pipeline for this one
    await save_listing(processed)  #store updated fields in Firestore

    return {"message": f"Analysis complete for listing ID {listing_id}"}  #success message

#______________________________________________________
# ANALYSE ALL LISTING ENDPOINT
#runs the full pipeline for every listing and optionally prints test metrics
@app.post("/analyze-all-listings")
async def analyse_all_listings(include_testing: bool = True):
    result = await run_pipeline(include_testing=include_testing)  #batch process
    return {"message": "Analysis complete for all listings", "details": result}  #return summary