# Pipeline which calls vision.py to analyse images, estimate costs or generate refurbishment renders

#______________________________________________________________________________________
# IMPORTS
#tools for env vars, async work, timing, logging, typing, database, and vision helpers
import os           #for environment variables and file paths
import asyncio      #for concurrent execution of blocking vision calls
import time         #for timing analysis
import logging
from typing import Optional, Dict, Any, List    #type hint helpers
from .db import init_db, get_all_listings, save_listing  #database functions
from .vision import generate_refurb_edit, identify_room, classify_room_condition, analyse_floorplan, refurb_cost_estimate
import firebase_admin

#______________________________________________________________________________________
# LOGGING TWEAKS
#quiet down noisy sql logs so console is readable
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

#______________________________________________________________________________________
#______________________________ HOW TO PROCESS A SINGLE LISTING ________________________
#handles one property: reads images and floorplans, classifies rooms, makes renders, estimates costs
async def process_listing(listing: Dict[str, Any]) -> Dict[str, Any]:
    #grab simple identifiers for nice logs
    listing_id = listing.get('id', 'Unknown')
    listing_title = listing.get('title', 'No title')[:50] + "..." if len(listing.get('title', '')) > 50 else listing.get('title', 'No title')

    print(f"\n🏠 PROCESSING PROPERTY ID: {listing_id}")
    print(f"   📍 Title: {listing_title}")
    print(f"   📊 Address: {listing.get('address', 'No address')}")

    img_urls = listing.get('image_urls') #images to analyse
    floorplan_urls = listing.get('floorplan_urls', []) #floorplans to analyse
    analysis: List[Dict[str, Any]] = [] #per-room analysis entries
    cost_estimates: Dict[str, Any] = {} #room_key→cost data
    room_areas: Dict[str, float] = {}  #room areas pulled from floorplans
    floorplan_analysis = [] #raw floorplan analysis results

    #------analyse floorplans to find room sizes
    if floorplan_urls:
        print(f"📐 [ID: {listing_id}] Analyzing {len(floorplan_urls)} floorplan(s)...")
        floorplan_tasks = [asyncio.to_thread(analyse_floorplan, url) for url in floorplan_urls]  #run in threads
        floorplan_results = await asyncio.gather(*floorplan_tasks, return_exceptions=True)

        for url, result in zip(floorplan_urls, floorplan_results):
            if isinstance(result, Exception):
                print(f"⚠️ [ID: {listing_id}] Error analyzing floorplan {url}: {result}")
                #add a failed analysis entry
                floorplan_analysis.append({
                    "floorplan_url": url,
                    "analysis": {"rooms": [], "total_area_sqm": 0, "error": str(result)}
                })
                continue

            #check if service had to fall back
            if result.get("fallback"):
                print(f"⚠️ [ID: {listing_id}] Floorplan analysis used fallback for {url}")

            floorplan_analysis.append({"floorplan_url": url, "analysis": result})

            #------collect areas for bathrooms and kitchens
            rooms = result.get("rooms", [])
            for room in rooms:
                room_type = room.get("type", "").lower()
                area = room.get('area_sqm', 0)
                #------guard against None areas
                if area is None:
                    area = 0

                if area > 0:
                    #first room of a type uses the plain key
                    if room_type not in room_areas:
                        room_areas[room_type] = area
                        print(f"📐 [ID: {listing_id}] Found {room_type}: {area} sqm")
                    else:
                        #additional rooms use an index suffix
                        counter = 1
                        while f"{room_type}_{counter}" in room_areas:
                            counter += 1
                        room_areas[f"{room_type}_{counter}"] = area
                        print(f"📐 [ID: {listing_id}] Found {room_type}_{counter}: {area} sqm")

    #------identify which images are bathrooms or kitchens
    print(f"🔍 [ID: {listing_id}] Analyzing {len(img_urls)} images for room identification...")
    identify_tasks = [asyncio.to_thread(identify_room, url) for url in img_urls]  #thread off blocking call
    id_results = await asyncio.gather(*identify_tasks, return_exceptions=True)

    #------keep only bathroom/kitchen images with confidence
    rooms: List[Dict[str, Any]] = []
    for url, res in zip(img_urls, id_results):
        if isinstance(res, Exception):
            print(f"⚠️ [ID: {listing_id}] Error identifying room in {url}: {res}")
            continue
        room_type = res.get("type", "").lower()
        if room_type in ("bathroom", "kitchen"):
            print(f"🔄 [ID: {listing_id}] Detected {room_type} at {url}")
            rooms.append({
                "image_url": url,
                "room_type": room_type,
                "confidence": res.get("confidence", 0.0)
            })

    #if no target rooms, return early with empty results
    if not rooms:
        print(f"ℹ️ [ID: {listing_id}] No bathrooms or kitchens found in images")
        listing["condition_analysis"] = []
        listing["floorplan_analysis"] = floorplan_analysis
        listing["refurb_cost_estimate"] = {}
        return listing

    #------classify condition of each target room
    print(f"🔍 [ID: {listing_id}] Classifying condition of {len(rooms)} rooms...")
    cond_tasks = [asyncio.to_thread(classify_room_condition, r["image_url"]) for r in rooms]
    cond_results = await asyncio.gather(*cond_tasks, return_exceptions=True)

    #------build analysis entries for each room
    room_type_counters = {}  #counts bathrooms/kitchens seen so far

    for room, cond in zip(rooms, cond_results):
        entry: Dict[str, Any] = {
            "image_url": room["image_url"],
            "room_type": room["room_type"],
            "identify_confidence": room["confidence"]
        }
        if isinstance(cond, Exception):
            print(f"⚠️ [ID: {listing_id}] Error classifying {room['room_type']}: {cond}")
            entry["error"] = str(cond)
        else:
            state = cond.get("state", "").lower()
            entry.update({
                "state": state,
                "state_confidence": cond.get("confidence", 0.0),
                "room_description": cond.get("rationale", "")
            })

            print(f"✅ [ID: {listing_id}] {room['room_type'].title()} classified as: {state}")

            #------if the room could be refurbished, make a render and estimate costs
            if state == "could be refurbished":
                refurb_type = "budget"  #you can change to "mid" or "premium"
                print(f"🔄 [ID: {listing_id}] Generating {refurb_type} refurb render for {room['room_type']}...")
                try:
                    refurb_url = generate_refurb_edit(room["image_url"], room["room_type"], refurb_type)
                    entry["refurb_render_url"] = refurb_url
                    entry["refurb_type"] = refurb_type
                    print(f"✅ [ID: {listing_id}] {refurb_type.title()} refurb render saved: {refurb_url}")

                    #------choose the best room area to use for costing
                    room_type = room["room_type"]
                    room_area = None

                    #track which index of this room type we are on
                    room_type_counters[room_type] = room_type_counters.get(room_type, 0) + 1
                    current_count = room_type_counters[room_type]

                    #first instance uses plain key, later ones use indexed key
                    if current_count == 1:
                        room_area = room_areas.get(room_type)
                    else:
                        room_area = room_areas.get(f"{room_type}_{current_count}")

                    #fallback: if missing indexed value, try the base key
                    if room_area is None and current_count > 1:
                        room_area = room_areas.get(room_type)

                    print(f"💰 [ID: {listing_id}] Generating {refurb_type} cost estimate for {room_type} (Area: {room_area or 'estimated'} sqm)...")

                    #------estimate cost using original image, refurb image URL (now Firebase Storage URL), room type, area, and style
                    cost_estimate = await asyncio.to_thread(
                        refurb_cost_estimate,
                        room["image_url"],
                        refurb_url,  # This is now a Firebase Storage URL, not a local file path
                        room["room_type"],
                        room_area,
                        refurb_type  #pass the refurb style
                    )

                    #------store the estimate under a unique room key
                    room_key = f"{room['room_type']}_{current_count}"
                    cost_estimates[room_key] = cost_estimate
                    entry["cost_estimate"] = cost_estimate

                    total_cost = cost_estimate.get('total_cost', 0)
                    area_info = f"({room_area} sqm)" if room_area else "(estimated size)"
                    print(f"💰 [ID: {listing_id}] {refurb_type.title()} cost estimate complete: £{total_cost:,.2f} for {room_type} {area_info}")

                    #------extra diagnostics to understand model behavior
                    used_area = (
                            cost_estimate.get("floorplan_area_sqm")
                            or cost_estimate.get("estimated_area_sqm")
                            or cost_estimate.get("used_area_sqm")
                    )
                    if used_area:
                        print(f"   ↳ Used area for costing: {used_area} sqm")

                    if cost_estimate.get("out_of_range"):
                        rng = cost_estimate.get("range_hint", {})
                        low = rng.get("low"); high = rng.get("high"); reason = rng.get("reason", "range check")
                        if low and high:
                            print(f"   ↳ Warning: total outside expected range £{low:.0f}–£{high:.0f} ({reason})")
                        else:
                            print("   ↳ Warning: total flagged as out of expected range")

                    if cost_estimate.get("reask_attempted"):
                        print("   ↳ Model revised its estimate once due to range miss")

                except Exception as e:
                    print(f"⚠️ [ID: {listing_id}] Error in refurb/cost process: {e}")
                    entry["cost_estimate_error"] = str(e)

        analysis.append(entry)

    #------assemble results onto the listing and return it
    listing["condition_analysis"] = analysis
    listing["floorplan_analysis"] = floorplan_analysis
    listing["refurb_cost_estimate"] = cost_estimates

    print(f"✅ [ID: {listing_id}] Processing complete - {len(analysis)} rooms analysed")
    return listing


