import logging
import requests
import json
from openai import OpenAI, OpenAIError
from enum import Enum

logger = logging.getLogger(__name__)
client = OpenAI()  #TOTDO make sure you’ve set OPENAI_API_KEY in env

class AnalysisType(Enum):
    ROOM_CONDITION = "room_condition"
    FLOORPLAN_ANALYSIS = "floorplan_analysis"
    ROOM_IDENTIFICATION = "room_identification"

#______________________________________________________
# RAISE EXCEPTION WHEN LLM FAILS TO CLASSIFY IMAGE
class VisionServiceError(Exception):
    pass

#______________________________________________________
# FUNCTION TO CLASSIFY ROOM CONDITION
def classify_room_condition(image_url: str) -> dict:
    #check health of URL
    try:
        head = requests.head(image_url, timeout=5)
        head.raise_for_status()
    except Exception as e:
        logger.error("Cannot fetch image %s: %s", image_url, e)
        raise VisionServiceError(f"Image URL unreachable: {e}")

    #check health of URL
    system_msg = {
            "role": "system",
            "content": "You are a real-estate renovation expert."
        }

    #text + image prompt
    user_msg = {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": (
                    "Look at the image below and decide whether this room is:\n"
                    "  • new/renovated\n"
                    "  • well-kept\n"
                    "  • needs refurbishment\n\n"
                    "Reply strictly in JSON with keys:\n"
                    "  state (string), confidence (0–1 float), rationale (string)"
                )
            },
            {
                "type": "image_url",
                "image_url": { "url": image_url },
                "detail": "high" #high-quality check
            }
        ]
    }

    #call vision API
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[system_msg, user_msg],
            max_tokens=150,
            temperature=0.0
        )
        raw = resp.choices[0].message.content
        result = json.loads(raw)
    except OpenAIError as e:
        logger.exception("OpenAI API error on %s", image_url)
        raise VisionServiceError(f"OpenAI API error: {e}")
    except (ValueError, KeyError) as e:
        logger.exception("Invalid JSON from GPT-4V: %s", raw)
        raise VisionServiceError(f"Malformed JSON response: {e}")

    #check if the state field is valid
    valid = {"new/renovated", "well-kept", "needs refurbishment"}
    if result.get("state") not in valid:
        msg = f"Unexpected state: {result.get('state')}"
        logger.error(msg)
        raise VisionServiceError(msg)

    return result


#______________________________________________________
# ANALISE FLOORPLAN TO EXTRACT ROOM DIMENSIONS AND AREAS
def analyse_floorplan(image_url: str) -> dict:
    global raw
    try:
        head = requests.head(image_url, timeout=5)
        head.raise_for_status()
    except Exception as e:
        logger.error("Cannot fetch floorplan %s: %s", image_url, e)
        raise VisionServiceError(f"Floorplan URL unreachable: {e}")

    system_msg = {
        "role": "system",
        "content": "You are an expert architect and property surveyor specializing in floorplan analysis."
    }

    user_msg = {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": (
                    "Analyze this floorplan image and extract the following information:\n"
                    "1. Room dimensions (length x width in meters if available)\n"
                    "2. Room areas (square meters)\n"
                    "3. Room types and their count\n"
                    "4. Total property area\n"
                    "5. Layout efficiency score (1-10)\n\n"
                    "Reply strictly in JSON format with keys:\n"
                    "{\n"
                    "  'rooms': [{'name': str, 'type': str, 'dimensions': {'length': float, 'width': float}, 'area_sqm': float}],\n"
                    "  'total_area_sqm': float,\n"
                    "  'room_count': {'bedrooms': int, 'bathrooms': int, 'living_rooms': int, 'kitchens': int, 'other': int},\n"
                    "  'layout_efficiency_score': int,\n"
                    "  'notes': str\n"
                    "}"
                )
            },
            {
                "type": "image_url",
                "image_url": {"url": image_url},
                "detail": "high"
            }
        ]
    }

    try:
        resp = client.chat.completions.create(
            model="gpt-4o",  # Using gpt-4o for more complex analysis
            messages=[system_msg, user_msg],
            max_tokens=500,
            temperature=0.1
        )
        raw = resp.choices[0].message.content
        result = json.loads(raw)
        return result

    except OpenAIError as e:
        logger.exception("OpenAI API error on floorplan %s", image_url)
        raise VisionServiceError(f"OpenAI API error: {e}")
    except (ValueError, KeyError) as e:
        logger.exception("Invalid JSON from GPT-4V: %s", raw)
        raise VisionServiceError(f"Malformed JSON response: {e}")








