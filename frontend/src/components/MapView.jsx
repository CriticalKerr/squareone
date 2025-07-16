import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const propertyData = [
    { id: '1', title: '2 bed flat', lng: -0.1276, lat: 51.5074 },
    { id: '2', title: '3 bed house', lng: -0.12,   lat: 51.51   },
    { id: '3', title: '1 bed studio', lng: -0.13,   lat: 51.5    },
];

export default function MapView() {
    const mapContainer = useRef(null);
    const mapRef       = useRef(null);
    const [selected, setSelected] = useState(null);

    // Initialize map once
    useEffect(() => {
        if (!mapContainer.current) return;
        mapboxgl.accessToken = MAPBOX_TOKEN;
        mapRef.current = new mapboxgl.Map({
            container: mapContainer.current,
            style:     'mapbox://styles/mapbox/light-v11',
            center:    [-0.1276, 51.5074],
            zoom:      12,
        });

        return () => mapRef.current.remove();
    }, []);

    // Add markers once map is ready
    useEffect(() => {
        if (!mapRef.current) return;
        propertyData.forEach((p) => {
            new mapboxgl.Marker()
                .setLngLat([p.lng, p.lat])
                .setPopup(new mapboxgl.Popup().setText(p.title))
                .addTo(mapRef.current)
                .getElement()
                .addEventListener('click', () => setSelected(p));
        });
    }, []);

    return (
        <div className="flex h-screen">
            {/* Sidebar */}
            {selected && (
                <aside className="w-64 p-4 bg-white border-r">
                    <h2 className="text-xl font-bold">{selected.title}</h2>
                    <Button onClick={() => setSelected(null)}>Close</Button>
                </aside>
            )}

            {/* Map */}
            <div ref={mapContainer} className="flex-1" />
        </div>
    );
}