#______________________________________________________________________________________
#______________________________ TESTING ANALYSIS FUNCTION ________________________
#summarizes how well the pipeline did across many listings
def analyse_results(listings: List[Dict]):
    """Analyze the pipeline results for comprehensive testing metrics"""

    print("\n📊 COMPREHENSIVE TESTING RESULTS ANALYSIS")
    print("=" * 70)

    #initialize counters and trackers
    total_images = 0
    classified_images = 0
    room_types = {}
    condition_classifications = {}

    #floorplan metrics
    floorplans_processed = 0
    floorplans_with_areas = 0
    floorplan_errors = 0
    room_areas_extracted = []
    floorplans_with_scale = 0

    #render metrics
    render_requests = 0
    successful_renders = 0
    render_errors = 0
    rate_limit_errors = 0
    refurb_styles = {}

    #cost metrics
    cost_estimates_generated = 0
    cost_breakdown_items = []
    labour_costs = []
    material_costs = []
    total_costs = []

    #roi metrics (if you compute them elsewhere)
    roi_calculations = 0
    roi_errors = 0

    for listing in listings:
        listing_id = listing.get('id', 'Unknown')

        #=== room classification analysis ===
        images = listing.get('image_urls', [])
        total_images += len(images)

        image_analysis = listing.get('condition_analysis', [])
        for analysis in image_analysis:
            if analysis.get('room_type'):
                classified_images += 1
                room_type = analysis['room_type']
                room_types[room_type] = room_types.get(room_type, 0) + 1

                #collect condition stats
                state = analysis.get('state', 'unknown')
                if state not in condition_classifications:
                    condition_classifications[state] = {'count': 0, 'confidence_scores': []}
                condition_classifications[state]['count'] += 1
                if analysis.get('state_confidence'):
                    condition_classifications[state]['confidence_scores'].append(analysis['state_confidence'])

        #=== floorplan analysis ===
        floorplan_analysis = listing.get('floorplan_analysis', [])
        for fp_data in floorplan_analysis:
            floorplans_processed += 1
            fp_analysis = fp_data.get('analysis', {})

            if fp_analysis.get('error'):
                floorplan_errors += 1
                continue

            rooms = fp_analysis.get('rooms', [])
            if rooms:
                floorplans_with_areas += 1

                #collect bathroom/kitchen areas
                for room in rooms:
                    if room.get('type', '').lower() in ['bathroom', 'kitchen']:
                        area = room.get('area_sqm', 0)
                        if area > 0:
                            room_areas_extracted.append({
                                'listing_id': listing_id,
                                'room_type': room.get('type'),
                                'area_sqm': area,
                                'has_dimensions': bool(room.get('dimensions'))
                            })

                            #count if dimension scale was readable
                            if room.get('dimensions'):
                                floorplans_with_scale += 1

        #=== render analysis ===
        for analysis in image_analysis:
            if analysis.get('state') == 'could be refurbished':
                render_requests += 1

                if analysis.get('refurb_render_url'):
                    successful_renders += 1
                    refurb_type = analysis.get('refurb_type', 'unknown')
                    refurb_styles[refurb_type] = refurb_styles.get(refurb_type, 0) + 1

                if analysis.get('cost_estimate_error'):
                    error_msg = analysis['cost_estimate_error']
                    if 'rate limit' in error_msg.lower() or 'throttled' in error_msg.lower():
                        rate_limit_errors += 1
                    else:
                        render_errors += 1

        #=== cost analysis ===
        cost_estimates = listing.get('refurb_cost_estimate', {})
        for room_key, cost_data in cost_estimates.items():
            if isinstance(cost_data, dict) and cost_data.get('total_cost'):
                cost_estimates_generated += 1

                total_cost = cost_data.get('total_cost', 0)
                total_costs.append(total_cost)

                #store breakdown for later deep dives
                breakdown = cost_data.get('breakdown', {})
                if breakdown:
                    cost_breakdown_items.append({
                        'listing_id': listing_id,
                        'room_key': room_key,
                        'breakdown': breakdown,
                        'total': total_cost
                    })

                    #separate rough labour vs materials buckets
                    for category, amount in breakdown.items():
                        category_lower = category.lower()
                        if any(word in category_lower for word in ['labour', 'labor', 'installation', 'fitting']):
                            labour_costs.append(amount)
                        elif any(word in category_lower for word in ['material', 'fixture', 'cabinet', 'tile']):
                            material_costs.append(amount)

    #=== print detailed results ===
    print(f"\n🔍 ROOM CONDITION CLASSIFICATION:")
    print(f"   • Total images processed: {total_images}")
    print(f"   • Successfully classified: {classified_images}")
    print(f"   • Overall accuracy: {(classified_images/total_images*100):.1f}%" if total_images > 0 else "   • No images to classify")
    print(f"   • Room type distribution: {room_types}")
    print(f"   • Condition classifications:")
    for condition, data in condition_classifications.items():
        avg_confidence = sum(data['confidence_scores'])/len(data['confidence_scores']) if data['confidence_scores'] else 0
        print(f"     - {condition}: {data['count']} rooms (avg confidence: {avg_confidence:.2f})")

    print(f"\n📐 FLOORPLAN AREA EXTRACTION:")
    print(f"   • Total floorplans processed: {floorplans_processed}")
    print(f"   • Successfully extracted areas: {floorplans_with_areas}")
    print(f"   • Success rate: {(floorplans_with_areas/floorplans_processed*100):.1f}%" if floorplans_processed > 0 else "   • No floorplans found")
    print(f"   • Floorplans with readable scale: {floorplans_with_scale}")
    print(f"   • Scale readability rate: {(floorplans_with_scale/floorplans_processed*100):.1f}%" if floorplans_processed > 0 else "   • N/A")
    print(f"   • Processing errors: {floorplan_errors}")
    print(f"   • Room areas extracted: {len(room_areas_extracted)}")
    if room_areas_extracted:
        areas = [r['area_sqm'] for r in room_areas_extracted]
        print(f"     - Average area: {sum(areas)/len(areas):.1f} m²")
        print(f"     - Area range: {min(areas):.1f} - {max(areas):.1f} m²")

    print(f"\n🎨 REFURB RENDER GENERATION:")
    print(f"   • Render requests initiated: {render_requests}")
    print(f"   • Successful renders: {successful_renders}")
    print(f"   • Success rate: {(successful_renders/render_requests*100):.1f}%" if render_requests > 0 else "   • No renders requested")
    print(f"   • Rate limit incidents: {rate_limit_errors}")
    print(f"   • Rate limit rate: {(rate_limit_errors/render_requests*100):.1f}%" if render_requests > 0 else "   • N/A")
    print(f"   • Other render errors: {render_errors}")
    print(f"   • Style distribution: {refurb_styles}")

    print(f"\n💰 COST BREAKDOWN ANALYSIS:")
    print(f"   • Cost estimates generated: {cost_estimates_generated}")
    print(f"   • Success rate: {(cost_estimates_generated/render_requests*100):.1f}%" if render_requests > 0 else "   • N/A")
    if total_costs:
        print(f"   • Total cost range: £{min(total_costs):,.0f} - £{max(total_costs):,.0f}")
        print(f"   • Average total cost: £{sum(total_costs)/len(total_costs):,.0f}")
    if labour_costs:
        print(f"   • Labour cost range: £{min(labour_costs):,.0f} - £{max(labour_costs):,.0f}")
        print(f"   • Average labour cost: £{sum(labour_costs)/len(labour_costs):,.0f}")
    if material_costs:
        print(f"   • Material cost range: £{min(material_costs):,.0f} - £{max(material_costs):,.0f}")
        print(f"   • Average material cost: £{sum(material_costs)/len(material_costs):,.0f}")

    #rough cost bands to see spread
    if total_costs:
        low_band = sum(1 for cost in total_costs if cost < 3000)
        mid_band = sum(1 for cost in total_costs if 3000 <= cost <= 8000)
        high_band = sum(1 for cost in total_costs if cost > 8000)
        print(f"   • Cost band distribution:")
        print(f"     - Low (<£3k): {low_band} ({(low_band/len(total_costs)*100):.1f}%)")
        print(f"     - Medium (£3k-£8k): {mid_band} ({(mid_band/len(total_costs)*100):.1f}%)")
        print(f"     - High (>£8k): {high_band} ({(high_band/len(total_costs)*100):.1f}%)")

    print(f"\n📊 EDGE CASES & ERROR ANALYSIS:")
    print(f"   • Properties with no target rooms found: {len([l for l in listings if not l.get('condition_analysis')])}")
    print(f"   • Floorplan processing failures: {floorplan_errors}")
    print(f"   • Render generation failures: {render_errors}")
    print(f"   • API rate limiting incidents: {rate_limit_errors}")

    print(f"\n🎯 TESTING SUMMARY:")
    print(f"   • Total properties processed: {len(listings)}")
    print(f"   • Room classification accuracy: {(classified_images/total_images*100):.1f}%")
    print(f"   • Floorplan extraction success: {(floorplans_with_areas/floorplans_processed*100):.1f}%" if floorplans_processed > 0 else "   • N/A")
    print(f"   • Render generation success: {(successful_renders/render_requests*100):.1f}%" if render_requests > 0 else "   • N/A")
    print(f"   • Cost estimation success: {(cost_estimates_generated/render_requests*100):.1f}%" if render_requests > 0 else "   • N/A")

    #return structured data so tests can assert on it
    return {
        'room_classification': {
            'total_images': total_images,
            'classified_images': classified_images,
            'accuracy': classified_images/total_images if total_images > 0 else 0,
            'room_types': room_types,
            'condition_classifications': condition_classifications
        },
        'floorplan_analysis': {
            'processed': floorplans_processed,
            'successful': floorplans_with_areas,
            'success_rate': floorplans_with_areas/floorplans_processed if floorplans_processed > 0 else 0,
            'scale_readable': floorplans_with_scale,
            'areas_extracted': room_areas_extracted,
            'errors': floorplan_errors
        },
        'render_generation': {
            'requests': render_requests,
            'successful': successful_renders,
            'success_rate': successful_renders/render_requests if render_requests > 0 else 0,
            'rate_limit_errors': rate_limit_errors,
            'other_errors': render_errors,
            'styles': refurb_styles
        },
        'cost_analysis': {
            'generated': cost_estimates_generated,
            'total_costs': total_costs,
            'labour_costs': labour_costs,
            'material_costs': material_costs,
            'breakdown_items': cost_breakdown_items
        }
    }

