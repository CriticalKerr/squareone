# Tech Stack

Project Type: Python + React Web App

IDE: IntelliJ IDEA

Dev Server: Vite

Language: Python (backend), JavaScript/HTML (frontend)

Framework: FastAPI

Frontend: React + Vite

UI: TailwindCSS

Database: Firebase (Firestore)

Frontend Hosting: Firebase (Hosting)

Backend Hosting: Google Cloud (Cloud Run)

# Key Supporting Packages & Libraries

fastapi (0.116.1) → Web framework for API (routing, dependencies, responses)

starlette (0.46.2) → ASGI toolkit used under the hood by FastAPI

uvicorn (0.35.0) → ASGI server that runs the FastAPI app

pydantic (2.11.7) → Validates request/response models

asyncpg (0.30.0) → Async PostgreSQL driver (optional/used in prototyping)

openai (1.97.1) → Calls GPT APIs (vision, image edit, text analysis)

pillow (11.3.0) → Load, process, and save images

requests (2.32.4) → HTTP client for API calls and downloads

python-dotenv (1.1.1) → Loads environment variables from .env

google-cloud-firestore (2.21.0) → Main Firestore database driver

firebase_admin (7.1.0) → Firebase admin SDK for authentication and services

google-cloud-storage (3.3.0) → Used for storing static assets

protobuf (6.32.0) → Protocol buffers for communication with Google APIs

google-auth (2.40.3) → Handles authentication for Google Cloud services

lucide-react → Icon library for React frontend


# Prerequisites

Install Python 3.12+ and pip

Install Node.js 18+ and npm

Get a MapBox API key

Set up a Firebase project (enable Firestore + Storage, download a service account JSON)

# Environment Files

(Backend → backend/.env)

OPENAI_API_KEY=your-openai-key

FIREBASE_PROJECT_ID=your-firebase-project-id

GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json

VITE_FIREBASE_API_KEY=your-firebase-api-key

VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com

VITE_FIREBASE_PROJECT_ID=your-firebase-project-id

VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com

VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id

VITE_FIREBASE_APP_ID=your-app-id

VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id

(Frontend → frontend/.env)

VITE_MAPBOX_TOKEN=your-mapbox-token

VITE_API_URL=http://127.0.0.1:8000

# Backend Setup

cd backend

python -m venv venv

source venv/bin/activate  |  Windows: venv\Scripts\activate

pip install -r requirements.txt

ls firebase-service-account.json # check service account file exists

python starter.py # or uvicorn app.main:app –reload

# Frontend Setup

cd frontend

npm install

npm run dev

App runs at http://localhost:5173

# Firebase Setup

Create project in Firebase Console

Enable Firestore Database (production mode)

Enable Cloud Storage

Generate Service Account Key and save as backend/firebase-service-account.json

# API Tests

Health: http://127.0.0.1:8000/

Listings: http://127.0.0.1:8000/listings

Analyse a single Listing: curl -X POST “http://localhost:8000/analyze-listing/{listing_id}”

Analyse All Listings: curl -X POST “http://localhost:8000/analyze-all-listings”

Pipeline saves any generated images in frontend/public/images/refurb/budget/
