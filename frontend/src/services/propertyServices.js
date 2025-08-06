//______________________________________________________
// BACKEND URL SETUP
// Get the API URL from the environment or use localhost:8000
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

//______________________________________________________
// FETCH ALL PROPERTIES
// Talk to the backend and get all listings
export async function getAllProperties() {
    const res = await fetch(`${API_BASE}/listings`);
    if (!res.ok) {
        // Show error if something goes wrong
        throw new Error(`Failed to fetch properties: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return data.listings; // Return the list of properties
}

//______________________________________________________
// FETCH PROPERTIES BY LOCATION
// Ask the backend for listings that match a search term
export async function getPropertiesByLocation(searchQuery) {
    // adjust this URL to whatever your backend expects
    const res = await fetch(`${API_BASE}/listings?search=${encodeURIComponent(searchQuery)}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch properties by location: ${res.status}`);
    }
    const data = await res.json();
    return data.listings;  // Return the filtered listings
}

//______________________________________________________
// FETCH PROPERTIES WITHIN BOUNDS
// Ask the backend for listings inside a map area (box)
export async function getPropertiesInBounds({ minLng, minLat, maxLng, maxLat }) {
    const params = new URLSearchParams({ minLng, minLat, maxLng, maxLat });
    const res = await fetch(`${API_BASE}/listings/in-bounds?${params}`);
    if (!res.ok) {
        // If this endpoint isn't ready, don't break the app
        console.warn(`in-bounds endpoint not available: ${res.status}`);
        return [];
    }
    const data = await res.json();
    return data.listings; // Return the listings inside the area
}