#______________________________________________________________________________________
#_______________________ HOW TO RUN THAT PROCESS FOR ALL LISTINGS _____________________
#runs the whole pipeline for many properties, saves results, and optionally prints test metrics
async def run_pipeline(limit: Optional[int] = None, include_testing: bool = False):
    if include_testing:
        print("🚀 Starting comprehensive pipeline testing...")
        start_time = time.time()

        #get initial listing count for context
        initial_listings = await get_all_listings()
        print(f"📊 Found {len(initial_listings)} listings to process")

    await init_db()  #ensure tables exist
    listings = await get_all_listings()  #fetch all listing dicts

    if limit and limit > 0:
        listings = listings[:limit]  #keep only first N listings if asked
        print(f"🔢 Limited to first {limit} listings")

    print(f"🔄 Processing {len(listings)} properties...")

    #limit how many listings run at the same time
    sem = asyncio.Semaphore(3)  #max concurrent listings

    async def sem_wrapped(listing: Dict[str, Any]) -> Dict[str, Any]:
        async with sem:
            return await process_listing(listing)

    #progress tracking
    processed_count = 0
    tasks = []

    for i, listing in enumerate(listings):
        print(f"\n{'='*60}")
        print(f"📋 QUEUING PROPERTY {i+1}/{len(listings)} - ID: {listing.get('id', 'Unknown')}")
        print(f"{'='*60}")
        tasks.append(asyncio.create_task(sem_wrapped(listing)))

    print(f"\n🚀 Starting parallel processing of {len(tasks)} properties...")
    processed = await asyncio.gather(*tasks)

    print(f"\n💾 Saving results to database...")
    for i, updated in enumerate(processed):
        await save_listing(updated)
        print(f"💾 Saved property {i+1}/{len(processed)} - ID: {updated.get('id', 'Unknown')}")

    if include_testing:
        print("✅ Pipeline completed successfully")

        #pull updated listings to analyse end results
        processed_listings = await get_all_listings()

        #timing metrics
        total_time = time.time() - start_time
        print(f"⏱️  Total processing time: {total_time:.2f} seconds")
        print(f"📈 Average time per listing: {total_time/len(processed_listings):.2f} seconds")

        #analyse results
        analyse_results(processed_listings)

        return {"testing_results": True, "total_time": total_time, "listings_processed": len(processed_listings)}

    return {"testing_results": False, "listings_processed": len(processed)}

