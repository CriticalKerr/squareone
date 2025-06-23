# backend/app/scraper.py
from app.models import Listing
from typing import List

async def scrape_listings(postcode: str, limit: int = 20) -> List[Listing]:
    # TODO: wire in ScrapFly or Playwright here
    # Right now just return an empty list or a hardcoded sample
    return []