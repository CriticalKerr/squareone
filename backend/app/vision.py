# The 'eyes' of the prototype, used to call OpenAI API

import os                       #for environment variables and file paths
import re                       #for extracting json from markdown fences
import json                     #for parsing json responses
import time                     #for retry backoff delays
import uuid                     #for unique filenames
import base64                   #for encoding/decoding images
import requests                 #for http calls
import openai                   #for using openai api
from io import BytesIO          #for image byte handling
from dotenv import load_dotenv  #for loading .env variables
from PIL import Image           #for image processing
from openai import OpenAI, RateLimitError   #for handling rate limits errors when calling api

#______ LOAD CONFIG AND API KEY FROM .ENV
load_dotenv()  #load values from .env into environment
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))  #create openai client with api key

#___________________________________________________________________________
#______________________________ OPENAI VISION CALL _________________________
#_call_vision() sends a text prompt and image url to the vision api and returns parsed json
def _call_vision(prompt: str, image_url: str) -> dict:
    #build chat request with a text message and one image url
    response = client.chat.completions.create(
        model="gpt-4o",  #use multimodal model
        messages=[
            {"role": "user", "content": [
                {"type": "text", "text": prompt},   #send the instructions
                {"type": "image_url", "image_url": {"url": image_url}},  #send the image link
            ]}
        ],
        max_tokens=1500   #allow enough tokens for json result
    )

    #______ DEBUG + EXTRACT JSON LOGIC
    content = response.choices[0].message.content or ""   #grab model text
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL) #try to pull json inside ``` fences
    json_str = m.group(1) if m else content.strip()   #fallback to raw content
    if not json_str.startswith("{"): #guard: must start with {
        raise ValueError(f"Model returned non-JSON response: {json_str!r}")
    return json.loads(json_str) #parse and return dict

    #______ RETRY WRAPPER FOR VISION
    #tries the call a few times if we hit rate limits, waits longer each time
def _call_vision_with_retry(prompt: str, image_url: str, max_retries: int = 5) -> dict:
    delay = 1.0                                        #start with 1s delay
    for attempt in range(1, max_retries + 1):          #loop attempts
        try:
            return _call_vision(prompt, image_url)     #try the main call
        except RateLimitError:
            if attempt == max_retries:                 #give up after last try
                raise
            print(f"Rate limited (attempt {attempt}/{max_retries}), retrying in {delay}s…")
            time.sleep(delay)                          #wait before next try
            delay *= 2                                 #exponential backoff
        except openai.OpenAIError:                     #other api errors bubble up
            raise

#calls the model in strict json mode so we never need regex
def _call_vision_json_only(messages: list, max_tokens: int = 1500) -> dict:
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        response_format={"type": "json_object"},  #force json output
        max_tokens=max_tokens,
        temperature=0.1,                          #keep answers steady
    )
    content = resp.choices[0].message.content or ""  #get model text
    if not content.strip().startswith("{"):          #must be json
        raise ValueError(f"Non-JSON content from model: {content[:200]!r}")
    return json.loads(content)                       #parse json

#______________________________________________________________________________________
#______________________________ ROOM ANALYSIS HELPERS __________________________________

#identify_room:what room type and a neutral description
def identify_room(image_url: str) -> dict:
    prompt = (
        "What type of room is this? bathroom, kitchen, living room, bedroom, or other."
        "Describe it in detail, in approx 35 words, including layout, fixtures, materials, lighting, and condition. "
        "Be objective and descriptive — don't reimagine it yet."
        " Reply in JSON with keys: type (string), confidence (0-1 float), room_description (string)."
    )
    return _call_vision_with_retry(prompt, image_url)

#classify_room_condition:says if it is new/renovated or could be refurbished
def classify_room_condition(image_url: str) -> dict:
    prompt = (
        "Look at the image and decide whether this bathroom or kitchen is:"
        " new/renovated or could be refurbished."
        " Reply in JSON with keys: state (string), confidence (0-1 float), rationale (string)."
    )
    return _call_vision_with_retry(prompt, image_url)

