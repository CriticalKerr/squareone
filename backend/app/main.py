from fastapi import FastAPI, HTTPException
from typing import List
from app.models import Listing
from app.scraper import scrape_listings

app = FastAPI()

@app.get("/scrape/{postcode}", response_model=List[Listing])
async def scrape(postcode: str):
    try:
        return await scrape_listings(postcode)
    except Exception as e:
        raise HTTPException(500, str(e))