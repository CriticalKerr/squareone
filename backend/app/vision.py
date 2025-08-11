import os                       # for environment variables and file paths
import re                       # for extracting JSON from markdown fences
import json                     # for parsing JSON responses
import time                     # for retry backoff delays
import uuid                     # for unique filenames
import base64                   # for encoding/decoding images
import requests                 # for HTTP calls
import openai                   # for using openai API
from io import BytesIO          # for image byte handling
from dotenv import load_dotenv  # for loading .env variables
from PIL import Image           # for image processing
from openai import OpenAI, RateLimitError   # for handling rate limits errors when calling API

#______ LOAD CONGIG AND API KEYS FROM .ENV
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
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

    #______ DEBUG + EXTRACT JSON LOGIC
    content = response.choices[0].message.content or ""
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL) # extract JSON between ```json``` fences, or take raw content
    json_str = m.group(1) if m else content.strip()
    if not json_str.startswith("{"): #End early if no response
        raise ValueError(f"Model returned non-JSON response: {json_str!r}")
    return json.loads(json_str) #parse it

#______ RETRY WRAPPER FOR VISION
def _call_vision_with_retry(prompt: str, image_url: str, max_retries: int = 5) -> dict:
    delay = 1.0
    for attempt in range(1, max_retries + 1):
        try:
            return _call_vision(prompt, image_url)
        except RateLimitError:
            if attempt == max_retries:
                raise
            print(f"Rate limited (attempt {attempt}/{max_retries}), retrying in {delay}s…")
            time.sleep(delay)
            delay *= 2
        except openai.OpenAIError:
            raise
#______________________________________________________________________________________
#______________________________ ROOM ANALYSIS HELPERS ______________________________________

# what room type and description
def identify_room(image_url: str) -> dict:
    prompt = (
        "What type of room is this? bathroom, kitchen, living room, bedroom, or other."
        "Describe it in detail, in approx 35 words, including layout, fixtures, materials, lighting, and condition. "
        "Be objective and descriptive — don't reimagine it yet."
        " Reply in JSON with keys: type (string), confidence (0-1 float), room_description (string)."
    )
    return _call_vision_with_retry(prompt, image_url)

# is the room new/renovated or could be refurbished
def classify_room_condition(image_url: str) -> dict:
    # new/renovated or could be refurbished
    prompt = (
        "Look at the image and decide whether this bathroom or kitchen is:"
        " new/renovated or could be refurbished."
        " Reply in JSON with keys: state (string), confidence (0-1 float), rationale (string)."
    )
    return _call_vision_with_retry(prompt, image_url)

# look at the floorplan and find dimensions / total m2 area
def analyse_floorplan(image_url: str) -> dict:
    prompt = (
        "You are an architect surveyor. Analyse the floorplan image and return JSON with keys:"
        " rooms (list of {name,type,dimensions:{length,width},area_sqm}),"
        " total_area_sqm (float)"
    )
    return _call_vision_with_retry(prompt, image_url)

