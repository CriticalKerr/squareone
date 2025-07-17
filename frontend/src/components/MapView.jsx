import React, { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Search, List } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

export default function MapView() {
    const mapContainer = useRef(null)
    const map = useRef(null)
    const markersRef = useRef([])
    const [searchQuery, setSearchQuery] = useState('')
    const [filteredProperties, setFilteredProperties] = useState([])
    const [showSidebar, setShowSidebar] = useState(false)
    const [isSearching, setIsSearching] = useState(false)
    const [popupInfo, setPopupInfo] = useState(null)
    const properties = [
        {
            id: '1',
            price: '£450,000',
            address: 'Westminster, London',
            longitude: -0.1276,
            latitude: 51.5074,
            bedrooms: 2,
            bathrooms: 1,
            sqft: 850,
            valueIncrease: 12,
            image: 'https://images.unsplash.com/photo-1721322800607-8c38375eef04?w=400&h=300'
        },
    ]

    useEffect(() => {
        setFilteredProperties(properties)
    }, [])

    const clearMarkers = useCallback(() => {
        markersRef.current.forEach(m => m.remove())
        markersRef.current = []
    }, [])

    const addMarkersToMap = useCallback(
        propsToShow => {
            if (!map.current) return
            clearMarkers()

            propsToShow.forEach(p => {
                const lng = Number(p.longitude)
                const lat = Number(p.latitude)
                if (isNaN(lng) || isNaN(lat)) return

                const el = document.createElement('div')
                el.className = 'property-marker'
                el.innerHTML = `
          <div class="bg-black text-white text-xs p-1 rounded">${p.price}</div>
        `
                el.addEventListener('click', () => setPopupInfo(p))

                const marker = new mapboxgl.Marker(el)
                    .setLngLat([lng, lat])
                    .addTo(map.current)
                markersRef.current.push(marker)
            })
        },
        [clearMarkers]
    )

    useEffect(() => {
        if (!mapContainer.current || !MAPBOX_TOKEN) return
        mapboxgl.accessToken = MAPBOX_TOKEN
        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/light-v11',
            center: [-0.1276, 51.5074],
            zoom: 12
        })
        map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right')
        map.current.on('load', () => addMarkersToMap(filteredProperties))
        return () => map.current.remove()
    }, [addMarkersToMap, filteredProperties])

    useEffect(() => {
        if (map.current && map.current.isStyleLoaded()) {
            addMarkersToMap(filteredProperties)
        }
    }, [filteredProperties, addMarkersToMap])

    const handleSearch = e => {
        e.preventDefault()
        setIsSearching(true)
        const q = searchQuery.trim().toLowerCase()
        setFilteredProperties(
            q
                ? properties.filter(p => p.address.toLowerCase().includes(q))
                : properties
        )
        setIsSearching(false)
    }

    return (
        <div className="relative h-screen w-screen">
            {/* Sidebar toggle */}
            <button
                onClick={() => setShowSidebar(f => !f)}
                className="absolute top-4 left-4 z-20 bg-white p-2 rounded shadow"
            >
                <List className="w-5 h-5" />
            </button>

            {/* Sidebar */}
            {showSidebar && (
                <aside className="absolute top-0 left-0 h-full w-64 bg-white shadow-lg z-20 p-4 overflow-y-auto">
                    <h2 className="text-xl mb-2">Properties</h2>
                    {filteredProperties.map(p => (
                        <div key={p.id} className="mb-4 border-b pb-2">
                            <div className="font-bold">{p.price}</div>
                            <div className="text-sm">{p.address}</div>
                        </div>
                    ))}
                </aside>
            )}

            {/* Search bar */}
            <form
                onSubmit={handleSearch}
                className="absolute top-4 right-4 z-20 flex items-center bg-white bg-opacity-80 p-2 rounded shadow"
            >
                <Search className="w-4 h-4 mr-2 text-gray-600" />
                <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Filter by address…"
                    className="border-none focus:ring-0"
                />
                {searchQuery && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setSearchQuery('')
                            setFilteredProperties(properties)
                        }}
                    >
                        ✕
                    </Button>
                )}
                <Button type="submit" disabled={isSearching} size="sm" className="ml-2">
                    Go
                </Button>
            </form>

            {/* Map container */}
            <div ref={mapContainer} className="absolute inset-0" />

            {/* Simple pop-up */}
            {popupInfo && (
                <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-white p-4 rounded shadow-lg z-20">
                    <h3 className="font-bold">{popupInfo.price}</h3>
                    <p className="text-sm">{popupInfo.address}</p>
                    <Button size="sm" onClick={() => setPopupInfo(null)}>
                        Close
                    </Button>
                </div>
            )}
        </div>
    )
}
