from fastapi import HTTPException
from fastapi.responses import HTMLResponse
from db import get_all_listings
from main import app

@app.get("/property-gallery", response_class=HTMLResponse)
async def property_gallery():
    """Display all properties with their images and floorplans in a gallery format"""
    try:
        listings = await get_all_listings()

        html_content = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Property Gallery</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background-color: #f5f5f5;
                }}
                .container {{
                    max-width: 1200px;
                    margin: 0 auto;
                }}
                h1 {{
                    text-align: center;
                    color: #333;
                    margin-bottom: 30px;
                }}
                .nav-links {{
                    text-align: center;
                    margin-bottom: 30px;
                    padding: 20px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }}
                .nav-links a {{
                    color: white;
                    text-decoration: none;
                    margin: 0 10px;
                    padding: 12px 24px;
                    background: #3498db;
                    border-radius: 6px;
                    display: inline-block;
                    transition: background-color 0.3s;
                }}
                .nav-links a:hover {{
                    background: #2980b9;
                }}
                .add-button {{
                    background: #27ae60 !important;
                }}
                .add-button:hover {{
                    background: #219a52 !important;
                }}
                .stats {{
                    text-align: center;
                    margin-bottom: 30px;
                    padding: 20px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }}
                .property {{
                    background: white;
                    border-radius: 8px;
                    margin-bottom: 30px;
                    padding: 20px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }}
                .property-header {{
                    margin-bottom: 15px;
                }}
                .property-title {{
                    font-size: 1.5em;
                    font-weight: bold;
                    color: #2c3e50;
                    margin-bottom: 5px;
                }}
                .property-address {{
                    color: #7f8c8d;
                    margin-bottom: 5px;
                }}
                .property-price {{
                    font-size: 1.3em;
                    font-weight: bold;
                    color: #e74c3c;
                    margin-bottom: 10px;
                }}
                .property-details {{
                    display: flex;
                    gap: 15px;
                    margin: 10px 0;
                    flex-wrap: wrap;
                }}
                .property-detail {{
                    background: #ecf0f1;
                    padding: 5px 12px;
                    border-radius: 15px;
                    font-size: 0.9em;
                    color: #2c3e50;
                }}
                .property-detail.bedrooms {{
                    background: #e8f4fd;
                    color: #2980b9;
                }}
                .property-detail.bathrooms {{
                    background: #fef9e7;
                    color: #f39c12;
                }}
                .property-detail.type {{
                    background: #eafaf1;
                    color: #27ae60;
                }}
                .property-link {{
                    color: #3498db;
                    text-decoration: none;
                    font-size: 0.9em;
                }}
                .property-link:hover {{
                    text-decoration: underline;
                }}
                .section-title {{
                    font-size: 1.2em;
                    font-weight: bold;
                    color: #34495e;
                    margin: 20px 0 10px 0;
                    border-bottom: 2px solid #ecf0f1;
                    padding-bottom: 5px;
                }}
                .image-gallery {{
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 10px;
                    margin-top: 15px;
                }}
                .floorplan-gallery {{
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 15px;
                    margin-top: 15px;
                }}
                .image-item {{
                    position: relative;
                    border-radius: 4px;
                    overflow: hidden;
                    background: #f8f9fa;
                }}
                .image-item img {{
                    width: 100%;
                    height: 150px;
                    object-fit: cover;
                    transition: transform 0.3s ease;
                }}
                .floorplan-item {{
                    position: relative;
                    border-radius: 4px;
                    overflow: hidden;
                    background: #f8f9fa;
                    border: 2px solid #e67e22;
                }}
                .floorplan-item img {{
                    width: 100%;
                    height: 200px;
                    object-fit: contain;
                    background: white;
                    transition: transform 0.3s ease;
                }}
                .image-item:hover img, .floorplan-item:hover img {{
                    transform: scale(1.05);
                }}
                .no-content {{
                    color: #95a5a6;
                    font-style: italic;
                    padding: 20px;
                    text-align: center;
                    background: #ecf0f1;
                    border-radius: 4px;
                }}
                .count-badge {{
                    color: white;
                    padding: 5px 10px;
                    border-radius: 4px;
                    font-size: 0.9em;
                    display: inline-block;
                    margin-top: 10px;
                    margin-right: 10px;
                }}
                .image-count {{
                    background: #3498db;
                }}
                .floorplan-count {{
                    background: #e67e22;
                }}
                .empty-state {{
                    text-align: center;
                    padding: 60px 20px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }}
                .empty-state h3 {{
                    color: #7f8c8d;
                    margin-bottom: 15px;
                }}
                .empty-state p {{
                    color: #95a5a6;
                    margin-bottom: 25px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Property Gallery</h1>
                
                <div class="nav-links">
                    <a href="/add-listing-form" class="add-button">➕ Add Property</a>
                    <a href="/property-gallery">📸 View Gallery</a>
                    <a href="/listings">📊 View Data</a>
                </div>
                
                <div class="stats">
                    <h3>Total Properties: {len(listings)}</h3>
                </div>
        """

        if len(listings) == 0:
            html_content += """
                <div class="empty-state">
                    <h3>No Properties Found</h3>
                    <p>Click "Add Property" to add your first property listing.</p>
                </div>
            """
        else:
            for listing in listings:
                image_count = len(listing.get('image_urls', []))
                floorplan_count = len(listing.get('floorplan_urls', []))

                # Get the new fields with defaults
                bedrooms = listing.get('bedrooms_count', 0)
                bathrooms = listing.get('bathrooms_count', 0)
                prop_type = listing.get('property_type', 'Unknown')

                html_content += f"""
                    <div class="property">
                        <div class="property-header">
                            <div class="property-title">{listing['title']}</div>
                            <div class="property-address">{listing['address']}</div>
                            <div class="property-price">{listing['price']}</div>
                            
                            <div class="property-details">
                                <div class="property-detail bedrooms">🛏️ {bedrooms} bed{'s' if bedrooms != 1 else ''}</div>
                                <div class="property-detail bathrooms">🚿 {bathrooms} bath{'s' if bathrooms != 1 else ''}</div>
                                <div class="property-detail type">🏠 {prop_type}</div>
                            </div>
                            
                            <a href="{listing['listing_link']}" target="_blank" class="property-link">View Original Listing →</a>
                            <div class="count-badge image-count">{image_count} images</div>
                            <div class="count-badge floorplan-count">{floorplan_count} floorplans</div>
                        </div>
                """

                # Display floorplans
                if listing.get('floorplan_urls') and len(listing['floorplan_urls']) > 0:
                    html_content += '<div class="section-title">📋 Floor Plans</div>'
                    html_content += '<div class="floorplan-gallery">'
                    for floorplan_url in listing['floorplan_urls']:
                        html_content += f'''
                            <div class="floorplan-item">
                                <img src="{floorplan_url}" alt="Floor plan" loading="lazy" 
                                     onerror="this.style.display='none';">
                            </div>
                        '''
                    html_content += '</div>'
                else:
                    html_content += '<div class="section-title">📋 Floor Plans</div>'
                    html_content += '<div class="no-content">No floor plans available</div>'

                # Display property images
                if listing.get('image_urls') and len(listing['image_urls']) > 0:
                    html_content += '<div class="section-title">📸 Property Images</div>'
                    html_content += '<div class="image-gallery">'
                    for img_url in listing['image_urls']:
                        html_content += f'''
                            <div class="image-item">
                                <img src="{img_url}" alt="Property image" loading="lazy" 
                                     onerror="this.style.display='none';">
                            </div>
                        '''
                    html_content += '</div>'
                else:
                    html_content += '<div class="section-title">📸 Property Images</div>'
                    html_content += '<div class="no-content">No images available</div>'

                html_content += '</div>'

        html_content += """
                </div>
            </body>
        </html>
        """

        return HTMLResponse(content=html_content)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))