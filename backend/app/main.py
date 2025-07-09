from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from .models import Listing
from .db import init_db, save_listing, get_all_listings
from contextlib import asynccontextmanager

app = FastAPI()

#______________________________________________________
# INITIALISE THE DATABASE WHEN APPLICATION STARTS
@asynccontextmanager
async def lifespan(app: FastAPI):

@app.on_event("startup")
async def startup_event():
    """Initialize the database on application startup"""
    await init_db()

@app.post("/add-listing", response_model=Listing)
async def add_listing_manually(listing: Listing):
    """Manually add a listing to the database"""
    try:
        listing_data = listing.model_dump()
        success = await save_listing(listing_data)
        
        if success:
            return listing
        else:
            raise HTTPException(status_code=500, detail="Failed to save listing")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding listing: {str(e)}")

@app.get("/listings")
async def get_listings():
    """Retrieve all listings from the database"""
    try:
        listings = await get_all_listings()
        return {"listings": listings, "count": len(listings)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
