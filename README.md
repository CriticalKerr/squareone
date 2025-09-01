# 'SQUAREONE' Property Investment Analysis Prototype - Code Package

A comprehensive property investment analysis platform built with React frontend and Python backend, featuring AI-powered property condition analysis and renovation cost estimation.

## Key Modules Developed

### Backend (Python) - Custom Development
- **`pipeline.py`** - Core property analysis pipeline with functions:
  - `process_listing()` - Processes individual property listings
  - `analyse_results()` - Analyzes property condition and generates insights
  - `run_pipeline()` - Orchestrates the full analysis workflow

- **`vision.py`** - AI vision processing module with functions:
  - `identify_room()` - Classifies room types from images
  - `classify_room_condition()` - Assesses condition state of rooms
  - `analyse_floorplan()` - Processes floor plan images
  - `generate_refurb_edit()` - Creates renovation visualization renders
  - `refurb_cost_estimate()` - Generates detailed cost breakdowns

- **`db.py`** - Firestore database interface with functions:
  - `save_listing()` - Persists property data
  - `get_all_listings()` - Retrieves all properties
  - `search_listings_by_location()` - Geographic search functionality
  - `get_listings_in_bounds()` - Map-based property filtering

### Frontend (React) - Custom Development
- **`PropertyInfo.jsx`** - Main property detail dialog component
  - Responsive mobile/desktop layouts
  - Image carousel with full-screen viewing
  - Interactive cost estimation interface
  - Property bookmarking functionality

- **Custom React Hooks** - State management utilities
  - `useLikes.js` - Property favoriting system
  - `useIsMobile.js` - Responsive breakpoint detection

- **Cost Estimation Components**
  - `RefurbCostEstimateCard.jsx` - Interactive cost breakdown cards
  - `CostScenarioCard.jsx` - ROI calculation interface
  - `InfoCells.jsx` - Property information display


## 🟢 Written by Author (100% Author, 0% AI)

main.py

db.py

models.py

Dockerfile

CostScenarioCard.jsx

InfoCells.jsx

PropertyListView.jsx

PropertyPreviewCard.jsx

RefurbCostEstimateCard.jsx

LikesContext.jsx

App.jsx

main.jsx

index.html

postcss.config.js

tailwind.config.js


## 🟡 Written Partially by Author + AI (Author% / AI%)

pipeline.py (70/30)

scraper.py (30/70)

vision.py (80/20)

MapView.jsx (40/60)

PropertyFilters.jsx (50/50)

PropertyInfo.jsx (70/30)

useIsMobile.js (80/20)

useLikes.js (90/10)

utils.jsx (90/10)

propertyServices.js (70/30)

FirebaseClient.js (70/30)

vite.config.js (70/30)


## 🔴 Written by AI (0% Author, 100% AI)

ui

index.css

eslint.config.js
