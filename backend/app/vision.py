import json  # For parsing JSON responses
import os  # For accessing environment variables
import re  # For stripping markdown fences around JSON
from dotenv import load_dotenv  # To load .env file values
from openai import OpenAI # OpenAI client library

load_dotenv()  # Load API keys and other settings from .env
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY')) # start up the OpenAI client

#______________________________________________________
# MAIN FUNCTION TO CALL THE VISION METHODS
# _call_vision() sends a text prompt and image URL to the GPT-4o vision API and returns parsed JSON
def _call_vision(prompt: str, image_url: str) -> dict:
    response = client.responses.create(
        model="gpt-4o-mini",
        input=[  # type: ignore[incompatible]
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {"type": "input_image","image_url": image_url,
                     "detail": "low"
                    }
                ]
            }
        ]
    )

    text = response.output_text or ""
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    json_str = m.group(1) if m else text.strip()  # Strip markdown fences if present

    if not json_str:
        raise ValueError(f"Empty response from model: {response.to_dict()!r}")

    try:
        return json.loads(json_str) # Parse and return JSON
    except json.JSONDecodeError:
        raise ValueError(f"Couldn't parse JSON from model response: {json_str!r}")

#______________________________________________________
# ANALISE ROOM CONDITION PROMPT
# classify_room_condition() uses a renovation expert prompt to label room state and confidence
def classify_room_condition(image_url: str) -> dict:
    prompt = (
        "You are a real-estate renovation expert. Look at the image and decide whether this room is:"
        " new/renovated, well-kept, or needs refurbishment."
        " Reply in JSON with keys: state (string), confidence (0-1 float), rationale (string)."
    )
    return _call_vision(prompt, image_url)

#______________________________________________________
# ANALISE FLOORPLAN PROMPT
# analyse_floorplan() uses an architect prompt to extract room list, areas, efficiency, and notes
def analyse_floorplan(image_url: str) -> dict:
    prompt = (
        "You are an architect surveyor. Analyse the floorplan image and return JSON with keys:"
        " rooms (list of {name,type,dimensions:{length,width},area_sqm}),"
        " total_area_sqm (float), room_count ({bedrooms,bathrooms,living_rooms,kitchens,other}),"
        " layout_efficiency_score (int), notes (string)."
    )
    return _call_vision(prompt, image_url)

#______________________________________________________
# ANALISE ROOM TYPE PROMPT
# identify_room() uses an expert prompt to classify the room category and confidence
def identify_room(image_url: str) -> dict:
    prompt = (
        "You are a renovation expert. Identify the room type: bathroom, kitchen, living room, bedroom, or other."
        " Reply in JSON with keys: type (string), confidence (0-1 float), rationale (string)."
    )
    return _call_vision(prompt, image_url)