import asyncio
import logging
import random
from typing import List, Optional, Dict
from bs4 import BeautifulSoup
from scrapfly import ScrapeConfig, ScrapflyClient
import os
from .models import Listing
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

async def polite_fetch_html(url: str) -> Optional[str]:
    """Fetch HTML content with polite delays and rotated user agents"""
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
# IMAGE SCRAPING HELPER METHOD
def is_property_image(url: str) -> bool:
    """Check if a URL is likely a property image"""
    if not url:
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


def get_image_id(url: str) -> str:
    """Extract unique image ID from Zoopla image URL to deduplicate different sizes"""
    # Remove any trailing suffixes like :p or :
    clean_url = re.sub(r':[p]?$', '', url)
    
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


def deduplicate_and_optimize_images(image_urls: List[str], max_images: int = 30) -> List[str]:
    """Deduplicate images and select best quality versions"""
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
# PROPERTY DETAILS EXTRACT METHOD
async def extract_property_details(property_url: str) -> tuple:
    """Extract detailed images and coordinates from individual property page"""
    logger.info(f"Fetching property details from: {property_url}")
    
    html = await polite_fetch_html(property_url)
    if not html:
        logger.warning(f"Failed to fetch property details from {property_url}")
        return [], 0.0, 0.0
    
    soup = BeautifulSoup(html, 'html.parser')
    raw_image_urls = []
    
    # Strategy 1: Look for image galleries (common on Zoopla property pages)
    gallery_selectors = [
        'div[data-testid="image-gallery"] img',
        '.gallery img',
        '[class*="gallery"] img',
        '[class*="slideshow"] img',
        '[class*="carousel"] img',
        'div[class*="image"] img'
    ]
    
    for selector in gallery_selectors:
        for img in soup.select(selector):
            # Check all possible image sources
            possible_sources = [
                img.get('src', ''),
                img.get('data-src', ''),
                img.get('data-lazy-src', ''),
                img.get('data-original', ''),
                img.get('data-zoom-src', ''),  # High-res versions
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
                if src and is_property_image(src):
                    raw_image_urls.append(src)
    
    # Strategy 2: Look for picture elements with source tags
    for picture in soup.find_all('picture'):
        sources = picture.find_all('source')
        for source in sources:
            srcset = source.get('srcset', '')
            if srcset:
                for src_item in srcset.split(','):
                    url_part = src_item.strip().split(' ')[0]
                    if url_part and is_property_image(url_part):
                        raw_image_urls.append(url_part)
    
    # Strategy 3: Look for any remaining img tags (fallback)
    for img in soup.find_all('img'):
        if img.parent and img.parent.name in ['picture']:
            continue  # Skip if already processed in picture element
            
        possible_sources = [
            img.get('src', ''),
            img.get('data-src', ''),
            img.get('data-lazy-src', ''),
            img.get('data-original', '')
        ]
        
        for src in possible_sources:
            if src and is_property_image(src):
                raw_image_urls.append(src)
    
    # Deduplicate and optimize images
    image_urls = deduplicate_and_optimize_images(raw_image_urls, max_images=30)
    
    # Extract coordinates from property page
    latitude = 0.0
    longitude = 0.0
    
    # Strategy 1: Look for map-related data attributes
    for elem in soup.find_all(attrs=True):
        for attr_name, attr_value in elem.attrs.items():
            if 'lat' in attr_name.lower() and latitude == 0.0:
                try:
                    latitude = float(attr_value)
                except (ValueError, TypeError):
                    pass
            elif any(coord in attr_name.lower() for coord in ['lng', 'lon']) and longitude == 0.0:
                try:
                    longitude = float(attr_value)
                except (ValueError, TypeError):
                    pass
    
    # Strategy 2: Look for coordinates in script tags
    if latitude == 0.0 or longitude == 0.0:
        scripts = soup.find_all('script')
        for script in scripts:
            script_content = script.string or ''
            if 'lat' in script_content.lower() and 'lng' in script_content.lower():
                # Try to extract coordinates from common patterns
                lat_match = re.search(r'"lat(?:itude)?":\s*([+-]?\d+\.?\d*)', script_content, re.IGNORECASE)
                lng_match = re.search(r'"lng|lon(?:gitude)?":\s*([+-]?\d+\.?\d*)', script_content, re.IGNORECASE)
                
                if lat_match and latitude == 0.0:
                    try:
                        latitude = float(lat_match.group(1))
                    except (ValueError, TypeError):
                        pass
                
                if lng_match and longitude == 0.0:
                    try:
                        longitude = float(lng_match.group(1))
                    except (ValueError, TypeError):
                        pass
                
                if latitude != 0.0 and longitude != 0.0:
                    break
    
    logger.info(f"Property details extracted: {len(image_urls)} images (from {len(raw_image_urls)} raw), coords: ({latitude}, {longitude})")
    return image_urls, latitude, longitude



#______________________________________________________
#---------------MAIN SCRAPER FETCHING------------------
async def scrape_listings(postcode: str, limit: Optional[int] = None) -> List[Listing]:
    """Scrape property listings with detailed property page extraction"""
    results: List[Listing] = []
    page = 1

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

                results.append(listing)
                logger.info(f"✅ Successfully processed listing: {title} - {address} - {price}")
                logger.info(f"  - Property URL: {property_url}")
                logger.info(f"  - Images found: {len(image_urls)}")
                logger.info(f"  - Coordinates: ({latitude}, {longitude})")

                if limit and len(results) >= limit:
                    return results

            except Exception as e:
                logger.error(f"Error processing card: {str(e)}", exc_info=True)
                continue

    except Exception as e:
        logger.error(f"Error in scrape_listings: {str(e)}", exc_info=True)

    return results