#______________________________________________________________________________________
#______________________________ REFURB IMAGE GENERATION ______________________________________
# call GPT-image API to produce a low-budget refurb
def generate_refurb_edit(image_url: str, room_type: str) -> str:

    # STEP 1: build the prompt (bathroom or kitchen)
    prompt = (
        f"Generate a minimalistic, Scandinavian-style, LOW BUDGET refurb of this {room_type}. "
        "Preserve the exact layout and camera angle."
        "Declutter and add any missing fixtures and elements."
        "Photorealistic, detailed, and high-quality."
    )

    # STEP 2: download the original image from its URL
    resp = requests.get(image_url)
    resp.raise_for_status()

    # determine the image format from the response content-type or URL
    content_type = resp.headers.get('content-type', '').lower()
    if 'jpeg' in content_type or 'jpg' in content_type:
        filename = "image.jpg"
    elif 'png' in content_type:
        filename = "image.png"
    elif 'webp' in content_type:
        filename = "image.webp"
    else:
        # fallback: try to determine from URL extension
        if image_url.lower().endswith(('.jpg', '.jpeg')):
            filename = "image.jpg"
        elif image_url.lower().endswith('.png'):
            filename = "image.png"
        elif image_url.lower().endswith('.webp'):
            filename = "image.webp"
        else:
            # default to PNG if we can't determine
            filename = "image.png"

    # create a tuple with (filename, file_content, content_type) for proper file upload
    img_file = (filename, resp.content, content_type if content_type else 'image/png')

    # STEP 3: call the image-to-image edit endpoint
    try:
        result = client.images.edit(
            model="gpt-image-1",
            image=img_file,
            prompt=prompt,
            input_fidelity="high",  # high fidelity for better input preservation
            size="1536x1024",  # specify size explicitly
        )
    except Exception as e:
        print(f"Error calling OpenAI image edit API: {e}")
        raise

    # STEP 4: decode the returned base64 image and save
    # gpt-image-1 always returns base64, not URLs
    image_base64 = result.data[0].b64_json
    image_bytes = base64.b64decode(image_base64)
    img = Image.open(BytesIO(image_bytes)).convert("RGB")

    # STEP 5: save the image
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(BASE_DIR, "static", "refurb")
    os.makedirs(out_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.png"
    out_path = os.path.join(out_dir, filename)
    img.save(out_path, format="PNG")

    return f"/static/refurb/{filename}"

#______________________________________________________________________________________
#______________________________ COST ESTIMATE GENERATION ______________________________________
# compare original vs refurbished, output costs JSON
def refurb_cost_estimate(original_image_url: str, refurb_image_url: str, room_type: str, room_area_sqm: float = None) -> dict:
    # Build area context for the prompt if available
    area_context = ""
    if room_area_sqm and room_area_sqm > 0:
        area_context = f"The {room_type} has an area of {room_area_sqm:.1f} square meters. "
        area_instruction = f"- Use the {room_area_sqm:.1f} sqm area for accurate material quantities and pricing"
    else:
        area_instruction = "- Estimate room size from the images and base material quantities on that estimate"

    # Prompt to compare the original vs refurb image
    prompt = f"""
    You are a professional refurbishment cost estimator in the UK. Compare these two images:
    1. The first image shows the original {room_type}
    2. The second image shows the refurbished version
    
    {area_context}Analyze the transformation and provide a detailed cost estimate for achieving this refurbishment.
    Consider all materials, labor, fixtures, and finishes needed.
    
    Provide a comprehensive breakdown including:
    - Individual cost categories (e.g., carpentry, plumbing, electrical, materials, etc.)
    - Detailed description of what work would be required
    - Labour costs (Scotland, UK rates, VAT inclusive)
    - Material costs based on mid-2025 UK pricing
    - 10% contingency allowance
    {area_instruction}
    
    Reply in JSON with keys:
    - total_cost (float): Total estimated cost in GBP
    - currency (string): "GBP"
    - breakdown (object): Cost breakdown by category with amounts
    - detailed_description (string): Comprehensive description of the refurbishment work and costs in exactly 150 words
    - materials_list (array): List of major materials/items needed
    - upgraded_items (array): List of upgraded fixtures
    - labor_categories (array): Types of trades/labor required
    - timeline_weeks (float): Estimated number of weeks required for the refurbishment
    - data_used (array): URL links to all data sources used in the analysis
    """

    # Download original image
    resp = requests.get(original_image_url)
    resp.raise_for_status()
    original_content = resp.content

    # Read refurb image from local file
    with open(refurb_image_url, 'rb') as f:
        refurb_content = f.read()

    # Encode both as base64 for Vision API
    original_b64 = base64.b64encode(original_content).decode('utf-8')
    refurb_b64 = base64.b64encode(refurb_content).decode('utf-8')

    # GPT-4o vision with two embedded images
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "user", "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{original_b64}"}},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{refurb_b64}"}},
            ]}
        ],
        max_tokens=1500
    )

    content = response.choices[0].message.content or ""
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
    json_str = m.group(1) if m else content.strip()
    if not json_str.startswith("{"):
        raise ValueError(f"Model returned non-JSON response: {json_str!r}")
    result = json.loads(json_str)

    # Add metadata about whether we used floorplan data
    result["used_floorplan_area"] = bool(room_area_sqm and room_area_sqm > 0)
    if room_area_sqm and room_area_sqm > 0:
        result["floorplan_area_sqm"] = room_area_sqm

    return result
