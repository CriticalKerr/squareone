//______________________________________________________
// IMPORTS
// react, mapbox, styles, icons, ui, and helpers we will use
import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import '../index.css';
import { Search, X, Map, List } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PropertyInfo from './PropertyInfo.jsx';
import PropertyFilters from './PropertyFilters';
import PropertyPreviewCard, { formatPrice } from './PropertyPreviewCard';
import {getAllProperties, getPropertiesByLocation,
    getPropertiesInBounds,
} from '../services/propertyServices.js';
import ReactDOM from 'react-dom/client'; // Add this line
import { Heart } from 'lucide-react'; // Add this line
import { useLikesContext } from '../contexts/LikesContext';
import PropertyListView from './PropertyListView';
import { useIsMobile } from '../hooks/useIsMobile'; // Add this import

//______________________________________________________
// CONSTANTS
// mapbox access token from env
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

//______________________________________________________
// HELPERS
// make every raw property object look the same
const normalizeProperty = (raw) => {
    const property_type = raw.property_type || raw.type || ''; //choose best name
    const address = raw.address || ''; //safe default
    const price = raw.price; //keep as-is
    const bedrooms_count = raw.bedrooms_count ?? raw.bedrooms ?? null; //prefer new field
    const bathrooms_count = raw.bathrooms_count ?? raw.bathrooms ?? null; //prefer new field

    let total_area_sqm = raw.total_area_sqm ?? null; //area in sqm
    let sqft = raw.sqft ?? null; //area in sqft

    //try to read area from floorplan analysis if main field is missing
    if (!total_area_sqm && raw.floorplan_analysis) {
        try {
            const floorplanArray = Array.isArray(raw.floorplan_analysis)
                ? raw.floorplan_analysis
                : JSON.parse(raw.floorplan_analysis || '[]'); //parse string or empty list
            if (floorplanArray.length > 0 && floorplanArray[0].analysis) {
                total_area_sqm = floorplanArray[0].analysis.total_area_sqm || null; //pull sqm
            }
        } catch (e) {
            console.warn('Failed to parse floorplan_analysis:', e);
        }
    }

    //convert between sqft and sqm if one is missing
    if (total_area_sqm == null && sqft != null) {
        total_area_sqm = Number((sqft * 0.092903).toFixed(1)); //sqft→sqm
    }
    if (sqft == null && total_area_sqm != null) {
        sqft = Number((total_area_sqm / 0.092903).toFixed(1)); //sqm→sqft
    }

    //always return an array for images
    const image_urls = Array.isArray(raw.image_urls)
        ? raw.image_urls
        : raw.image_urls
            ? [raw.image_urls]
            : [];
    const floorplan_urls = raw.floorplan_urls; //may be a string

    const longitude = raw.longitude; //lng
    const latitude = raw.latitude; //lat
    const description = raw.description || ''; //short text
    const valueIncrease = raw.valueIncrease ?? raw.value_increase; //percent value change

    //kitchen/bath conditions from newest source or fallback
    let kitchenCondition = raw.kitchenCondition;
    let bathroomCondition = raw.bathroomCondition;
    if ((!kitchenCondition || !bathroomCondition) && raw.condition_analysis) {
        try {
            const condArray = Array.isArray(raw.condition_analysis)
                ? raw.condition_analysis
                : JSON.parse(raw.condition_analysis || '[]'); //parse or empty
            const kitchen = condArray.find((r) => r.room_type === 'kitchen');
            const bathroom = condArray.find((r) => r.room_type === 'bathroom');
            if (!kitchenCondition && kitchen) kitchenCondition = kitchen.state; //fill missing
            if (!bathroomCondition && bathroom) bathroomCondition = bathroom.state; //fill missing
        } catch { /* swallow parse errors */ }
    }

    //return a clean, consistent object
    return {...raw, property_type, address, price, bedrooms_count, bathrooms_count, total_area_sqm, sqft, image_urls, floorplan_urls, longitude, latitude, description, valueIncrease, kitchenCondition, bathroomCondition, condition_analysis: raw.condition_analysis, //keep original field
    };
};

