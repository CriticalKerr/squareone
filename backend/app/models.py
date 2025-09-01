#Rule book that says what info each property must have (price, bedrooms, etc).

from typing import List, Dict, Any
from pydantic import BaseModel

#______________________________________________________
# LISTING SCHEMA DEFINITION
# Listing describes the structure of data accepted and returned by the API
class Listing(BaseModel):
    listing_link: str
    title: str
    address: str
    price: str
    latitude: float
    longitude: float
    image_urls: List[str]
    floorplan_urls: List[str]
    bedrooms_count: int
    bathrooms_count: int
    property_type: str
    condition_analysis: List[Dict[str, Any]] = [] #LLM condition analysis
    floorplan_analysis: List[Dict[str, Any]] = [] #LLM floorplan analysis