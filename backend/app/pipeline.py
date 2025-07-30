import asyncio  # For concurrent execution of blocking vision calls
from typing import Optional, Dict, Any, List  # Type hint for optional parameters
from .db import init_db, get_all_listings, save_listing  # Database functions
from .vision import generate_refurb_edit, identify_room, classify_room_condition, analyse_floorplan # Vision analysis functions

#______________________________________________________________________________________
#______________________________ HOW TO PROCESS A SINGLE LISTING _____________________

async def process_listing(listing: Dict[str, Any]) -> Dict[str, Any]:
    img_urls = listing.get('image_urls') #images to analyse
    analysis: List[Dict[str, Any]] = [] #

    #------Identify a room type for each image
    identify_tasks = [asyncio.to_thread(identify_room, url) for url in img_urls]
    id_results = await asyncio.gather(*identify_tasks, return_exceptions=True)

    #------Keep only the verified bathroom/kitchen URLs
    rooms: List[Dict[str, Any]] = []
    for url, res in zip(img_urls, id_results):
        if isinstance(res, Exception):
            continue
        room_type = res.get("type", "").lower()
        if room_type in ("bathroom", "kitchen"):
            print(f"🔄 Detected {room_type} at {url}")
            rooms.append({
                "image_url": url,
                "room_type": room_type,
                "confidence": res.get("confidence", 0.0)
            })

    #------Classify the condition of each room concurrently
    cond_tasks = [asyncio.to_thread(classify_room_condition, r["image_url"]) for r in rooms]
    cond_results = await asyncio.gather(*cond_tasks, return_exceptions=True)

    #------Build analysis entries and generate refurb renders if needed
    for room, cond in zip(rooms, cond_results):
        entry: Dict[str, Any] = {
            "image_url": room["image_url"],
            "room_type": room["room_type"],
            "identify_confidence": room["confidence"]
        }

        if isinstance(cond, Exception):
            entry["error"] = str(cond)
        else:
            state = cond.get("state", "").lower()
            entry.update({
                "state": state,
                "state_confidence": cond.get("confidence", 0.0),
                "room_description": cond.get("rationale", "")
            })
            if state == "could be refurbished":
                entry["refurb_render_url"] = generate_refurb_edit(room["image_url"], room["room_type"])

                analysis.append(entry)

    listing["condition_analysis"] = analysis
    return listing
#______________________________________________________________________________________
#______________________________ HOW TO RUN THAT PROCESS FOR ALL LISTINGS _____________________

async def run_pipeline(limit: Optional[int] = None):
    await init_db()  # Ensure tables exist
    listings = await get_all_listings()  # Fetch all listing dicts

    if limit and limit > 0:
        listings = listings[:limit]  # Keep only the first `limit` listings if specified

    # Throttle concurrency so we only process N listings at a time
    sem = asyncio.Semaphore(3)  # adjust this number as needed

    async def sem_wrapped(listing: Dict[str, Any]) -> Dict[str, Any]:
        async with sem:
            return await process_listing(listing)

    tasks = [asyncio.create_task(sem_wrapped(lst)) for lst in listings]
    processed = await asyncio.gather(*tasks)

    for updated in processed:
        await save_listing(updated)  # Save each listing’s analysis results back to DB