//______________________________________________________
// GET BOUNDARY FROM PROPERTIES
//build a bbox or center from a list of properties
const getBoundsFromProps = (props = []) => {
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    let count = 0; //how many valid coords we saw
    for (const p of props) {
        const lng = Number(p.longitude ?? p.lng ?? p.lon); //handle variants
        const lat = Number(p.latitude ?? p.lat); //handle variants
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
            minLng = Math.min(minLng, lng);
            minLat = Math.min(minLat, lat);
            maxLng = Math.max(maxLng, lng);
            maxLat = Math.max(maxLat, lat);
            count++;
        }
    }
    if (!count) return null; //no coords at all
    if (minLng === maxLng && minLat === maxLat) return { center: [minLng, minLat] }; //single point
    return { bbox: [minLng, minLat, maxLng, maxLat] }; //west,south,east,north
};

//merge two bboxes into one bigger box
const mergeBbox = (a, b) => {
    if (!a) return b || null;
    if (!b) return a || null;
    return [
        Math.min(a[0], b[0]),
        Math.min(a[1], b[1]),
        Math.max(a[2], b[2]),
        Math.max(a[3], b[3]),
    ];
};

//______________________________________________________
// MAP VIEW COMPONENT
// shows the map, search bar, filters, markers, hover card, and a details dialog
const MapView = () => {
    const { likedProperties } = useLikesContext(); // Use shared context instead
    const isMobile = useIsMobile(); // Add this hook

    //______________________________________________________
    // REFS
    //keep handles to the map, markers, and search controller
    const mapContainer = useRef(null); //div for the map
    const map = useRef(null); //mapbox map instance
    const markersRef = useRef([]); //list of mapbox markers
    const searchAbortRef = useRef(null); //abort for fetch
    const lastGeocodeBboxRef = useRef(null); //remembers last searched bbox

    //______________________________________________________
    // UI + DATA STATE TRACKING
    //track ui state and data we show
    const [searchQuery, setSearchQuery] = useState(''); //text in the search box
    const [selectedProperty, setSelectedProperty] = useState(null); //clicked marker property
    const [hoveredProperty, setHoveredProperty] = useState(null); //property under mouse
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 }); //mouse coords
    const [showSidebar] = useState(false); //placeholder if you add a sidebar later
    const [isDialogOpen, setIsDialogOpen] = useState(false); //property dialog open
    const [filteredProperties, setFilteredProperties] = useState([]); //props shown on map
    const [isSearching, setIsSearching] = useState(false); //loading state for search
    const [triggerPosition, setTriggerPosition] = useState(null); //where to anchor dialog animation
    const [showFilters, setShowFilters] = useState(false); // ADD THIS LINE - controls filter visibility
    const [filters, setFilters] = useState({kitchenCondition: 'all', bathroomCondition: 'all', priceRange: 'all'});
    const [viewMode, setViewMode] = useState('map'); // 'map' or 'list'

    //______________________________________________________
    // FILTER LOGIC
    //only keep properties that match the chosen kitchen/bathroom conditions
    const filterProperties = useCallback((properties, activeFilters) => {
        return properties.filter(property => {
            const conditionAnalysis = Array.isArray(property.condition_analysis)
                ? property.condition_analysis
                : JSON.parse(property.condition_analysis || '[]');

            const bathroom = conditionAnalysis.find(r => r.room_type === 'bathroom');
            const kitchen = conditionAnalysis.find(r => r.room_type === 'kitchen');
            const bathroomState = bathroom?.state || property.bathroomCondition || 'unknown';
            const kitchenState = kitchen?.state || property.kitchenCondition || 'unknown';
            // Kitchen condition filter
            if (activeFilters.kitchenCondition && activeFilters.kitchenCondition !== 'all') {
                if (activeFilters.kitchenCondition !== kitchenState) return false;
            }
            // Bathroom condition filter
            if (activeFilters.bathroomCondition && activeFilters.bathroomCondition !== 'all') {
                if (activeFilters.bathroomCondition !== bathroomState) return false;
            }
            // Price range filter
            if (activeFilters.priceRange && activeFilters.priceRange !== 'all') {
                const priceStr = property.price;
                if (!priceStr) return false; // No price data

                const priceMatch = priceStr.replace(/[£,]/g, '').match(/\d+/);
                if (!priceMatch) return false;
                const priceValue = parseInt(priceMatch[0], 10);
                console.log(`Property: ${property.address || 'Unknown'}, Price: ${priceStr}, Parsed: ${priceValue}, Filter: ${activeFilters.priceRange}`);

                switch (activeFilters.priceRange) {
                    case '< 150k':
                        if (priceValue >= 150000) {
                            console.log(`Filtering OUT (price ${priceValue} >= 150000)`);
                            return false;
                        }
                        break;
                    case '150k-200k':
                        if (priceValue < 150000 || priceValue > 200000) {
                            console.log(`Filtering OUT (price ${priceValue} not between 150k-200k)`);
                            return false;
                        }
                        break;
                    case '> 200k':  // Note: changed from '200k+' to match your button
                        if (priceValue <= 200000) {
                            console.log(`Filtering OUT (price ${priceValue} <= 200000)`);
                            return false;
                        }
                        console.log(`Keeping property (price ${priceValue} > 200000)`);
                        break;
                    default:
                        break;
                }
            }

            return true;
        });
    }, []);

    //______________________________________________________
    // HANDLE LIST VIEW
    // Add this handler function (around line 250 with other handlers)
    const handlePropertyClick = (property) => {
        setSelectedProperty(property);
        setIsDialogOpen(true);
        // For list view, we don't need trigger position animation
        setTriggerPosition(null);
    };

    //______________________________________________________
    // APPLY FILTERS
    //reload all properties then apply the new filters
    const handleFiltersChange = useCallback((newFilters) => {
        setFilters(newFilters); //update ui state
        getAllProperties()
            .then((all) => {
                const normalized = Array.isArray(all) ? all.map(normalizeProperty) : []; //clean data
                const filtered = filterProperties(normalized, newFilters); //apply rules
                setFilteredProperties(filtered); //show only matches
            })
            .catch((e) => console.error('Failed to reload and filter properties', e));
    }, [filterProperties]);

    //______________________________________________________
    // LOAD INITIAL PROPERTIES
    //fetch all properties when the component mounts
    useEffect(() => {
        (async () => {
            try {
                const all = await getAllProperties();
                setFilteredProperties(Array.isArray(all) ? all.map(normalizeProperty) : []); //store normalized list
            } catch (e) {
                console.error('Failed to load properties', e);
            }
        })();
    }, []);

    //______________________________________________________
    // MARKERS: CLEAR
    //remove all markers from the map and cleanup React roots
    const clearMarkers = useCallback(() => {
        markersRef.current.forEach((marker) => {
            const element = marker.getElement();
            marker.remove(); //remove from map first

            // Defer React root cleanup to avoid race condition
            if (element && element._reactRoot) {
                // Use setTimeout to defer unmounting until after current render cycle
                setTimeout(() => {
                    try {
                        element._reactRoot.unmount();
                    } catch (error) {
                        console.warn('Error unmounting React root:', error);
                    }
                }, 0);
            }
        });
        markersRef.current = []; //reset list
    }, []);

    //______________________________________________________
    // MARKERS: DOM ELEMENT
    //create a html element for each marker
    const createMarkerElement = useCallback((property) => {
        const propertyId = property.id || property.listing_id;
        const liked = likedProperties.includes(propertyId);
        // Use a more robust mobile detection that matches your useIsMobile hook
        const isMobile = window.innerWidth < 768;

        console.log(`Creating marker for ${propertyId}, liked: ${liked}, mobile: ${isMobile}`);

        if (liked) {
            // Create black heart for liked properties
            const heartEl = document.createElement('div');
            heartEl.className = 'property-marker cursor-pointer';

            // Enhanced mobile-friendly styles
            heartEl.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            ${isMobile ? 'min-width: 44px; min-height: 44px; padding: 6px;' : 'min-width: 30px; min-height: 30px;'}
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
        `;

            // Create a React root and render the Heart component
            const root = ReactDOM.createRoot(heartEl);
            root.render(
                React.createElement(Heart, {
                    size: isMobile ? 28 : 24, // Appropriate size for mobile
                    className: 'animate-heart-pop-continuous',
                    fill: '#000000',
                    color: '#000000',
                    style: {
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                        pointerEvents: 'none' // Prevent interference with click events
                    }
                })
            );

            // Store the root reference for cleanup
            heartEl._reactRoot = root;
            return heartEl;

        } else {
            // Regular price marker with enhanced mobile support
            const wrapper = document.createElement('div');
            wrapper.className = 'property-marker';

            // Enhanced mobile-friendly touch target
            wrapper.style.cssText = `
            ${isMobile ? 'min-width: 44px; min-height: 44px; padding: 6px;' : ''}
            display: flex; 
            align-items: center; 
            justify-content: center; 
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
        `;

            const container = document.createElement('div');
            container.className = 'relative';

            const priceDiv = document.createElement('div');
            priceDiv.className = `bg-slate-900 text-white px-2 py-1 rounded text-xs font-medium cursor-pointer hover:bg-slate-800 transition-colors shadow-lg ${isMobile ? 'text-sm px-3 py-2' : ''}`;
            priceDiv.style.pointerEvents = 'none'; // Let wrapper handle clicks
            priceDiv.textContent = formatPrice(property.price);
            container.appendChild(priceDiv);

            wrapper.appendChild(container);
            return wrapper;
        }
    }, [likedProperties]); // Make sure likedProperties is in dependencies

    //______________________________________________________
    // MARKERS: ADD TO MAP
    //place markers and wire up events
    const addMarkersToMap = useCallback(
        (propsToShow) => {
            if (!map.current) return; //map not ready
            clearMarkers(); //remove old markers

            propsToShow.forEach((rawProp) => {
                const property = normalizeProperty(rawProp); //clean data
                const lng = Number(property.longitude);
                const lat = Number(property.latitude);
                if (isNaN(lng) || isNaN(lat)) {
                    console.warn('Skipping property with invalid coords', property);
                    return;
                }

                const markerEl = createMarkerElement(property); //build dom

                //open dialog on click
                markerEl.addEventListener('click', () => {
                    const rect = markerEl.getBoundingClientRect(); //screen box
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    setTriggerPosition({ x: centerX, y: centerY }); //where dialog anim starts
                    setSelectedProperty(property); //store property
                    setIsDialogOpen(true); //open dialog
                });

                //show hover card near mouse
                markerEl.addEventListener('mouseenter', (e) => {
                    setHoveredProperty(property);
                    setHoverPosition({ x: e.clientX, y: e.clientY });
                });
                markerEl.addEventListener('mousemove', (e) => {
                    setHoverPosition({ x: e.clientX, y: e.clientY });
                });
                markerEl.addEventListener('mouseleave', () => {
                    setHoveredProperty(null);
                });

                //create mapbox marker and add to map
                const marker = new mapboxgl.Marker(markerEl).setLngLat([lng, lat]).addTo(map.current);
                markersRef.current.push(marker); //remember marker
            });
        },
        [clearMarkers, createMarkerElement] // Use likedProperties directly instead of isLiked
    );
    //______________________________________________________
    // MAP INIT
    //create the map one time when the component mounts
    useEffect(() => {
        if (!mapContainer.current || !MAPBOX_TOKEN) return; //need container and token

        mapboxgl.accessToken = MAPBOX_TOKEN; //set token
        map.current = new mapboxgl.Map({
            container: mapContainer.current, //dom node
            style: 'mapbox://styles/mapbox/light-v11', //map style
            center: [-4.313, 55.8715], //start center
            zoom: 0, //start zoom
            attributionControl: false, //we hide it with css anyway
            transformRequest: (url) => {
                if (url.includes('v2?access_token')) {
                    console.error('Malformed URL detected:', url); //debug helper
                }
                return { url }; //no changes
            }
        });

        //basic zoom controls in the bottom-right
        map.current.addControl(
            new mapboxgl.NavigationControl({ showCompass: false, showZoom: true }),
            'bottom-right'
        );

        //when style is ready, add markers
        map.current.on('styleload', () => {
            addMarkersToMap(filteredProperties);
        });

        //cleanup when unmounting
        return () => {
            clearMarkers();
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, []); //init once

    //______________________________________________________
    // UPDATE MARKERS ON LIKE CHANGES
    useEffect(() => {
        if (map.current && map.current.isStyleLoaded() && filteredProperties.length > 0) {
            console.log('🚀 FORCING marker update, likedProperties:', likedProperties);

            // Clear and recreate ALL markers immediately
            clearMarkers();

            // Force a tiny delay to ensure DOM cleanup, then recreate
            const timeoutId = setTimeout(() => {
                addMarkersToMap(filteredProperties);
            }, 10); // Very small delay

            return () => clearTimeout(timeoutId);
        }
    }, [addMarkersToMap, clearMarkers, filteredProperties, likedProperties]);

    //______________________________________________________
    // HANDLE RESIZE FOR MOBILE UPDATES
    useEffect(() => {
        const handleResize = () => {
            const isMobile = window.innerWidth < 768;
            console.log(`Screen size changed, mobile: ${isMobile}, markers need update: ${markersRef.current.length > 0}`);

            // Optionally refresh markers on orientation change
            if (map.current && map.current.isStyleLoaded() && filteredProperties.length > 0) {
                setTimeout(() => {
                    addMarkersToMap(filteredProperties);
                }, 100);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [addMarkersToMap, filteredProperties]);

    //______________________________________________________
    // AUTO-ZOOM ON DATA CHANGE
    //fit the map around the markers and last searched area
    useEffect(() => {
        if (!map.current || !map.current.isStyleLoaded()) return;

        const propBounds = getBoundsFromProps(filteredProperties); //bbox from markers

        //merge with last geocoded bbox so both are visible
        let targetBbox = null;
        if (propBounds?.bbox) targetBbox = propBounds.bbox;
        if (lastGeocodeBboxRef.current && targetBbox) {
            targetBbox = mergeBbox(targetBbox, lastGeocodeBboxRef.current);
        }

        try {
            if (targetBbox) {
                map.current.fitBounds(targetBbox, { padding: 50, maxZoom: 16, duration: 3000 }); //smooth zoom to bbox
            } else if (propBounds?.center) {
                map.current.easeTo({ center: propBounds.center, zoom: 16, duration: 3000 }); //zoom to single point
            }
        } catch (e) {
            console.warn('Auto-zoom failed:', e);
        }
    }, [filteredProperties]);

    //______________________________________________________
    // SEARCH HANDLERS
    //submit the search form
    const handleSearch = (e) => {
        e.preventDefault();
        void searchLocation(searchQuery); //run async search
    };

    //______________________________________________________
    // CLEAR SEARCH
    //clear the search and reset map/data
    const clearSearch = () => {
        setSearchQuery(''); //empty input
        getAllProperties()
            .then((all) =>
                setFilteredProperties(Array.isArray(all) ? all.map(normalizeProperty) : [])
            )
            .catch((e) => console.error('Failed to reload all properties', e));

        if (!map.current) return;

        //remove any boundary layers we added
        if (map.current.getLayer('boundary-fill')) {
            map.current.removeLayer('boundary-fill');
            map.current.removeLayer('boundary-line');
            map.current.removeSource('boundary');
        }
        lastGeocodeBboxRef.current = null; //reset remembered bbox

        //fly back to london area default
        map.current.easeTo({ center: [-0.1276, 51.5074], zoom: 12, duration: 1500 });
    };

    //______________________________________________________
    // SEARCH CORE
    //use backend, then mapbox geocoding, then bounds search for best matches
    const searchLocation = async (query) => {
        if (!MAPBOX_TOKEN || !query.trim()) {
            console.log('Search aborted: no token or empty query');
            return;
        }

        console.log('Starting search for:', query);
        setIsSearching(true); //loading state

        //cancel any in-flight search
        if (searchAbortRef.current) {
            searchAbortRef.current.abort();
        }
        const controller = new AbortController();
        searchAbortRef.current = controller;

        try {
            //1) try backend search for rough matches
            let propsInArea = [];
            try {
                console.log('Calling getPropertiesByLocation with:', query);
                propsInArea = await getPropertiesByLocation(query);
                console.log('Backend search results:', propsInArea);
                propsInArea = Array.isArray(propsInArea) ? propsInArea.map(normalizeProperty) : [];
            } catch (backendError) {
                console.warn('Backend search failed, continuing with Mapbox only:', backendError);
                propsInArea = [];
            }

            //2) mapbox geocoding for precise location and bbox
            const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
                query
            )}.json?access_token=${MAPBOX_TOKEN}&country=GB&types=place,district,region,neighborhood,locality,poi,postcode,address&limit=5`;

            console.log('Mapbox API URL:', mapboxUrl);

            const response = await fetch(mapboxUrl, { signal: controller.signal });
            if (!response.ok) throw new Error(`Mapbox API error: ${response.status}`);

            const data = await response.json();
            console.log('Mapbox response:', data);

            if (data.features && data.features.length > 0) {
                const feature = data.features[0]; //take best match
                const [lng, lat] = feature.center;
                const bbox = feature.bbox; //may be undefined
                console.log('Found location:', { lng, lat, bbox });

                //remember bbox for later auto-zoom merges
                lastGeocodeBboxRef.current = bbox || null;

                //clean up old polygon boundary layers if any
                try {
                    if (map.current.getLayer('boundary-fill')) {
                        map.current.removeLayer('boundary-fill');
                        map.current.removeLayer('boundary-line');
                        map.current.removeSource('boundary');
                    }
                } catch (e) {
                    console.warn('Error cleaning up boundary layers:', e);
                }

                //add a light polygon outline if the feature is a polygon
                if (feature.geometry?.type === 'Polygon') {
                    try {
                        map.current.addSource('boundary', { type: 'geojson', data: feature });
                        map.current.addLayer({
                            id: 'boundary-fill',
                            type: 'fill',
                            source: 'boundary',
                            paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.1 },
                        });
                        map.current.addLayer({
                            id: 'boundary-line',
                            type: 'line',
                            source: 'boundary',
                            paint: { 'line-color': '#3b82f6', 'line-width': 2, 'line-dasharray': [2, 2] },
                        });
                    } catch (e) {
                        console.warn('Error adding boundary layers:', e);
                    }
                }

                //3) if we have a bbox, ask backend for properties inside it
                if (bbox) {
                    const [minLng, minLat, maxLng, maxLat] = bbox;
                    console.log('Searching in bounds:', { minLng, minLat, maxLng, maxLat });
                    try {
                        let boundedProps = await getPropertiesInBounds({ minLng, minLat, maxLng, maxLat });
                        console.log('Bounded properties:', boundedProps);
                        if (Array.isArray(boundedProps) && boundedProps.length > 0) {
                            propsInArea = boundedProps.map(normalizeProperty);
                        }
                    } catch (boundsError) {
                        console.warn('Bounds search failed, using location search results:', boundsError);
                    }
                }

                console.log('Final properties to show:', propsInArea.length);
                setFilteredProperties(propsInArea); //update ui list

                //smart camera move: merge bbox with marker bbox if needed
                const propBounds = getBoundsFromProps(propsInArea);
                let targetBbox = bbox ? [...bbox] : null;
                if (propBounds?.bbox) targetBbox = mergeBbox(targetBbox, propBounds.bbox);

                try {
                    if (targetBbox) {
                        map.current.fitBounds(targetBbox, { padding: 50, maxZoom: 16, duration: 1500 });
                    } else if (propBounds?.center) {
                        map.current.easeTo({ center: propBounds.center, zoom: 16, duration: 1500 });
                    } else if (bbox) {
                        map.current.fitBounds(bbox, { padding: 50, maxZoom: 16, duration: 1500 });
                    } else {
                        map.current.easeTo({ center: [lng, lat], zoom: 13, duration: 1500 });
                    }
                } catch (e) {
                    console.warn('Map movement failed, continuing:', e);
                }
            } else {
                //no geocode result: fall back to backend-only results
                console.log('No Mapbox results, using backend results only');
                lastGeocodeBboxRef.current = null; //clear
                setFilteredProperties(propsInArea);

                if (propsInArea.length > 0) {
                    const propBounds = getBoundsFromProps(propsInArea);
                    try {
                        if (propBounds?.bbox) {
                            map.current.fitBounds(propBounds.bbox, { padding: 50, maxZoom: 16, duration: 1500 });
                        } else if (propBounds?.center) {
                            map.current.easeTo({ center: propBounds.center, zoom: 16, duration: 1500 });
                        } else {
                            console.log('Showing backend results without map movement');
                        }
                    } catch (e) {
                        console.warn('Map movement failed (backend-only), continuing:', e);
                    }
                } else {
                    alert('No properties found for that search');
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Search error:', err);
                alert(`Search failed: ${err.message}`);
            }
        } finally {
            setIsSearching(false); //done loading
        }
    };

    //______________________________________________________
    // DIALOG CLOSE HANDLER
    //reset dialog state when user closes it
    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setSelectedProperty(null);
        setTriggerPosition(null);
    };


