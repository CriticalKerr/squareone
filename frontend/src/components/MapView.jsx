import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import '../index.css';
import {Search, Bed, Bath, Square, Wrench, Sparkles, TrendingUp, X,} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PropertyInfo from './PropertyInfo.jsx';
import PropertyFilters from './PropertyFilters';
import {getAllProperties, getPropertiesByLocation, getPropertiesInBounds,} from '../services/propertyServices.js';

//──────────────────────── CONSTANTS ────────────────────────
// Mapbox access token from environment
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

//──────────────────────── HELPERS ────────────────────────
// Turn raw property data into consistent object fields
const normalizeProperty = (raw) => {

    // Pull out or default common fields
    const property_type = raw.property_type || raw.type || '';
    const address = raw.address || '';
    const price = raw.price;
    const bedrooms_count = raw.bedrooms_count ?? raw.bedrooms ?? null;
    const bathrooms_count = raw.bathrooms_count ?? raw.bathrooms ?? null;

    // Figure out area in sqm or sqft, convert if needed
    let total_area_sqm = raw.total_area_sqm ?? null;
    let sqft = raw.sqft ?? null;

    // Try to get total area from floorplan analysis
    if (!total_area_sqm && raw.floorplan_analysis) {
        try {
            const floorplanArray = Array.isArray(raw.floorplan_analysis)
                ? raw.floorplan_analysis
                : JSON.parse(raw.floorplan_analysis || '[]');

            // Get the first floorplan analysis and extract total area
            if (floorplanArray.length > 0 && floorplanArray[0].analysis) {
                total_area_sqm = floorplanArray[0].analysis.total_area_sqm || null;
            }
        } catch (e) {
            console.warn('Failed to parse floorplan_analysis:', e);
        }
    }

    // Convert between sqm and sqft if one is missing
    if (total_area_sqm == null && sqft != null) {
        total_area_sqm = Number((sqft * 0.092903).toFixed(1));
    }
    if (sqft == null && total_area_sqm != null) {
        sqft = Number((total_area_sqm / 0.092903).toFixed(1));
    }

    const image_urls = Array.isArray(raw.image_urls)
        ? raw.image_urls
        : raw.image_urls
            ? [raw.image_urls]
            : [];
    const floorplan_urls = raw.floorplan_urls;

    const longitude = raw.longitude;
    const latitude = raw.latitude;
    const description = raw.description || '';
    const valueIncrease = raw.valueIncrease ?? raw.value_increase;

    // Conditions fallback from condition_analysis if not present
    let kitchenCondition = raw.kitchenCondition;
    let bathroomCondition = raw.bathroomCondition;
    if ((!kitchenCondition || !bathroomCondition) && raw.condition_analysis) {
        try {
            const condArray = Array.isArray(raw.condition_analysis)
                ? raw.condition_analysis
                : JSON.parse(raw.condition_analysis || '[]');
            const kitchen = condArray.find((r) => r.room_type === 'kitchen');
            const bathroom = condArray.find((r) => r.room_type === 'bathroom');
            if (!kitchenCondition && kitchen) kitchenCondition = kitchen.state;
            if (!bathroomCondition && bathroom) bathroomCondition = bathroom.state;
        } catch {
            // ignore parse errors
        }
    }

    return {...raw, property_type, address, price, bedrooms_count, bathrooms_count, total_area_sqm,
        sqft, image_urls, floorplan_urls, longitude, latitude, description, valueIncrease, kitchenCondition,
        bathroomCondition, condition_analysis: raw.condition_analysis,
    };
};

// Turn number into £X,XXX or blank
const formatPrice = (p) => {
    if (p == null) return '';
    const num = typeof p === 'number' ? p : Number(p.toString().replace(/[^\d.-]/g, ''));
    if (isNaN(num)) return p;
    return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        maximumFractionDigits: 0,
    }).format(num);
};

