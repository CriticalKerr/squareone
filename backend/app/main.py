from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from typing import List, Optional
from .models import Listing
from .scraper import scrape_listings, get_all_listings_from_db
from .db import init_db

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    await init_db()

@app.get("/scrape/{postcode}", response_model=List[Listing])
async def scrape(postcode: str, limit: Optional[int] = None):

    try:
        return await scrape_listings(postcode, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/listings", response_model=List[Listing])
async def get_all_listings():

    try:
        return await get_all_listings_from_db()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/property-gallery", response_class=HTMLResponse)
async def property_gallery():
    try:
        listings = await get_all_listings_from_db()
        
        # Build HTML content
        html_content = """
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Property Gallery</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background-color: #f5f5f5;
                }
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                }
                h1 {
                    text-align: center;
                    color: #333;
                    margin-bottom: 30px;
                }
                .property {
                    background: white;
                    border-radius: 8px;
                    margin-bottom: 30px;
                    padding: 20px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .property-header {
                    margin-bottom: 15px;
                }
                .property-title {
                    font-size: 1.5em;
                    font-weight: bold;
                    color: #2c3e50;
                    margin-bottom: 5px;
                }
                .property-address {
                    color: #7f8c8d;
                    margin-bottom: 5px;
                }
                .property-price {
                    font-size: 1.3em;
                    font-weight: bold;
                    color: #e74c3c;
                    margin-bottom: 10px;
                }
                .property-coordinates {
                    font-size: 0.9em;
                    color: #95a5a6;
                }
                .image-gallery {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 10px;
                    margin-top: 15px;
                }
                .image-item {
                    position: relative;
                    border-radius: 4px;
                    overflow: hidden;
                    background: #f8f9fa;
                }
                .image-item img {
                    width: 100%;
                    height: 150px;
                    object-fit: cover;
                    transition: transform 0.3s ease;
                }
                .image-item:hover img {
                    transform: scale(1.05);
                }
                .no-images {
                    color: #95a5a6;
                    font-style: italic;
                    padding: 20px;
                    text-align: center;
                    background: #ecf0f1;
                    border-radius: 4px;
                }
                .image-count {
                    background: #3498db;
                    color: white;
                    padding: 5px 10px;
                    border-radius: 4px;
                    font-size: 0.9em;
                    display: inline-block;
                    margin-top: 10px;
                }
                .stats {
                    text-align: center;
                    margin-bottom: 30px;
                    padding: 20px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Property Gallery</h1>
                <div class="stats">
                    <h3>Total Properties: """ + str(len(listings)) + """</h3>
                </div>
        """
        
        for listing in listings:
            # Count total images
            image_count = len(listing.image_urls) if listing.image_urls else 0
            
            html_content += f"""
                <div class="property">
                    <div class="property-header">
                        <div class="property-title">{listing.title}</div>
                        <div class="property-address">{listing.address}</div>
                        <div class="property-price">{listing.price}</div>
                        <div class="property-coordinates">
                            Coordinates: {listing.latitude}, {listing.longitude}
                        </div>
                        <div class="image-count">{image_count} images</div>
                    </div>
            """
            
            if listing.image_urls and len(listing.image_urls) > 0:
                html_content += '<div class="image-gallery">'
                for img_url in listing.image_urls:
                    html_content += f'''
                        <div class="image-item">
                            <img src="{img_url}" alt="Property image" loading="lazy" 
                                 onerror="this.style.display='none';">
                        </div>
                    '''
                html_content += '</div>'
            else:
                html_content += '<div class="no-images">No images available for this property</div>'
            
            html_content += '</div>'
        
        html_content += """
                </div>
            </body>
        </html>
        """
        
        return HTMLResponse(content=html_content)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))