//______________________________________________________
// JSX
    return (
        <div className="relative w-full h-screen bg-white flex">
            {/*______________________________________________________*/}
            {/* SEARCH HEADER - ALWAYS VISIBLE */}
            <div className={`absolute top-0 z-10 bg-transparent transition-all duration-300 ${isMobile ? 'left-0 right-0' : (viewMode === 'list' ? 'left-0 right-1/3' : 'left-0 right-0')}`}>
                <div className={`mx-auto px-4 py-3 ${isMobile ? 'max-w-none' : 'max-w-3xl px-6 py-4'}`}>
                    <form onSubmit={handleSearch} className={`flex gap-2 ${isMobile ? 'flex-wrap' : 'gap-3'}`}>
                        {/* SEARCH INPUT ROW */}
                        <div className={`flex gap-2 ${isMobile ? 'w-full mb-2' : 'flex-1 gap-3'}`}>
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <Input
                                    type="text"
                                    placeholder={isMobile ? "Search location..." : "Search location (e.g., London, Glasgow, G11)…"}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 border-slate-300 focus:border-slate-900"
                                />
                                {searchQuery && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearSearch}
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 h-6 w-6"
                                        aria-label="Clear search"
                                    >
                                        <X className="w-3 h-3" />
                                    </Button>
                                )}
                            </div>
                            <Button
                                type="submit"
                                className={`bg-slate-900 hover:bg-slate-800 text-white ${isMobile ? 'px-4' : 'px-6'}`}
                                disabled={isSearching}
                            >
                                {isSearching ? 'Searching…' : 'Search'}
                            </Button>
                        </div>

                        {/* CONTROLS ROW - ALWAYS VISIBLE */}
                        <div className={`flex gap-2 ${isMobile ? 'w-full justify-between' : ''}`}>
                            {/* VIEW MODE TOGGLE - ALWAYS VISIBLE */}
                            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setViewMode('map')}
                                    className={`px-3 py-2 rounded-none ${viewMode === 'map' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <Map className="w-4 h-4" />
                                    {!isMobile && <span className="ml-1">Map</span>}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setViewMode('list')}
                                    className={`px-3 py-2 rounded-none border-l border-slate-200 ${viewMode === 'list' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <List className="w-4 h-4" />
                                    {!isMobile && <span className="ml-1">List</span>}
                                </Button>
                            </div>

                            {/* FILTER TOGGLE */}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowFilters(!showFilters)}
                                className={`${isMobile ? 'px-3' : 'px-4'} ${showFilters ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                            >
                                Filters {showFilters ? '↑' : '↓'}
                            </Button>
                        </div>
                    </form>

                    {/* PROPERTY FILTERS */}
                    {showFilters && (
                        <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
                            <PropertyFilters currentFilters={filters} onFiltersChange={handleFiltersChange} />
                        </div>
                    )}
                </div>
            </div>

            {/*______________________________________________________*/}
            {/* MOBILE LAYOUT: SPLIT SCREEN WITH OVERLAY */}
            {isMobile ? (
                <>
                    {/* MAP CONTAINER - ALWAYS RENDERED */}
                    <div className="relative w-full h-full">
                        <div ref={mapContainer} className="absolute inset-0 pt-24" />
                    </div>

                    {/* LIST OVERLAY - SLIDES UP FROM BOTTOM */}
                    {viewMode === 'list' && (
                        <>
                            {/* CLICKABLE BACKDROP - TAP TO GO BACK TO MAP */}
                            <div
                                className="absolute inset-0 bg-black/20 z-20 pt-24 cursor-pointer touch-manipulation"
                                onClick={() => setViewMode('map')}
                                aria-label="Tap to return to map view"
                            />

                            {/* List panel */}
                            <div
                                className="absolute inset-x-0 top-24 bottom-0 bg-gray-50 z-30 animate-in slide-in-from-bottom-2 duration-300"
                                onClick={(e) => e.stopPropagation()} // Prevent clicks from bubbling to backdrop
                            >
                                <PropertyListView
                                    properties={filteredProperties}
                                    onPropertyClick={handlePropertyClick}
                                />
                            </div>
                        </>
                    )}
                </>
            ) : (
                /* DESKTOP LAYOUT: SIDE BY SIDE */
                <>
                    {/* MAP SECTION */}
                    <div className={`relative transition-all duration-300 ${viewMode === 'list' ? 'w-2/3' : 'w-full'}`}>
                        {/* MAP CONTAINER */}
                        <div ref={mapContainer} className="absolute inset-0 pt-20" />

                        {/* HOVER CARD */}
                        {hoveredProperty && !showSidebar && viewMode === 'map' && (
                            <div
                                className="fixed z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full transition-all duration-1000"
                                style={{
                                    left: `${hoverPosition.x}px`,
                                    top: `${hoverPosition.y - 10}px`,
                                    width: '380px',
                                    maxWidth: '90vw',
                                }}
                                aria-live="polite"
                            >
                                <PropertyPreviewCard property={hoveredProperty} imageIndex={4} className="relative" />
                                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                                    <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* DESKTOP LIST VIEW SIDEBAR */}
                    {viewMode === 'list' && (
                        <div className="w-1/3 h-full border-l border-slate-200 bg-gray-50 animate-in slide-in-from-right-2 duration-300">
                            <PropertyListView
                                properties={filteredProperties}
                                onPropertyClick={handlePropertyClick}
                            />
                        </div>
                    )}
                </>
            )}

            {/* PROPERTY DIALOG */}
            <PropertyInfo
                property={selectedProperty}
                isOpen={isDialogOpen}
                onClose={handleCloseDialog}
                triggerPosition={triggerPosition}
            />
        </div>
    );

};
export default MapView;