#analyse_floorplan:pull room list, dimensions, and total area from a plan image
def analyse_floorplan(image_url: str) -> dict:
    schema_hint = (
        '{"rooms":[{"name":"string","type":"string",'
        '"dimensions":{"length":number|null,"width":number|null},'
        '"area_sqm":number|null}],"total_area_sqm":number|null}'
    )
    primary = [
        {"role": "user", "content": [
            {"type": "text", "text":
                "You are an architect surveyor. Return ONLY valid JSON matching this schema: "
                + schema_hint +
                ". If exact dimensions are not visible, estimate numeric values. "
                "Never say you cannot measure; always estimate numerically. No prose."
             },
            {"type": "image_url", "image_url": {"url": image_url}},
        ]}
    ]
    try:
        return _call_vision_json_only(primary)  #first attempt with strict schema
    except Exception:
        #fallback with simpler rules if the first one fails
        fallback = [
            {"role": "user", "content": [
                {"type": "text", "text":
                    'Return ONLY JSON with keys "rooms" (array) and "total_area_sqm" (number|null). '
                    'If unreadable, use: {"rooms":[],"total_area_sqm":null}. No prose.'
                 },
                {"type": "image_url", "image_url": {"url": image_url}},
            ]}
        ]
        return _call_vision_json_only(fallback)

#______________________________________________________________________________________
#______________________________ REFURB IMAGE GENERATION ________________________________
#generate_refurb_edit:creates a new refurbed image for a room and saves it to disk
def generate_refurb_edit(image_url: str, room_type: str, refurb_type: str = "basic") -> str:
    #build the text prompt for each style
    refurb_prompts = {
        "basic": (
            f"Scandinavian-style full refurb of this {room_type}. "
            f"Use handleless cabinets if applicable. "
            f"White and neutral coloured fixtures "
            f"New light oak Herringbone Flooring. "
            f"Add some aesthetically pleasing accessories. "
            f"Preserve the exact layout and camera angle. "
            f"Declutter and add any missing fixtures and elements. "
            f"Photorealistic, detailed, and high-quality."
        ),
    }

    #step 1:pick the prompt for the chosen refurb type
    prompt = refurb_prompts.get(refurb_type.lower(), refurb_prompts["basic"])
    print(f"🎨 Generating {refurb_type} refurb for {room_type}")
    print(f"🎨 Using prompt: {prompt[:100]}...")  #short preview for logs

    #step 2:download the original image bytes
    resp = requests.get(image_url)
    resp.raise_for_status()

    #figure out the file type from headers or url
    content_type = resp.headers.get('content-type', '').lower()
    if 'jpeg' in content_type or 'jpg' in content_type:
        filename = "image.jpg"
    elif 'png' in content_type:
        filename = "image.png"
    elif 'webp' in content_type:
        filename = "image.webp"
    else:
        #fallback using the url extension or default to png
        if image_url.lower().endswith(('.jpg', '.jpeg')):
            filename = "image.jpg"
        elif image_url.lower().endswith('.png'):
            filename = "image.png"
        elif image_url.lower().endswith('.webp'):
            filename = "image.webp"
        else:
            filename = "image.png"

    #prepare tuple for proper file upload
    img_file = (filename, resp.content, content_type if content_type else 'image/png')

    #step 3:call the image edit endpoint to generate the refurb
    try:
        result = client.images.edit(
            model="gpt-image-1",
            image=img_file,              #original image content
            prompt=prompt,               #style and constraints
            input_fidelity="high",       #keep layout close to original
            size="1536x1024",            #explicit output size
        )
    except Exception as e:
        print(f"Error calling OpenAI image edit API: {e}")
        raise

    #step 4:decode the base64 result into an image object
    image_base64 = result.data[0].b64_json
    image_bytes = base64.b64decode(image_base64)
    img = Image.open(BytesIO(image_bytes)).convert("RGB")

    #step 5: save the image under frontend/public/images/refurb/<type>/<uuid>.png
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # Go up to project root
    refurb_base_dir = os.path.join(BASE_DIR, "frontend", "public", "images", "refurb")     # Point to frontend/public
    refurb_type_dir = os.path.join(refurb_base_dir, refurb_type.lower())    #subfolder per style
    os.makedirs(refurb_type_dir, exist_ok=True)                             #make folders if missing
    filename = f"{uuid.uuid4().hex}_{refurb_type}.png"                      #unique file name
    out_path = os.path.join(refurb_type_dir, filename)                      #full path
    img.save(out_path, format="PNG")

    return f"/static/images/refurb/{refurb_type.lower()}/{filename}"               #return url path              #return url path

