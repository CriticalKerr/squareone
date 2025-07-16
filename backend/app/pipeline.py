import asyncio  # For concurrent execution of blocking vision calls
from typing import Optional  # Type hint for optional parameters
from .db import init_db, get_all_listings, save_listing  # Database functions
from .vision import classify_room_condition, analyse_floorplan  # Vision analysis functions

#______________________________________________________
# PROCESS A SINGLE LISTING
# process_listing() takes one listing dict, runs room-condition and floorplan analysis
# in separate threads for all images, collects results or errors, and returns the updated listing
async def process_listing(listing):
    img_urls = listing.get('image_urls') or []  # List of image URLs to analyze
    fp_urls = listing.get('floorplan_urls') or []  # List of floorplan URLs to analyze

    cond_tasks = [asyncio.to_thread(classify_room_condition, url) for url in img_urls]
    floor_tasks = [asyncio.to_thread(analyse_floorplan, url) for url in fp_urls]

    cond_results = await asyncio.gather(*cond_tasks, return_exceptions=True)
    floor_results = await asyncio.gather(*floor_tasks, return_exceptions=True)

    listing['condition_analysis'] = [
        result if not isinstance(result, Exception) else {'error': str(result)}
        for result in cond_results
    ]
    listing['floorplan_analysis'] = [
        result if not isinstance(result, Exception) else {'error': str(result)}
        for result in floor_results
    ]
    return listing

#______________________________________________________
# RUN THE FULL PIPELINE
# run_pipeline() initializes the database, fetches listings, optionally limits count,
# processes each listing concurrently, and saves the updated listings back
async def run_pipeline(limit: Optional[int] = None):
    await init_db()  # Ensure tables exist
    listings = await get_all_listings()  # Fetch all listing dicts
    if limit and limit > 0:
        listings = listings[:limit]  # Keep only the first `limit` listings if specified

    processed = await asyncio.gather(*(process_listing(lst) for lst in listings))
    for updated in processed:
        await save_listing(updated)  # Save each listing’s analysis results back to DB