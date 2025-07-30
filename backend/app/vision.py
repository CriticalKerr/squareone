import json  # For parsing JSON responses
import os  # For accessing environment variables
import re  # For stripping markdown fences around JSON
import uuid
import time
import openai
import requests
import base64
from dotenv import load_dotenv  # To load .env file values
from openai import OpenAI, RateLimitError
from PIL import Image
from io import BytesIO

load_dotenv()  # Load API keys and other settings from .env
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))  # OpenAI client library
BFL_API_HOST = os.getenv("BFL_API_HOST")
BFL_API_KEY = os.getenv("BFL_API_KEY")
STATIC_DIR = os.getenv("STATIC_DIR", "static")

#___________________________________________________________________________
#______________________________ OPENAI VISION CALL _________________________

# _call_vision() sends a text prompt and image URL to the GPT-4o vision API and returns parsed JSON
def _call_vision(prompt: str, image_url: str) -> dict:

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "user", "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": image_url}},
            ]}
        ],
        max_tokens=1500
    )
    content = response.choices[0].message.content or ""

    # —— DEBUG LOGGING ——
    print("️ ✅[Vision raw output]: Great success!")       #repr(content))
    # —— EXTRACT JSON ——
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
    json_str = m.group(1) if m else content.strip()
    print("✅️ [Vision extracted JSON]: Great success!")     #repr(json_str))
    # —— EARLY FAIL ——
    if not json_str.startswith("{"):
        raise ValueError(f"Model returned non-JSON response: {json_str!r}")
    # —— PARSE ——
    return json.loads(json_str)

# —— NEW RETRY WRAPPER ——
def _call_vision_with_retry(prompt: str, image_url: str, max_retries: int = 5) -> dict:
    delay = 1.0
    for attempt in range(1, max_retries + 1):
        try:
            return _call_vision(prompt, image_url)
        except RateLimitError:
            if attempt == max_retries:
                raise
            print(f"⚠️ Rate limited (attempt {attempt}/{max_retries}), retrying in {delay}s…")
            time.sleep(delay)
            delay *= 2
        except openai.OpenAIError:
            # bubble up other OpenAI errors
            raise

#______________________________________________________________________________________
#______________________________ ROOM ANALYSIS HELPERS ______________________________________
def identify_room(image_url: str) -> dict:
    prompt = (
        "What type of room is this? bathroom, kitchen, living room, bedroom, or other."
        "Describe it in detail including layout, fixtures, materials, lighting, and condition. "
        "Be objective and descriptive — don't reimagine it yet."
        " Reply in JSON with keys: type (string), confidence (0-1 float), room_description (string)."
    )
    return _call_vision_with_retry(prompt, image_url)

def classify_room_condition(image_url: str) -> dict:
    prompt = (
        "Look at the image and decide whether this bathroom or kitchen is:"
        " new/renovated or could be refurbished."
        " Reply in JSON with keys: state (string), confidence (0-1 float), rationale (string)."
    )
    return _call_vision_with_retry(prompt, image_url)

def analyse_floorplan(image_url: str) -> dict:
    prompt = (
        "You are an architect surveyor. Analyse the floorplan image and return JSON with keys:"
        " rooms (list of {name,type,dimensions:{length,width},area_sqm}),"
        " total_area_sqm (float), room_count ({bedrooms,bathrooms,living_rooms,kitchens,other}),"
        " layout_efficiency_score (int), notes (string)."
    )
    return _call_vision_with_retry(prompt, image_url)

def refurb_cost_estimate(image_url: str) -> dict:
    prompt = (
        "You are a refurbisher. Estimate the cost of refurbishing this room."
        "Reply in JSON with keys: cost (float), currency (string)"
    )
    return _call_vision_with_retry(prompt, image_url)

#______________________________________________________________________________________
#______________________________ IMAGE GENERATION ______________________________________
def generate_refurb_edit(image_url: str, room_type: str) -> str:

    # STEP 1: Build the prompt (bathroom or kitchen)
    prompt = (
        f"Generate a minimalistic Scandinavian refurb of this {room_type}. "
        "Preserve the exact layout and camera angle."
        "Photorealistic, detailed, and high-quality."
    )

    # STEP 2: Download the original image from its URL
    resp = requests.get(image_url)
    resp.raise_for_status()

    # STEP 3: Determine the image format from the response content-type or URL
    content_type = resp.headers.get('content-type', '').lower()
    if 'jpeg' in content_type or 'jpg' in content_type:
        filename = "image.jpg"
    elif 'png' in content_type:
        filename = "image.png"
    elif 'webp' in content_type:
        filename = "image.webp"
    else:
        # Fallback: try to determine from URL extension
        if image_url.lower().endswith(('.jpg', '.jpeg')):
            filename = "image.jpg"
        elif image_url.lower().endswith('.png'):
            filename = "image.png"
        elif image_url.lower().endswith('.webp'):
            filename = "image.webp"
        else:
            # Default to PNG if we can't determine
            filename = "image.png"

    # Create a tuple with (filename, file_content, content_type) for proper file upload
    img_file = (filename, resp.content, content_type if content_type else 'image/png')

    # STEP 3: Call the image-to-image edit endpoint
    try:
        result = client.images.edit(
            model="gpt-image-1",
            image=img_file,  # Pass as proper file tuple
            prompt=prompt,
            input_fidelity="high",  # High fidelity for better input preservation
            size="1024x1024",  # Specify size explicitly
        )
    except Exception as e:
        print(f"Error calling OpenAI image edit API: {e}")
        raise

    # STEP 4: Decode the returned base64 image and save
    # gpt-image-1 always returns base64, not URLs
    image_base64 = result.data[0].b64_json
    image_bytes = base64.b64decode(image_base64)
    img = Image.open(BytesIO(image_bytes)).convert("RGB")

    # STEP 5: Save the image
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(BASE_DIR, "static", "refurb")
    os.makedirs(out_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.png"
    out_path = os.path.join(out_dir, filename)
    img.save(out_path, format="PNG")

    return f"/static/refurb/{filename}"

