import asyncio
import logging
import random
from typing import List, Optional, Dict
from bs4 import BeautifulSoup
from scrapfly import ScrapeConfig, ScrapflyClient
import os
from .models import Listing
from .db import AsyncSessionLocal, ListingORM
from sqlalchemy import select
import time
import re

#______________________________________________________
# SETTING UP LOGGING & API CLIENT
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

#______________________________________________________
# SCRAPFLY API KEY INITIALISATION
SCRAPFLY_API_KEY = os.getenv('SCRAPFLY_API_KEY', 'scp-live-0cf198e711734a669c2f234e87e55b5d')
scrapfly = ScrapflyClient(key=SCRAPFLY_API_KEY)

#______________________________________________________
# POLITE SCRAPING CONFIG
# common user agent string rotation
USER_AGENTS = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/120.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
]

# request headers for polite scraping
BASE_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0'
}

# tracking last request time per domain
last_request_time: Dict[str, float] = {}
MIN_REQUEST_INTERVAL = 5  # minimum seconds between requests to the same domain

#______________________________________________________
# POLITE FETCH METHOD WITH DELAYS & ROTATED USER AGENTS
async def polite_fetch_html(url: str) -> Optional[str]:
    from urllib.parse import urlparse
    domain = urlparse(url).netloc

    # Ensure minimum delay between requests to the same domain
    if domain in last_request_time:
        time_since_last_request = time.time() - last_request_time[domain]
        if time_since_last_request < MIN_REQUEST_INTERVAL:
            delay = MIN_REQUEST_INTERVAL - time_since_last_request
            logger.debug(f"Polite delay: sleeping for {delay:.2f} seconds")
            await asyncio.sleep(delay)

    # Add some random delay (1-3 seconds)
    random_delay = random.uniform(1, 3)
    logger.debug(f"Adding random delay of {random_delay:.2f} seconds")
    await asyncio.sleep(random_delay)

    # Update last request time
    last_request_time[domain] = time.time()

    # Create headers with random user agent
    headers = BASE_HEADERS.copy()
    headers['User-Agent'] = random.choice(USER_AGENTS)

    logger.info(f"Fetching URL: {url}")

    try:
        config = ScrapeConfig(
            url=url,
            render_js=True,
            asp=True,
            country="GB",
            proxy_pool="public_residential_pool",
            headers=headers
        )
        response = await scrapfly.async_scrape(config)

        # Validate response
        if not response:
            logger.error("No response received from Scrapfly")
            return None

        logger.debug(f"Response status: {response.status_code}")

        if response.status_code != 200:
            logger.error(f"Received non-200 status code: {response.status_code}")
            return None

        if not response.content:
            logger.error("No content in response")
            return None

        # Log success
        logger.info(f"Successfully fetched {url} ({len(response.content)} bytes)")
        return response.content

    except Exception as e:
        logger.error(f"Error fetching URL: {str(e)}", exc_info=True)
        return None

#______________________________________________________
# CHECK IF URL IS LIKELY A PROPERTY IMAGE
def is_property_image(url: str) -> bool:
    if not url:
        return False

    # Must be a complete URL (not relative)
    if not url.startswith(('http://', 'https://')):
        return False

    # Exclude common non-property images
    excluded_patterns = [
        'static_agent_logo',
        'save-',
        'heart-',
        'icon-',
        'logo',
        'badge',
        'button',
        '/static/',
        '.svg',
        'placeholder',
        'favicon',
        'avatar',
        'profile'
    ]

    # Check for excluded patterns
    url_lower = url.lower()
    if any(pattern in url_lower for pattern in excluded_patterns):
        return False

    # Look for property image patterns
    property_patterns = [
        'lid.zoocdn.com',  # Main property images
        '/u/',            # User uploaded images pattern
        '.jpg',
        '.jpeg',
        '.png',
        '.webp'
    ]

    return any(pattern in url_lower for pattern in property_patterns)

#______________________________________________________
# CONVERT RELATIVE URLS TO ABSOLUTE URLS
def normalize_image_url(url: str, base_url: str = "") -> str:
    if not url:
        return url

    # If it's already a complete URL, return as-is
    if url.startswith(('http://', 'https://')):
        return url

    # If it's a relative URL starting with /, make it absolute
    if url.startswith('/') and base_url:
        from urllib.parse import urljoin
        return urljoin(base_url, url)

    return url