#______________________________________________________________________________________
#______________________________ COST ESTIMATE GENERATION _______________________________
#refurb_cost_estimate:compares original vs refurb images and returns a cost breakdown json
def refurb_cost_estimate(
        original_image_url: str,
        refurb_image_url: str,
        room_type: str,
        room_area_sqm: float = None,
        refurb_type: str = "basic",
        reask_if_out_of_range: bool = False
) -> dict:
    #build area line used inside the prompt
    area_context = ""                                             #extra text inserted in prompt
    if room_area_sqm and room_area_sqm > 0:
        area_context = f"The {room_type} has an area of {room_area_sqm:.1f} square meters. "
        area_instruction = f"- Use the {room_area_sqm:.1f} sqm area for accurate material quantities and pricing"
    else:
        area_instruction = "- Estimate room size from the images and base material quantities on that estimate"

    #build the cost prompt that the model will follow
    prompt = f"""
    You are a professional refurbishment cost estimator in the UK. Compare these two images:
    1. The first image shows the original {room_type} {area_context}
    2. The second image shows the {refurb_type} refurbished version
    
    IMPORTANT: Use **real-world contractor pricing for Glasgow, Scotland (2025)** based ONLY on these six sources:
    - Kitchen fit cost averages £5,200, ranging from £3,700 to £9,300.
    - Medium-sized kitchen dry-fit installation typically ranges from £7,308 to £10,077, excluding appliances and installation extras.
    - A typical new bathroom costs between £4,500 and £11,000, with mid-range averaging £6,000 to £8,000; labour accounts for 45–60% of the total.
    - Daily rates: plumbers and electricians £325; plasterers, carpenters, tilers, and roofers £225; labourers £165.
    - Scotland average cost per square metre: budget £1,470, standard £1,689, premium £2,092 (excluding VAT).

    Assume:
    - Like-for-like refresh: retain layout and service locations; no structural works.
    - Minor plumbing/electrical/joinery alterations only; no full rewire/replumb unless clearly visible.
    - Fixtures, fittings, and finishes from mainstream UK suppliers (IKEA, Howdens, B&Q, Wickes, Victoria Plum, etc.).
    - This is a {refurb_type.upper()} refurbishment:
        - Budget: Basic but durable materials, cost-effective fittings.
        - Mid: Quality materials, branded fixtures, modern look.
        - Premium: High-end, luxury finish.
    
    {area_instruction}
    
    Include in your calculation:
    1. Removal & disposal: costs for old fixtures, fittings, and finishes.
    2. Fixtures: Supply and installation of all visible fixtures, fittings, and appliances relevant to a {room_type}.
    3. Flooring: Supply and installation of flooring (tiles, laminate, vinyl, etc.) including adhesives, grout, trims.
    4. Wall Finishes: Supply and installation of wall finishes (tiles, panels, paint, plaster repairs).
    5. Lighting: Supply and installation of lighting and electrical fittings, including switches, sockets, and LED features.
    6. Plumbing: works (first fix, second fix, minor alterations) and connection of fixtures.
    7. Joinery: works (boxing-in, cabinet fitting, trims, worktops, shelving).
    8. Decorating: finishing works (filling, sanding, priming, painting).
    9. Labour: costs for all relevant trades (plumber, joiner, tiler, electrician, decorator, installer) using realistic Glasgow day rates (This also should include Overheads & profit (15–25%).
    10. Contingency: 10% contingency for unforeseen works.

    Reply in JSON with keys:
    - total_cost (float): Total estimated cost in GBP for {refurb_type} refurb
    - currency (string): "GBP"
    - refurb_type (string): "{refurb_type}"
    - breakdown (object): Cost breakdown by category with amounts
    - detailed_description (string): 150-word description of the {refurb_type} refurbishment work and costs
    - materials_list (array): List of major materials/items needed
    - upgraded_items (array): List of fixtures/fittings appropriate for this standard
    - labor_categories (array): Types of trades/labour required
    - timeline_weeks (float): Estimated weeks required
    - data_used (array): URLs to all data sources used
    - estimated_area_sqm (float)
    """

    #download original image bytes from the url
    resp = requests.get(original_image_url)
    resp.raise_for_status()
    original_content = resp.content

    #read refurb image bytes from local path
    with open(refurb_image_url, 'rb') as f:
        refurb_content = f.read()

    #encode both images to base64 data urls for the api
    original_b64 = base64.b64encode(original_content).decode('utf-8')
    refurb_b64 = base64.b64encode(refurb_content).decode('utf-8')

    #json-only call so the reply is guaranteed to be valid json
    messages = [{
        "role": "user",
        "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{original_b64}"}},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{refurb_b64}"}},
        ],
    }]
    result = _call_vision_json_only(messages, max_tokens=1500)

    #attach context fields to the result without changing totals
    result["refurb_type"] = refurb_type
    result["used_floorplan_area"] = bool(room_area_sqm and room_area_sqm > 0)
    if room_area_sqm and room_area_sqm > 0:
        result["floorplan_area_sqm"] = room_area_sqm

    #helper to coerce values to floats safely
    def _f(v, default=0.0):
        try:
            return float(v)
        except Exception:
            return default

    #store a simple area number we consider "used" for display or logs
    total = _f(result.get("total_cost"))
    est_area = _f(result.get("estimated_area_sqm"))
    result["used_area_sqm"] = round(room_area_sqm or est_area or 0.0, 2)

    #set simple sanity bands for budget refurb totals
    low, high = None, None
    if refurb_type.lower() in ("basic", "budget"):
        if room_type.lower() == "bathroom":
            low, high = 3000.0, 4500.0
        elif room_type.lower() == "kitchen":
            low, high = 5200.0, 12000.0

    #tag if outside the expected range
    if low is not None and (total < low or total > high):
        result["out_of_range"] = True
        result["range_hint"] = {"low": low, "high": high, "reason": "entry-level realism check"}
    else:
        result["out_of_range"] = False

    #if out of range ask model to revise cost estimate
    if result.get("out_of_range") and reask_if_out_of_range:
        revise = [{
            "role": "user",
            "content": [
                {"type": "text", "text":
                    f"Your previous JSON total was £{total:.2f} for a {room_type} {refurb_type} refurb. "
                    f"This is outside the realistic range £{low:.0f}–£{high:.0f} for Glasgow 2025. "
                    "Increase labour/material assumptions accordingly and return JSON ONLY with the same keys. "
                    "Ensure estimated_area_sqm is numeric (float)."},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{original_b64}"}},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{refurb_b64}"}},
            ],
        }]
        revised = _call_vision_json_only(revise, max_tokens=1200) #get revised json
        revised["refurb_type"] = result["refurb_type"] #copy context
        revised["used_floorplan_area"] = result["used_floorplan_area"]
        if "floorplan_area_sqm" in result:
            revised["floorplan_area_sqm"] = result["floorplan_area_sqm"]
        revised["used_area_sqm"] = round(room_area_sqm or _f(revised.get("estimated_area_sqm")) or 0.0, 2)
        revised["reask_attempted"] = True  #note that we re-asked

        #retag based on revised total
        t2 = _f(revised.get("total_cost"))
        if low is not None and (t2 < low or t2 > high):
            revised["out_of_range"] = True
            revised["range_hint"] = {"low": low, "high": high, "reason": "entry-level realism check (after re-ask)"}
        else:
            revised["out_of_range"] = False
        return revised

    return result

