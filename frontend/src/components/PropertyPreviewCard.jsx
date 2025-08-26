//______________________________________________________
// IMPORTS
// Bring in React, some helpful icons, and the Badge UI pill
import React from 'react';
import { Bed, Bath, Square, Sparkles, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

//______________________________________________________
// FORMAT PRICE (GBP)
// Turn a value into a pound price string like "£350,000"
const formatPrice = (price) => {
    if (!price) return ''; // show nothing if there is no price

    // If price is a number, keep it. If it is text, remove symbols and commas.
    const numPrice =
        typeof price === 'number'
            ? price
            : Number(price.toString().replace(/[^\d.-]/g, ''));

    if (isNaN(numPrice)) return price; // if still not a number, return what we got

    // Make a UK pound price with no pennies
    return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        maximumFractionDigits: 0,
    }).format(numPrice);
};

//______________________________________________________
// PARSE CONDITION ANALYSIS
// Read kitchen and bathroom condition from the property object
const parseConditionAnalysis = (property) => {
    try {
        // condition_analysis can be an array or a JSON string. Handle both.
        const conditionAnalysis = Array.isArray(property.condition_analysis)
            ? property.condition_analysis
            : JSON.parse(property.condition_analysis || '[]');

        // Find the bathroom and kitchen entries inside the list
        const bathroom = conditionAnalysis.find((room) => room.room_type === 'bathroom');
        const kitchen = conditionAnalysis.find((room) => room.room_type === 'kitchen');

        // Pick the state from the entry. If missing, try the older fields. If still missing, say unknown.
        return {
            bathroomState: bathroom?.state || property.bathroomCondition || 'unknown',
            kitchenState: kitchen?.state || property.kitchenCondition || 'unknown',
        };
    } catch {
        // If reading or parsing fails, use the older fields or say unknown
        return {
            bathroomState: property.bathroomCondition || 'unknown',
            kitchenState: property.kitchenCondition || 'unknown',
        };
    }
};

//______________________________________________________
// CHECK ROOM RENOVATION
// Say if a room is new or renovated
const isRoomRenovated = (state) => state === 'new' || state === 'new/renovated';

//______________________________________________________
// ROOM BADGE COMPONENT
// Show a small pill with the room name and its condition
const RoomBadge = ({ roomType, condition }) => (
    <Badge
        // Use a bolder style for good condition, a softer style for needs work
        variant={isRoomRenovated(condition) ? 'default' : 'secondary'}
        className="flex items-center gap-1 text-xs"
    >
        {/* Sparkles means fresh and shiny. Wrench means needs fixing. */}
        {isRoomRenovated(condition) ? (
            <Sparkles className="w-5 h-5" />
        ) : (
            <Wrench className="w-5 h-5" />
        )}
        {roomType}: {condition}
    </Badge>
);

//______________________________________________________
// PROPERTY PREVIEW CARD
// Show a picture, the price, the main details, quick features, and room states
const PropertyPreviewCard = ({
                                 property,               // the property data
                                 className = '',         // extra classes so the parent can style the card
                                 showDescription = true, // show or hide the short description
                                 imageIndex = 0,         // which image to show from the list
                                 children,               // a place for extra content from the parent
                             }) => {
    // Get the bathroom and kitchen states in a safe way
    const { bathroomState, kitchenState } = parseConditionAnalysis(property);

    //______________________________________________________
    // JAVASCRIPT
    // Build the card layout
    return (
        <div className={`bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden ${className}`}>
            {/*______________________________________________________*/}
            {/* PROPERTY IMAGE + PRICE OVERLAY */}
            <div className="relative h-48 overflow-hidden">
                {/* If there is an image at this index, show it. If not, show a grey box. */}
                {property.image_urls?.[imageIndex] ? (
                    <img
                        src={property.image_urls[imageIndex]} // show one image from the list
                        alt={`${property.property_type} at ${property.address}`} // text for screen readers
                        className="w-full h-full object-cover" // fill the box and crop edges
                        loading="lazy" // do not load until needed
                    />
                ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
                        No image available
                    </div>
                )}

                {/* Price sits in the top left so it is easy to spot */}
                <div className="absolute top-3 left-3 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-bold">
                    {formatPrice(property.price)}
                </div>
            </div>

            {/*______________________________________________________*/}
            {/* PROPERTY DETAILS */}
            <div className="p-4">
                {/* Property type as the title. Cut off after one line so the card stays tidy. */}
                <h3 className="font-bold text-slate-900 text-lg mb-1 line-clamp-1">
                    {property.property_type}
                </h3>

                {/* Address on one line so it does not push the card taller. */}
                <p className="text-slate-600 text-sm mb-2 line-clamp-1">
                    {property.address}
                </p>

                {/* Show a short description if allowed and present. Keep it to two lines. */}
                {showDescription && property.description && (
                    <p className="text-slate-700 text-sm mb-3 leading-relaxed line-clamp-2">
                        {property.description}
                    </p>
                )}

                {/*______________________________________________________*/}
                {/* PROPERTY FEATURES */}
                <div className="flex items-center gap-4 text-slate-600 text-sm mb-3">
                    {/* Show bedrooms only if we have a number */}
                    {property.bedrooms_count && (
                        <div className="flex items-center gap-1">
                            <Bed className="w-4 h-4" />
                            <span>{property.bedrooms_count}</span>
                        </div>
                    )}

                    {/* Show bathrooms only if we have a number */}
                    {property.bathrooms_count && (
                        <div className="flex items-center gap-1">
                            <Bath className="w-4 h-4" />
                            <span>{property.bathrooms_count}</span>
                        </div>
                    )}

                    {/* Show total area only if we have a value */}
                    {property.total_area_sqm && (
                        <div className="flex items-center gap-1">
                            <Square className="w-4 h-4" />
                            <span>{property.total_area_sqm} m²</span>
                        </div>
                    )}
                </div>

                {/*______________________________________________________*/}
                {/* ROOM CONDITION BADGES */}
                <div className="flex gap-2 mb-3 flex-wrap">
                    {/* Kitchen state badge */}
                    <RoomBadge roomType="Kitchen" condition={kitchenState} />
                    {/* Bathroom state badge */}
                    <RoomBadge roomType="Bathroom" condition={bathroomState} />
                </div>

                {/*______________________________________________________*/}
                {/* CUSTOM CONTENT SLOT */}
                {/* Parent can place buttons or extra info here */}
                {children}
            </div>
        </div>
    );
};

//______________________________________________________
// EXPORTS
// Export the main card and the helpers so they can be reused
export default PropertyPreviewCard;
// eslint-disable-next-line react-refresh/only-export-components
export { parseConditionAnalysis, formatPrice };