#______________________________________________________
# GET UNIQUE IMAGE ID
def get_image_id(url: str) -> str:
    # Remove any trailing suffixes like :p or :
    clean_url = re.sub(r':p?$', '', url) # changed [p] to p

    # Extract the hash from the filename
    match = re.search(r'/([a-f0-9]{40,})\.jpg', clean_url)
    if match:
        return match.group(1)

    # Fallback: try to extract any long hex string
    match = re.search(r'([a-f0-9]{32,})', clean_url)
    if match:
        return match.group(1)

    # Ultimate fallback: use the clean URL
    return clean_url


def get_image_dimensions(url: str) -> tuple:
    """Extract width and height from Zoopla image URL"""
    # Extract dimensions from URL like /645/430/ or /u/1200/900/
    match = re.search(r'/(?:u/)?(\d+)/(\d+)/', url)
    if match:
        width, height = int(match.group(1)), int(match.group(2))
        return width, height
    return 0, 0

#______________________________________________________
# SELECT BEST QUALITY IMAGE
def deduplicate_and_optimize_images(image_urls: List[str], max_images: int = 30) -> List[str]:
    if not image_urls:
        return []

    # Group images by their unique ID
    image_groups = {}
    for url in image_urls:
        image_id = get_image_id(url)
        if image_id not in image_groups:
            image_groups[image_id] = []
        image_groups[image_id].append(url)

    # For each group, select the highest quality image (largest dimensions)
    best_images = []
    for image_id, urls in image_groups.items():
        if len(urls) == 1:
            # Only one image with this ID, use it
            best_images.append(urls[0])
        else:
            # Multiple sizes, select the largest
            best_url = urls[0]
            best_size = 0

            for url in urls:
                width, height = get_image_dimensions(url)
                size = width * height
                if size > best_size:
                    best_size = size
                    best_url = url

            # Prefer URLs without :p suffix if dimensions are equal
            if best_size > 0:
                for url in urls:
                    width, height = get_image_dimensions(url)
                    if width * height == best_size and not url.endswith(':p'):
                        best_url = url
                        break

            best_images.append(best_url)

    # Sort by image quality (larger images first) and limit
    best_images.sort(key=lambda url: get_image_dimensions(url)[0] * get_image_dimensions(url)[1], reverse=True)

    return best_images[:max_images]


