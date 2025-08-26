// PropertyListView.jsx
import React from 'react';
import PropertyPreviewCard from './PropertyPreviewCard';
import { useIsMobile } from '../hooks/useIsMobile';

const PropertyListView = ({ properties, onPropertyClick }) => {
    const isMobile = useIsMobile();

    if (!properties || properties.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                <p>No properties to display</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-gray-50 overflow-y-auto">
            <div className={`p-2 grid gap-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {properties.map((property) => (
                    <div
                        key={property.id || property.listing_id}
                        className="cursor-pointer transform transition-transform hover:scale-[1.02] touch-manipulation"
                        onClick={() => onPropertyClick(property)}
                    >
                        <PropertyPreviewCard
                            property={property}
                            imageIndex={4}
                            className="shadow-sm hover:shadow-md transition-shadow"
                        />
                    </div>
                ))}
            </div>
            <div className="p-4 text-center text-sm text-gray-500">
                {properties.length} properties found
            </div>
        </div>
    );
};

export default PropertyListView;