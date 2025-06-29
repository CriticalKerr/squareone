from fastapi import FastAPI, HTTPException
from typing import List, Optional
from .models import Listing
from .scraper import scrape_listings

app = FastAPI()

@app.get("/scrape/{postcode}", response_model=List[Listing])
async def scrape(postcode: str, limit: Optional[int] = None):
    """
    If `limit` is provided, we stop after that many listings;
    otherwise we paginate through every result.
    """
    try:
        return await scrape_listings(postcode, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
