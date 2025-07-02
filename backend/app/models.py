from pydantic import BaseModel
from typing import List

class Listing(BaseModel):
    listing_link: str
    title: str
    address: str
    price: str
    latitude: float
    longitude: float
    image_urls: List[str]
    floorplan_urls: List[str]



