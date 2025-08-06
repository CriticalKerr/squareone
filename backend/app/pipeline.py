import os           # for environment variables and file paths
import asyncio      # For concurrent execution of blocking vision calls
from typing import Optional, Dict, Any, List    # Type hint for optional parameters
from .db import init_db, get_all_listings, save_listing  # Database functions
from .vision import generate_refurb_edit, identify_room, classify_room_condition, analyse_floorplan, refurb_cost_estimate

#______________________________________________________________________________________
#______________________________ HOW TO PROCESS A SINGLE LISTING _____________________

async def process_listing(listing: Dict[str, Any]) -> Dict[str, Any]:
    img_urls = listing.get('image_urls') #images to analyse
    floorplan_urls = listing.get('floorplan_urls', []) #floorplans to analyse
    analysis: List[Dict[str, Any]] = [] # holds per-room analysis entries
    cost_estimates: Dict[str, Any] = {} # keyed by room_type or room_type_index
    room_areas: Dict[str, float] = {}  # extracted floorplan areas
    floorplan_analysis = [] # retuned analysis from API

    #------Analyse floorplan to get room areas of bathroom/kitchen
    if floorplan_urls:
        print(f"📐 Analyzing {len(floorplan_urls)} floorplan(s)...")
    floorplan_tasks = [asyncio.to_thread(analyse_floorplan, url) for url in floorplan_urls]
    floorplan_results = await asyncio.gather(*floorplan_tasks, return_exceptions=True)

    for url, result in zip(floorplan_urls, floorplan_results):
        if isinstance(result, Exception):
            print(f"⚠️ Error analyzing floorplan {url}: {result}")
            continue

        floorplan_analysis.append({"floorplan_url": url,"analysis": result})

        #------Extract room areas for bathrooms and kitchens
        rooms = result.get("rooms", [])
        for room in rooms:
            room_type = room.get("type", "").lower()
            if room_type in ("bathroom", "kitchen"):
                area = room.get("area_sqm", 0)
                if area > 0:
                    # Store room area with simple key (first room of each type)
                    if room_type not in room_areas:
                        room_areas[room_type] = area
                        print(f"📐 Found {room_type}: {area} sqm")
                    else:
                        # Handle multiple rooms of same type with indexed keys
                        counter = 1
                        while f"{room_type}_{counter}" in room_areas:
                            counter += 1
                        room_areas[f"{room_type}_{counter}"] = area
                        print(f"📐 Found {room_type}_{counter}: {area} sqm")

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

    #------Build analysis entries
    room_type_counters = {}  # Track how many of each room type we've processed
    
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

            #------If classified as could be refurbished, call generate_refurb_edit
            if state == "could be refurbished":
                refurb_url = generate_refurb_edit(room["image_url"], room["room_type"])
                print(f"🔄 Generating refurb for {room['room_type']} at {room['image_url']}")
                entry["refurb_render_url"] = refurb_url

                #------Generate cost estimate by comparing original and refurbed images
                try:
                    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                    refurb_file_path = os.path.join(BASE_DIR, refurb_url.lstrip('/'))
                    print(f"🔍 Looking for file at: {refurb_file_path}")
                    print(f"🔍 File exists: {os.path.exists(refurb_file_path)}")

                    #------Find the room area from floorplan_analysis
                    room_type = room["room_type"]
                    room_area = None

                    # Count how many of this room type we've seen so far
                    room_type_counters[room_type] = room_type_counters.get(room_type, 0) + 1
                    current_count = room_type_counters[room_type]

                    # Try to find matching area data
                    if current_count == 1:
                        # First room of this type, try simple key first
                        room_area = room_areas.get(room_type)
                    else:
                        # Subsequent rooms, use indexed key
                        room_area = room_areas.get(f"{room_type}_{current_count}")
                    
                    # Fallback: if no indexed key found, try simple key
                    if room_area is None and current_count > 1:
                        room_area = room_areas.get(room_type)
                    print(f"🔍 Looking for room area: {room_type} (count: {current_count})")
                    print(f"🔍 Available room areas: {room_areas}")
                    print(f"🔍 Found room area: {room_area}")

                    #------Generate cost estimate with room area data
                    cost_estimate = await asyncio.to_thread(
                        refurb_cost_estimate,
                        room["image_url"],
                        refurb_file_path,
                        room["room_type"],
                        room_area  # Now passing the actual area!
                    )

                    #------Store cost estimate with room identifier
                    room_key = f"{room['room_type']}_{current_count}"
                    cost_estimates[room_key] = cost_estimate
                    entry["cost_estimate"] = cost_estimate

                    #------Log with area info if available
                    if room_area:
                        print(f"💰 Generated cost estimate for {room['room_type']} ({room_area} sqm): £{cost_estimate.get('total_cost', 0):,.2f}")
                    else:
                        print(f"💰 Generated cost estimate for {room['room_type']} (estimated size): £{cost_estimate.get('total_cost', 0):,.2f}")

                except Exception as e:
                    print(f"⚠️ Error generating cost estimate: {e}")
                    entry["cost_estimate_error"] = str(e)

        analysis.append(entry)

    #------ assemble results into listing
    listing["condition_analysis"] = analysis
    listing["floorplan_analysis"] = floorplan_analysis
    listing["refurb_cost_estimate"] = cost_estimates
    return listing
#______________________________________________________________________________________
#_______________________ HOW TO RUN THAT PROCESS FOR ALL LISTINGS _____________________

async def run_pipeline(limit: Optional[int] = None):
    await init_db()  # Ensure tables exist
    listings = await get_all_listings()  # Fetch all listing dicts

    if limit and limit > 0:
        listings = listings[:limit]  # Keep only the first `limit` listings if specified

    # Throttle concurrency so we only process N listings at a time
    sem = asyncio.Semaphore(3)  # max number of listings to process at once

    async def sem_wrapped(listing: Dict[str, Any]) -> Dict[str, Any]:
        async with sem:
            return await process_listing(listing)

    tasks = [asyncio.create_task(sem_wrapped(lst)) for lst in listings]
    processed = await asyncio.gather(*tasks)

    for updated in processed:
        await save_listing(updated)  # Save each listing’s analysis results back to DB