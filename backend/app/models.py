from pydantic import BaseModel
from typing import List

class Listing(BaseModel):
    title: str
    address: str
    price: str
    latitude: float
    longitude: float
    image_urls: List[str]