#______________________________________________________
# EXTRACT PROPERTY DETAILS FROM INDIVIDUAL LISTINGS + FALLBACK STRATEGY
async def extract_property_details(property_url: str) -> tuple:
    logger.info(f"Fetching property details from: {property_url}")

    raw_image_urls = []
    latitude = 0.0
    longitude = 0.0

    # Get base URL for relative URL conversion
    from urllib.parse import urlparse
    parsed_url = urlparse(property_url)
    base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"

    # Strategy 1: Try the images tab first (for Zoopla)
    images_urls_to_try = []

    if 'zoopla.co.uk' in property_url:
        # Try different variations of the images tab
        base_url_clean = property_url.split('?')[0]  # Remove existing query params
        images_urls_to_try.extend([
            f"{base_url_clean}?tab=images",
            f"{base_url_clean}?view=images",
            f"{base_url_clean}?section=photos",
            f"{base_url_clean}#images",
            f"{base_url_clean}/images",
            f"{base_url_clean}/photos"
        ])

    # Always try the original URL as fallback
    images_urls_to_try.append(property_url)

    html_content = None
    successful_url = None

    # Try each URL until we get content
    for url_to_try in images_urls_to_try:
        logger.info(f"Trying URL: {url_to_try}")
        html_content = await polite_fetch_html(url_to_try)
        if html_content:
            successful_url = url_to_try
            logger.info(f"✅ Successfully fetched content from: {url_to_try}")
            break
        else:
            logger.warning(f"❌ Failed to fetch content from: {url_to_try}")

    if not html_content:
        logger.warning(f"Failed to fetch any content from {property_url}")
        return [], 0.0, 0.0

    soup = BeautifulSoup(html_content, 'html.parser')

    # NEW STRATEGY: Target specific Zoopla photo gallery structure
    logger.info("Searching for Zoopla photo gallery structure...")

    # Look for the photo gallery containers
    photo_containers = soup.select('div._1iq9l851')
    logger.info(f"Found {len(photo_containers)} photo containers with class '_1iq9l851'")

    # Use a set to track unique image IDs to avoid duplicates
    seen_image_ids = set()

    for container in photo_containers:
        # Find picture elements within each container
        pictures = container.select('picture')
        for picture in pictures:
            # Get the first source element (we only need one since both contain same image)
            source = picture.find('source')
            if source:
                srcset = source.get('srcset', '')
                if srcset and 'lid.zoocdn.com' in srcset:
                    # Find the highest resolution version (1200w is typically the highest)
                    best_url = None
                    best_resolution = 0

                    srcset_items = srcset.split(',')
                    for item in srcset_items:
                        item = item.strip()
                        # Extract resolution and URL
                        parts = item.split(' ')
                        if len(parts) >= 2:
                            url = parts[0]
                            resolution_str = parts[1]

                            # Extract numeric resolution (e.g., "1200w" -> 1200)
                            resolution_match = re.search(r'(\d+)w', resolution_str)
                            if resolution_match:
                                resolution = int(resolution_match.group(1))
                                if resolution > best_resolution:
                                    best_resolution = resolution
                                    best_url = url

                    if best_url:
                        # Remove :p suffix if present (for WebP versions)
                        if best_url.endswith(':p'):
                            best_url = best_url[:-2]

                        # Extract image ID to avoid duplicates
                        image_id = get_image_id(best_url)
                        if image_id not in seen_image_ids:
                            seen_image_ids.add(image_id)
                            raw_image_urls.append(best_url)
                            logger.debug(f"Found {best_resolution}w image: {best_url}")

    # FALLBACK: Original comprehensive search if specific structure didn't work
    if not raw_image_urls:
        logger.info("Zoopla-specific extraction found no images, falling back to comprehensive search...")

        # Use the existing deduplicate_and_optimize_images function for fallback
        fallback_urls = []

        # Strategy 2: Multiple image extraction approaches (your original code)
        gallery_selectors = [
            # Zoopla specific selectors
            'div[data-testid="photo-gallery"] img',
            'div[data-testid="images-gallery"] img',
            'div[data-testid="image-gallery"] img',
            '[data-testid*="gallery"] img',
            '[data-testid*="photo"] img',

            # Generic gallery selectors
            'div[class*="photo-gallery"] img',
            'div[class*="image-gallery"] img',
            'div[class*="property-images"] img',
            '[class*="photo-viewer"] img',
            '[class*="lightbox"] img',
            '[class*="slideshow"] img',
            '[class*="carousel"] img',
            '.gallery img',
            '[class*="gallery"] img',

            # Fallback - any images in containers that might be galleries
            'div[class*="image"] img',
            'section[class*="image"] img',
            'div[id*="image"] img',
            'div[id*="photo"] img'
        ]

        for i, selector in enumerate(gallery_selectors):
            imgs_found = soup.select(selector)
            if imgs_found:
                logger.info(f"Selector {i+1} '{selector}' found {len(imgs_found)} images")

                for img in imgs_found:
                    # Check all possible image sources
                    possible_sources = [
                        img.get('src', ''),
                        img.get('data-src', ''),
                        img.get('data-lazy-src', ''),
                        img.get('data-original', ''),
                        img.get('data-zoom-src', ''),
                        img.get('data-full-src', ''),
                        img.get('data-large-src', ''),
                    ]

                    # Also check img srcset
                    srcset = img.get('srcset', '')
                    if srcset:
                        for src_item in srcset.split(','):
                            url_part = src_item.strip().split(' ')[0]
                            if url_part:
                                possible_sources.append(url_part)

                    # Filter and add valid property images
                    for src in possible_sources:
                        if src:
                            # Normalize the URL (convert relative to absolute)
                            normalized_url = normalize_image_url(src, base_url)
                            if is_property_image(normalized_url):
                                fallback_urls.append(normalized_url)

        # Strategy 3: Look for JSON data containing image arrays
        logger.info("Searching for images in script tags...")
        scripts = soup.find_all('script')

        for script in scripts:
            script_content = script.string or ''

            # Look for various JSON patterns that might contain images
            image_patterns = [
                r'"images"\s*:\s*\[(.*?)\]',
                r'"photos"\s*:\s*\[(.*?)\]',
                r'"gallery"\s*:\s*\[(.*?)\]',
                r'"propertyImages"\s*:\s*\[(.*?)\]',
                r'"imageUrls"\s*:\s*\[(.*?)\]',
                r'"photoUrls"\s*:\s*\[(.*?)\]',
                r'"media"\s*:\s*\[(.*?)\]',
                # Look for individual image URLs in JSON
                r'"(https://lid\.zoocdn\.com/[^"]*)"',
                r'"(https://[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"'
            ]

            for pattern in image_patterns:
                matches = re.findall(pattern, script_content, re.DOTALL | re.IGNORECASE)
                for match in matches:
                    if 'lid.zoocdn.com' in match or any(ext in match.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                        # Try to extract URLs from the match
                        if match.startswith('http'):
                            # Direct URL match
                            normalized_url = normalize_image_url(match, base_url)
                            if is_property_image(normalized_url):
                                fallback_urls.append(normalized_url)
                        else:
                            # Array content, extract URLs
                            urls = re.findall(r'"(https?://[^"]*)"', match)
                            for url in urls:
                                normalized_url = normalize_image_url(url, base_url)
                                if is_property_image(normalized_url):
                                    fallback_urls.append(normalized_url)

        # Strategy 4: Look for picture elements (comprehensive)
        logger.info("Searching all picture elements...")
        for picture in soup.find_all('picture'):
            sources = picture.find_all('source')
            for source in sources:
                srcset = source.get('srcset', '')
                if srcset:
                    for src_item in srcset.split(','):
                        url_part = src_item.strip().split(' ')[0]
                        url_part = normalize_image_url(url_part, successful_url)
                        if url_part and is_property_image(url_part):
                            fallback_urls.append(url_part)

        # Strategy 5: Fallback - get all img tags
        logger.info("Fallback: searching all img tags...")
        all_imgs = soup.find_all('img')
        logger.info(f"Found {len(all_imgs)} total img tags")

        for img in all_imgs:
            # Skip if already processed in picture element
            if img.parent and img.parent.name in ['picture']:
                continue

            possible_sources = [
                img.get('src', ''),
                img.get('data-src', ''),
                img.get('data-lazy-src', ''),
                img.get('data-original', ''),
                img.get('data-zoom-src', ''),
            ]

            for src in possible_sources:
                if src:
                    src = normalize_image_url(src, successful_url)
                    if is_property_image(src):
                        fallback_urls.append(src)

        # Use the existing deduplication function for fallback results
        raw_image_urls = deduplicate_and_optimize_images(fallback_urls, max_images=50)

    # Convert to final image list
    image_urls = raw_image_urls[:50]  # Limit to 50 images max

    logger.info(f"Final images after processing: {len(image_urls)}")

    # Extract coordinates (keeping your existing coordinate extraction logic)
    scripts = soup.find_all('script')
    logger.info(f"Searching {len(scripts)} script tags for coordinate data")

    for script in scripts:
        script_content = script.string or ''

        # Look for decimal coordinates (high precision lat/lng values)
        decimal_coords = re.findall(r'([+-]?\d+\.\d{4,})', script_content)
        if len(decimal_coords) >= 2:
            logger.info(f"Found potential coordinates: {decimal_coords[:4]}")

            # Try to identify latitude and longitude from the coordinates
            valid_coords = []
            for coord_str in decimal_coords:
                try:
                    coord = float(coord_str)
                    # Check if it's in a reasonable range for UK coordinates
                    if 49 <= coord <= 61:  # UK latitude range
                        valid_coords.append(('lat', coord))
                    elif -8 <= coord <= 2:  # UK longitude range
                        valid_coords.append(('lng', coord))
                except ValueError:
                    continue

            # Extract first valid lat and lng
            for coord_type, coord_value in valid_coords:
                if coord_type == 'lat' and latitude == 0.0:
                    latitude = coord_value
                elif coord_type == 'lng' and longitude == 0.0:
                    longitude = coord_value

                if latitude != 0.0 and longitude != 0.0:
                    logger.info(f"✅ Found coordinates from decimal extraction: lat={latitude}, lng={longitude}")
                    break

        if latitude != 0.0 and longitude != 0.0:
            break

        # Strategy 2: Look for JSON coordinate structures
        location_patterns = [
            r'"location"[^}]*"coordinates"[^}]*"latitude":\s*([+-]?\d+\.?\d*)[^}]*"longitude":\s*([+-]?\d+\.?\d*)',
            r'"coordinates"[^}]*"latitude":\s*([+-]?\d+\.?\d*)[^}]*"longitude":\s*([+-]?\d+\.?\d*)',
            r'coordinates[^}]*latitude["\']?\s*:\s*([+-]?\d+\.?\d*)[^}]*longitude["\']?\s*:\s*([+-]?\d+\.?\d*)'
        ]

        for pattern in location_patterns:
            match = re.search(pattern, script_content, re.IGNORECASE)
            if match:
                try:
                    latitude = float(match.group(1))
                    longitude = float(match.group(2))
                    logger.info(f"✅ Found coordinates in JSON structure: lat={latitude}, lng={longitude}")
                    break
                except (ValueError, TypeError, IndexError):
                    pass

        if latitude != 0.0 and longitude != 0.0:
            break

    # Continue with remaining coordinate extraction strategies...
    if latitude == 0.0 or longitude == 0.0:
        logger.info("Searching for coordinates in image elements...")
        for img in soup.find_all('img'):
            image_sources = [
                img.get('src', ''),
                img.get('srcset', ''),
                img.get('data-src', ''),
                img.get('data-srcset', ''),
            ]

            for src in image_sources:
                if src and 'maps.zoopla.co.uk' in src:
                    logger.info(f"Found Zoopla map URL: {src[:100]}...")

                    # Extract coordinates from marker parameter
                    marker_match = re.search(r'marker=([+-]?\d+\.?\d*)%2C([+-]?\d+\.?\d*)', src)
                    if marker_match:
                        try:
                            longitude = float(marker_match.group(1))
                            latitude = float(marker_match.group(2))
                            logger.info(f"✅ Found coordinates in map marker: lat={latitude}, lng={longitude}")
                            break
                        except (ValueError, TypeError):
                            pass

            if latitude != 0.0 and longitude != 0.0:
                break

    logger.info(f"🏠 Property details extracted from {successful_url}:")
    logger.info(f"   📸 Images: {len(image_urls)} unique high-resolution images")
    logger.info(f"   📍 Coordinates: ({latitude}, {longitude})")

    return image_urls, latitude, longitude


#______________________________________________________
# ENHANCED DATABASE OPERATIONS WITH BULLETPROOF DUPLICATE PREVENTION
async def save_listing_to_db(listing: Listing) -> bool:
    async with AsyncSessionLocal() as session:
        try:
            # Simple check: only check if address + price combination already exists
            stmt = select(ListingORM).where(
                ListingORM.address == listing.address,
                ListingORM.price == listing.price
            )
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()

            if existing:
                logger.info(f"🔍 Duplicate detected: {listing.address} - {listing.price}")
                return False

            # Save new listing
            db_listing = ListingORM(
                title=listing.title,
                address=listing.address,
                price=listing.price,
                latitude=listing.latitude,
                longitude=listing.longitude,
                image_urls=listing.image_urls
            )

            session.add(db_listing)
            await session.commit()
            logger.info(f"💾 Saved NEW listing to database: {listing.title} - {listing.address}")
            return True

        except Exception as e:
            logger.error(f"❌ Error saving listing to database: {str(e)}")
            await session.rollback()
            return False

#______________________________________________________
# RETREIVES ALL LISTINGS FROM THE DATABASE
async def get_all_listings_from_db() -> List[Listing]:
    async with AsyncSessionLocal() as session:
        try:
            stmt = select(ListingORM)
            result = await session.execute(stmt)
            db_listings = result.scalars().all()

            logger.info(f"📊 Retrieved {len(db_listings)} listings from database")

            # Convert ORM objects to Pydantic models
            listings = []
            for db_listing in db_listings:
                listing = Listing(
                    title=db_listing.title,
                    address=db_listing.address,
                    price=db_listing.price,
                    latitude=db_listing.latitude,
                    longitude=db_listing.longitude,
                    image_urls=db_listing.image_urls
                )
                listings.append(listing)

            return listings

        except Exception as e:
            logger.error(f"❌ Error retrieving listings from database: {str(e)}")
            return []

#______________________________________________________
#---------------MAIN SCRAPER FETCHING------------------
async def scrape_listings(postcode: str, limit: Optional[int] = None) -> List[Listing]:
    """Scrape property listings with simple duplicate prevention"""
    results: List[Listing] = []
    new_listings_count = 0
    skipped_duplicates = 0
    page = 1

    # Remove the existing listings check - let the database handle duplicates
    try:
        search_url = f"https://www.zoopla.co.uk/for-sale/property/{postcode}/?pn={page}&view_type=list"
        logger.info(f"Fetching page {page}: {search_url}")

        html = await polite_fetch_html(search_url)
        if not html:
            logger.error("No HTML content received")
            return results

        soup = BeautifulSoup(html, 'html.parser')

        # Find all listing containers
        cards = soup.select("div[data-testid='regular-listings'] > div")
        logger.info(f"Found {len(cards)} cards")

        for i, card in enumerate(cards):
            try:
                # Skip any non-listing divs (like "new-build developments")
                if "dkr2t86" not in str(card):
                    continue

                # First try to get the link with the listing details
                main_link = card.select_one('a[class*="_1lw0o5"]')
                if not main_link:
                    continue

                # Extract the property URL
                property_url = main_link.get('href')
                if not property_url:
                    continue

                # Make sure it's a full URL
                if property_url.startswith('/'):
                    property_url = f"https://www.zoopla.co.uk{property_url}"

                # Extract title and address from listing page
                title = None
                address = None

                # Try to get the link text first (usually contains the flat number)
                link_text = main_link.get_text(strip=True)
                if link_text and ('/' in link_text or 'Flat' in link_text):
                    title = link_text

                # Get the address from a dedicated address element
                address_elem = card.select_one('address')
                if address_elem:
                    address = address_elem.get_text(strip=True)
                elif not address and title:
                    # If no address element but we have a title, try to get full address from parent
                    parent_text = main_link.parent.get_text(strip=True)
                    if parent_text and len(parent_text) > len(title):
                        address = parent_text

                # If we still don't have a title, try to extract it from the address
                if not title and address:
                    # Look for flat numbers or first part of address
                    if '/' in address:
                        title = address.split(',')[0].strip()
                    elif 'Flat' in address:
                        title = address.split(',')[0].strip()
                    else:
                        # Just use the first part of the address
                        title = address.split(',')[0].strip()

                # Get price
                price_elem = card.select_one('[data-testid="listing-price"]')
                price = price_elem.get_text(strip=True) if price_elem else None

                if not all([title, address, price]):
                    logger.warning(f"Missing required data - title: {title}, address: {address}, price: {price}")
                    continue

                # Extract detailed images and coordinates from property page
                logger.info(f"Processing property {i+1}/{len(cards)}: {title}")
                image_urls, latitude, longitude = await extract_property_details(property_url)

                # Create listing object
                listing = Listing(
                    title=title,
                    address=address,
                    price=price,
                    latitude=latitude,
                    longitude=longitude,
                    image_urls=image_urls
                )

                # Save to database with simple duplicate checking
                is_new = await save_listing_to_db(listing)
                if is_new:
                    new_listings_count += 1
                else:
                    skipped_duplicates += 1

                results.append(listing)
                logger.info(f"✅ Successfully processed listing: {title} - {address} - {price}")
                logger.info(f"  - Property URL: {property_url}")
                logger.info(f"  - Images found: {len(image_urls)}")
                logger.info(f"  - Coordinates: ({latitude}, {longitude})")

                if limit and len(results) >= limit:
                    break

            except Exception as e:
                logger.error(f"Error processing card: {str(e)}", exc_info=True)
                continue

        logger.info(f"📊 Scraping summary:")
        logger.info(f"   • Total processed: {len(results)}")
        logger.info(f"   • New listings saved: {new_listings_count}")
        logger.info(f"   • Duplicates skipped: {skipped_duplicates}")

    except Exception as e:
        logger.error(f"Error in scrape_listings: {str(e)}", exc_info=True)

    return results