//──────────────────────── COMPONENT ────────────────────────
const MapView = () => {

    //______________________________________________________
    // REFS FOR MAP AND MARKERS
    const mapContainer = useRef(null);
    const map = useRef(null);
    const markersRef = useRef([]);
    const searchAbortRef = useRef(null);

    //______________________________________________________
    // STATE FOR SEARCH, FILTER, AND DIALOG
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [hoveredProperty, setHoveredProperty] = useState(null);
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
    const [showSidebar] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [filteredProperties, setFilteredProperties] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [triggerPosition, setTriggerPosition] = useState(null);
    const [filters, setFilters] = useState({kitchenCondition: 'all', bathroomCondition: 'all'});

    //______________________________________________________
    // FILTER LOGIC
    const filterProperties = useCallback((properties, activeFilters) => {
        return properties.filter(property => {
            // Parse condition analysis
            const conditionAnalysis = Array.isArray(property.condition_analysis)
                ? property.condition_analysis
                : JSON.parse(property.condition_analysis || '[]');

            const bathroom = conditionAnalysis.find(r => r.room_type === 'bathroom');
            const kitchen = conditionAnalysis.find(r => r.room_type === 'kitchen');
            const bathroomState = bathroom?.state || property.bathroomCondition || 'unknown';
            const kitchenState = kitchen?.state || property.kitchenCondition || 'unknown';

            // Apply kitchen filter
            if (activeFilters.kitchenCondition && activeFilters.kitchenCondition !== 'all') {
                if (activeFilters.kitchenCondition !== kitchenState) {
                    return false;
                }
            }

            // Apply bathroom filter
            if (activeFilters.bathroomCondition && activeFilters.bathroomCondition !== 'all') {
                if (activeFilters.bathroomCondition !== bathroomState) {
                    return false;
                }
            }

            return true;
        });
    }, []);

    //______________________________________________________
    // APPLY FILTERS TO CURRENT PROPERTIES
    const handleFiltersChange = useCallback((newFilters) => {
        setFilters(newFilters);

        // Apply filters to current properties and update the map
        getAllProperties()
            .then((all) => {
                const normalizedProperties = Array.isArray(all) ? all.map(normalizeProperty) : [];
                const filtered = filterProperties(normalizedProperties, newFilters);
                setFilteredProperties(filtered);
            })
            .catch((e) => console.error('Failed to reload and filter properties', e));
    }, [filterProperties]);

    // Load initial properties
    useEffect(() => {
        (async () => {
            try {
                const all = await getAllProperties();
                setFilteredProperties(
                    Array.isArray(all) ? all.map(normalizeProperty) : []
                );
            } catch (e) {
                console.error('Failed to load properties', e);
            }
        })();
    }, []);

    //______________________________________________________
    // MARKER MANAGEMENT
    const clearMarkers = useCallback(() => {
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
    }, []);

    // Create marker DOM safely
    const createMarkerElement = (property) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'property-marker';

        const container = document.createElement('div');
        container.className = 'relative';

        const priceDiv = document.createElement('div');
        priceDiv.className = 'bg-slate-900 text-white px-2 py-1 rounded text-xs font-medium cursor-pointer hover:bg-slate-800 transition-colors shadow-lg';
        priceDiv.textContent = formatPrice(property.price);
        container.appendChild(priceDiv);

        if (property.valueIncrease) {
            const badge = document.createElement('div');
            badge.className = 'absolute -top-2 -right-1 bg-green-500 text-white text-xs px-1 py-0.5 rounded-full font-bold flex items-center gap-0.5';
            const arrow = document.createElement('span');
            arrow.textContent = '↗';
            const percent = document.createElement('span');
            percent.textContent = `${property.valueIncrease}%`;
            badge.appendChild(arrow);
            badge.appendChild(percent);
            container.appendChild(badge);
        }

        wrapper.appendChild(container);
        return wrapper;
    };

    // Add markers (expects normalized properties)
    const addMarkersToMap = useCallback(
        (propsToShow) => {
            if (!map.current) return;
            clearMarkers();

            propsToShow.forEach((rawProp) => {
                const property = normalizeProperty(rawProp); // extra safety if not normalized upstream
                const lng = Number(property.longitude);
                const lat = Number(property.latitude);
                if (isNaN(lng) || isNaN(lat)) {
                    console.warn('Skipping property with invalid coords', property);
                    return;
                }

                const markerEl = createMarkerElement(property);

                markerEl.addEventListener('click', () => {
                    const rect = markerEl.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    setTriggerPosition({ x: centerX, y: centerY });
                    setSelectedProperty(property);
                    setIsDialogOpen(true);
                });

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

                const marker = new mapboxgl.Marker(markerEl).setLngLat([lng, lat]).addTo(map.current);
                markersRef.current.push(marker);
            });
        },
        [clearMarkers]
    );

    //______________________________________________________
    // INITIALISE MAP
    // Initialize map once
    useEffect(() => {
        if (!mapContainer.current || !MAPBOX_TOKEN) return;

        mapboxgl.accessToken = MAPBOX_TOKEN;
        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/light-v11',
            center: [-4.313, 55.8715],
            zoom: 15,
            attributionControl: false,
            // Add these options to reduce redundant requests
            transformRequest: (url) => {
                // Log any problematic URLs
                if (url.includes('v2?access_token')) {console.error('Malformed URL detected:', url);}
                return { url };
            }
        });

        map.current.addControl(
            new mapboxgl.NavigationControl({ showCompass: false, showZoom: true }),
            'bottom-right'
        );

        // Only add markers once the style has loaded
        map.current.on('styleload', () => {
            addMarkersToMap(filteredProperties);
        });

        // Cleanup
        return () => {
            clearMarkers();
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, []); // Remove dependencies to prevent recreation

    //______________________________________________________
    // UPDATE MARKERS WHEN DATA CHANGES
    // Separate useEffect for updating markers when properties change
    useEffect(() => {
        if (map.current && map.current.isStyleLoaded()) {
            addMarkersToMap(filteredProperties);
        }
    }, [filteredProperties, addMarkersToMap]);

    //______________________________________________________
    // SEARCH HANDLERS
    const handleSearch = (e) => {
        e.preventDefault();
        void searchLocation(searchQuery);
    };

    const clearSearch = () => {
        setSearchQuery('');
        getAllProperties()
            .then((all) =>
                setFilteredProperties(Array.isArray(all) ? all.map(normalizeProperty) : [])
            )
            .catch((e) => console.error('Failed to reload all properties', e));
        if (!map.current) return;
        if (map.current.getLayer('boundary-fill')) {
            map.current.removeLayer('boundary-fill');
            map.current.removeLayer('boundary-line');
            map.current.removeSource('boundary');
        }
        map.current.easeTo({ center: [-0.1276, 51.5074], zoom: 12, duration: 1000 });
    };

    const searchLocation = async (query) => {
        if (!MAPBOX_TOKEN || !query.trim()) {
            console.log('Search aborted: no token or empty query');
            return;
        }

        console.log('Starting search for:', query);
        setIsSearching(true);

        // Abort previous if running
        if (searchAbortRef.current) {
            searchAbortRef.current.abort();
        }
        const controller = new AbortController();
        searchAbortRef.current = controller;

        try {
            // Step 1: Try backend search first (don't let it fail the whole search)
            let propsInArea = [];
            try {
                console.log('Calling getPropertiesByLocation with:', query);
                propsInArea = await getPropertiesByLocation(query);
                console.log('Backend search results:', propsInArea);

                if (Array.isArray(propsInArea)) {
                    propsInArea = propsInArea.map(normalizeProperty);
                } else {
                    console.warn('Backend search returned non-array:', propsInArea);
                    propsInArea = [];
                }
            } catch (backendError) {
                console.warn('Backend search failed, continuing with Mapbox only:', backendError);
                propsInArea = [];
            }

            // Step 2: Mapbox geocoding
            const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            query
        )}.json?access_token=${MAPBOX_TOKEN}&country=GB&types=place,district,region,neighborhood,locality,poi&limit=5`;

        console.log('Mapbox API URL:', mapboxUrl);

        const response = await fetch(mapboxUrl, { signal: controller.signal });

        if (!response.ok) {
            throw new Error(`Mapbox API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Mapbox response:', data);

        if (data.features && data.features.length > 0) {
            const feature = data.features[0];
            const [lng, lat] = feature.center;
            const bbox = feature.bbox;

            console.log('Found location:', { lng, lat, bbox });

            // Clean up existing boundary layers
            try {
                if (map.current.getLayer('boundary-fill')) {
                    map.current.removeLayer('boundary-fill');
                    map.current.removeLayer('boundary-line');
                    map.current.removeSource('boundary');
                }
            } catch (e) {
                console.warn('Error cleaning up boundary layers:', e);
            }

            // Add boundary visualization if polygon
            if (feature.geometry?.type === 'Polygon') {
                try {
                    map.current.addSource('boundary', {
                        type: 'geojson',
                        data: feature,
                    });
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
                        paint: {
                            'line-color': '#3b82f6',
                            'line-width': 2,
                            'line-dasharray': [2, 2],
                        },
                    });
                } catch (e) {
                    console.warn('Error adding boundary layers:', e);
                }
            }

            // Step 3: Try to get properties in bounding box (don't fail if endpoint doesn't exist)
            if (bbox) {
                const [minLng, minLat, maxLng, maxLat] = bbox;
                console.log('Searching in bounds:', { minLng, minLat, maxLng, maxLat });

                try {
                    let boundedProps = await getPropertiesInBounds({
                        minLng,
                        minLat,
                        maxLng,
                        maxLat,
                    });

                    console.log('Bounded properties:', boundedProps);

                    if (Array.isArray(boundedProps) && boundedProps.length > 0) {
                        boundedProps = boundedProps.map(normalizeProperty);
                        propsInArea = boundedProps;
                    }
                } catch (boundsError) {
                    console.warn('Bounds search failed, using location search results:', boundsError);
                }
            }

            console.log('Final properties to show:', propsInArea.length);
            setFilteredProperties(propsInArea);

            // Move map to location
            if (bbox) {
                map.current.fitBounds(bbox, { padding: 50 });
            } else {
                map.current.easeTo({ center: [lng, lat], zoom: 12, duration: 1000 });
            }
        } else {
            console.log('No Mapbox results, using backend results only');
            setFilteredProperties(propsInArea);

            // If we have no geocoding results but have properties, show them anyway
            if (propsInArea.length > 0) {
                // You could calculate bounds from your properties here if needed
                console.log('Showing backend results without map movement');
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
        setIsSearching(false);
    }
};

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setSelectedProperty(null);
        setTriggerPosition(null);
    };

    return (
        <div className="relative w-full h-screen bg-white flex">
            {/* Map Section */}
            <div className="flex-1 relative">
                {/* Search Header */}
                <div className="absolute top-0 left-0 right-0 z-10 bg-transparent">
                    <div className="max-w-3xl mx-auto px-6 py-4">
                        <form onSubmit={handleSearch} className="flex gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <Input
                                    type="text"
                                    placeholder="Search location (e.g., London, Glasgow, G11)…"
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
                                className="bg-slate-900 hover:bg-slate-800 text-white px-6"
                                disabled={isSearching}
                            >
                                {isSearching ? 'Searching…' : 'Search'}
                            </Button>
                        </form>

                        {/* Property Filters */}
                        <PropertyFilters filters={filters} onFiltersChange={handleFiltersChange} />
                    </div>
                </div>

                {/* Map Container */}
                <div ref={mapContainer} className="absolute inset-0 pt-20" />

                {/* Hover Card for non-sidebar properties */}
                {hoveredProperty && !showSidebar && (
                    <div
                        className="fixed z-30 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden pointer-events-none transform -translate-x-1/2 -translate-y-full transition-all duration-200"
                        style={{
                            left: `${hoverPosition.x}px`,
                            top: `${hoverPosition.y + 10}px`,
                            width: '380px',
                            maxWidth: '90vw',
                        }}
                        aria-live="polite"
                    >
                        {/* Image + Price + ValueIncrease */}
                        <div className="relative h-48 overflow-hidden">
                            {hoveredProperty.image_urls?.[0] ? (
                                <img
                                    src={hoveredProperty.image_urls[0]}
                                    alt={hoveredProperty.property_type}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
                                    No image
                                </div>
                            )}
                            <div className="absolute top-3 left-3 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-bold">
                                {formatPrice(hoveredProperty.price)}
                            </div>
                            {hoveredProperty.valueIncrease && (
                                <div className="absolute top-3 right-3 bg-green-500 text-white px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" />
                                    <span>+{hoveredProperty.valueIncrease}%</span>
                                </div>
                            )}
                        </div>

                        {/* Textual details */}
                        <div className="p-4">
                            <h3 className="font-bold text-slate-900 text-lg mb-1">
                                {hoveredProperty.property_type}
                            </h3>
                            <p className="text-slate-600 text-sm mb-2">
                                {hoveredProperty.address}
                            </p>
                            <p className="text-slate-700 text-sm mb-3 leading-relaxed">
                                {hoveredProperty.description}
                            </p>

                            <div className="flex items-center gap-4 text-slate-600 text-sm mb-3">
                                <div className="flex items-center gap-1">
                                    <Bed className="w-4 h-4" />
                                    <span>{hoveredProperty.bedrooms_count}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Bath className="w-4 h-4" />
                                    <span>{hoveredProperty.bathrooms_count}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Square className="w-4 h-4" />
                                    <span>{hoveredProperty.sqft} sqft</span>
                                </div>
                            </div>

                            <div className="flex gap-2 mb-3">
                                <Badge
                                    variant={
                                        hoveredProperty.kitchenCondition === 'new'
                                            ? 'default'
                                            : 'secondary'
                                    }
                                    className="flex items-center gap-1 text-xs"
                                >
                                    {hoveredProperty.kitchenCondition === 'new' ? (
                                        <Sparkles className="w-3 h-3" />
                                    ) : (
                                        <Wrench className="w-3 h-3" />
                                    )}
                                    Kitchen: {hoveredProperty.kitchenCondition}
                                </Badge>
                                <Badge
                                    variant={
                                        hoveredProperty.bathroomCondition === 'new'
                                            ? 'default'
                                            : 'secondary'
                                    }
                                    className="flex items-center gap-1 text-xs"
                                >
                                    {hoveredProperty.bathroomCondition === 'new' ? (
                                        <Sparkles className="w-3 h-3" />
                                    ) : (
                                        <Wrench className="w-3 h-3" />
                                    )}
                                    Bathroom: {hoveredProperty.bathroomCondition}
                                </Badge>
                            </div>
                        </div>

                        {/* Little arrow pointer */}
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Property Dialog / Info */}
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