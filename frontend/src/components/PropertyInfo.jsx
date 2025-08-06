import React, { useState, useEffect, useRef } from 'react';
import {X, Bed, Bath, Square, Sparkles, Wrench, ChevronLeft, ChevronRight, Home, Hammer,} from 'lucide-react';
import { Badge } from '@/components/ui/badge'; // Icons for close, features, and actions
import CostEstimateCard from "@/components/CostEstimateCard.jsx"; // Cost card component
import CostScenarioCard from "@/components/CostScenarioCard.jsx"; // ROI calculation card
import InfoCells from "@/components/InfoCells.jsx"; // Grid of property summary cells

//______________________________________________________
// PROPERTY DIALOG COMPONENT
// Shows a popup with property details, images, and cost info
const PropertyDialog = ({ property, isOpen, triggerPosition, onClose }) => {

    //______________________________________________________
    // STATE FOR EXPANSION AND CAROUSEL
    const [isExpanded, setIsExpanded] = useState(false); // Whether dialog is full-size
    const [currentImageIndex, setCurrentImageIndex] = useState(0); // Index for images carousel
    const dialogRef = useRef(null);  // Ref to manage focus
    const [expandedSquare, setExpandedSquare] = useState(null); // null, 1, 2, or 3

    //______________________________________________________
    // DELAYED EXPAND EFFECT
    // When opening, wait a bit then expand dialog box
    useEffect(() => {
        if (isOpen && !isExpanded) {
            // Small delay then expand to full dialog
            const timer = setTimeout(() => setIsExpanded(true), 50);
            return () => clearTimeout(timer);
        } else if (!isOpen) {
            setIsExpanded(false);
        }
    }, [isExpanded, isOpen]);

    //______________________________________________________
    // ESCAPE KEY HANDLER
    // Close dialog on Escape key
    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape' && isOpen) {onClose?.();}};

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => {document.removeEventListener('keydown', handleEscape);};
        }
    }, [isOpen, onClose]);

    //______________________________________________________
    // FOCUS MANAGEMENT
    // Put focus in dialog for accessibility when opened
    useEffect(() => {
        if (isOpen && dialogRef.current) {
            dialogRef.current.focus();
        }
    }, [isOpen]);

    if (!property) return null;

    //______________________________________________________
    // PARSE CONDITION ANALYSIS
    const conditionAnalysis = Array.isArray(property.condition_analysis)
        ? property.condition_analysis
        : JSON.parse(property.condition_analysis || '[]');

    const bathroom = conditionAnalysis.find(r => r.room_type === 'bathroom');
    const kitchen = conditionAnalysis.find(r => r.room_type === 'kitchen');
    const bathroomState = bathroom?.state || 'unknown';
    const kitchenState = kitchen?.state || 'unknown';
    const bathroomRefurbRender = bathroom?.refurb_render_url || null;
    const kitchenRefurbRender = kitchen?.refurb_render_url || null;
    const bathroomCostEstimate = bathroom?.cost_estimate;
    const kitchenCostEstimate = kitchen?.cost_estimate;

    //______________________________________________________
    // IMAGE URL HELPER
    const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
    const resolveStatic = path => path?.startsWith('http') ? path : `${API_BASE}${path}`;

    //______________________________________________________
    // SET UP IMAGE CAROUSEL
    const allCarouselImages = [
        ...(property.image_urls || []),
        ...(property.floorplan_urls ? [property.floorplan_urls] : [])
    ];
    const totalImages = allCarouselImages.length;
    const floorplanIndex = (property.image_urls || []).length;

    //______________________________________________________
    // CAROUSEL NAVIGATION
    const nextImage = () => setCurrentImageIndex((prev) => (prev + 1) % totalImages);
    const prevImage = () => setCurrentImageIndex((prev) => (prev - 1 + totalImages) % totalImages);
    const isCurrentImageFloorplan = currentImageIndex >= floorplanIndex;

    //______________________________________________________
    // DIALOG POSITIONING
    const getDialogStyle = () => {
        if (!triggerPosition) {
            return {top: '50%', left: '50%', transform: 'translate(-50%, -50%)',};
        }
        if (!isExpanded) {

            return {top: `${triggerPosition.y}px`, left: `${triggerPosition.x}px`, transform: 'translate(-50%, -50%)',
            };
        } else {
            // Expand to center
            return {top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            };
        }
    };
    // Don't render anything if not open
    if (!isOpen) return null;

    //______________________________________________________
    // RENDER DIALOG
    return (
        <div className="fixed inset-0 z-50">
            <div
                ref={dialogRef}
                tabIndex={-1}
                className={`absolute bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden transition-all duration-700 ease-out focus:outline-none ${
                    isExpanded
                        ? 'w-[92vw] h-[90vh] sm:w-[92vw] sm:h-[90vh]'
                        : 'w-72 h-auto'
                }`}
                style={getDialogStyle()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="property-dialog-title"
            >
                {/*______________________________________________________*/}
                {/* CLOSE BUTTON (only when expanded) */}
                {isExpanded && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-10 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-colors"
                        aria-label="Close property details"
                    >
                        <X className="w-4 h-4 text-slate-600" />
                    </button>
                )}

                {/*______________________________________________________*/}
                {/* PREVIEW STATE (preview) */}
                {!isExpanded && (
                    <div className="w-72">

                        {/* Property Image */}
                        <div className="relative h-40 overflow-hidden">
                            <img
                                src={property.image_urls?.[0]}
                                alt={property.title}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute top-3 left-3 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-bold">
                                {property.price}
                            </div>
                        </div>

                        {/* Property Details */}
                        <div className="p-4">
                            <h3 id="property-dialog-title" className="font-bold text-slate-900 text-lg mb-1">
                                {property.property_type}
                            </h3>
                            <p className="text-slate-600 text-sm mb-3">
                                {property.address}
                            </p>

                            {/* Property Features */}
                            <div className="flex items-center gap-1 text-slate-600 text-sm mb-3">
                                <div className="flex items-center gap-1">
                                    <Bed className="w-4 h-4" />
                                    <span>{property.bedrooms_count}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Bath className="w-4 h-4" />
                                    <span>{property.bathrooms_count}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Square className="w-4 h-4" />
                                    <span>{property.total_area_sqm} sqm</span>
                                </div>
                            </div>

                            {/* Condition Badges */}
                            <div className="flex gap-2">
                                <Badge
                                    variant={kitchenState === 'new/renovated' ? 'default' : 'secondary'}
                                    className="flex items-center gap-1 text-xs"
                                >
                                    {kitchenState === 'new/renovated' ? (
                                        <Sparkles className="w-3 h-3" />
                                    ) : (
                                        <Wrench className="w-3 h-3" />
                                    )}
                                    Kitchen
                                </Badge>
                                <Badge
                                    variant={bathroomState === 'new/renovated' ? 'default' : 'secondary'}
                                    className="flex items-center gap-1 text-xs"
                                >
                                    {bathroomState === 'new/renovated' ? (
                                        <Sparkles className="w-3 h-3" />
                                    ) : (
                                        <Wrench className="w-3 h-3" />
                                    )}
                                    Bathroom
                                </Badge>
                            </div>
                        </div>
                    </div>
                )}

                {/*______________________________________________________*/}
                {/* EXPANDED STATE (full grid) */}
                {isExpanded && (
                    <div className="w-full h-full p-1">
                        {/* 6-Square Grid Layout - 3 columns, 2 rows with proper height calculation */}
                        <div className={`gap-1 w-full h-full ${expandedSquare ? 'flex' : 'grid grid-cols-3 grid-rows-2'}`}>
                            
                            {/* Square 1: Main Property Image with Carousel */}
                            <div className={`relative rounded-lg overflow-hidden group bg-slate-100 w-full h-full cursor-pointer ${expandedSquare === 1 ? 'flex-1' : ''} ${expandedSquare && expandedSquare !== 1 ? 'hidden' : ''}`}
                                 onClick={() => setExpandedSquare(expandedSquare === 1 ? null : 1)}>

                                <img
                                    src={allCarouselImages[currentImageIndex]}
                                    className={`w-full h-full transition-all duration-500 ${
                                        isCurrentImageFloorplan ? 'object-contain bg-slate-100' : 'object-cover'
                                    }`}
                                    alt={isCurrentImageFloorplan ? 'Property floorplan' : `Property view ${currentImageIndex + 1}`}
                                />

                                {/* Image Type Indicator */}
                                <div className="absolute top-2 left-2 bg-slate-900 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                                    {isCurrentImageFloorplan ? (
                                        <>
                                            <Home className="w-3 h-3" />
                                            Floor Plan
                                        </>
                                    ) : (
                                        <>
                                            <Home className="w-3 h-3" />
                                            Existing
                                        </>
                                    )}
                                </div>

                                {/* Navigation - prevent expansion when clicking */}
                                {totalImages > 1 && (
                                    <>
                                        <button onClick={(e) => {e.stopPropagation();
                                                prevImage();
                                            }}
                                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                nextImage();
                                            }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </>
                                )}

                                {/* Counter */}
                                {totalImages > 1 && (
                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                                        {currentImageIndex + 1} / {totalImages}
                                    </div>
                                )}
                            </div>

                            {/* Square 2: Kitchen Refurb Image */}
                            <div className={`relative rounded-lg overflow-hidden bg-slate-100 w-full h-full cursor-pointer ${expandedSquare === 2 ? 'flex-1' : ''} ${expandedSquare && expandedSquare !== 2 ? 'hidden' : ''}`}
                                 onClick={() => setExpandedSquare(expandedSquare === 2 ? null : 2)}>
                                <h4 className="absolute top-2 left-2 bg-slate-900 text-white px-2 py-1 rounded text-xs font-bold z-10">
                                    Kitchen Refurb
                                </h4>
                                {kitchenRefurbRender ? (
                                    <img
                                        src={resolveStatic(kitchenRefurbRender)}
                                        alt="Kitchen refurb"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                                        <div className="text-center">
                                            <Hammer className="w-12 h-12 mx-auto mb-2" />
                                            <p className="text-sm">No kitchen refurb</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Square 3: Bathroom Refurb Image */}
                            <div className={`relative rounded-lg overflow-hidden bg-slate-100 w-full h-full cursor-pointer ${expandedSquare === 3 ? 'flex-1' : ''} ${expandedSquare && expandedSquare !== 3 ? 'hidden' : ''}`}
                                 onClick={() => setExpandedSquare(expandedSquare === 3 ? null : 3)}>
                                <h4 className="absolute top-2 left-2 bg-slate-900 text-white px-2 py-1 rounded text-xs font-bold z-10">
                                    Bathroom Refurb
                                </h4>
                                {bathroomRefurbRender ? (
                                    <img
                                        src={resolveStatic(bathroomRefurbRender)}
                                        alt="Bathroom refurb"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                                        <div className="text-center">
                                            <Hammer className="w-12 h-12 mx-auto mb-2" />
                                            <p className="text-sm">No bathroom refurb</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Square 4: Property Info Grid */}
                            <div className={`grid grid-cols-2 grid-rows-2 gap-1 w-full h-full ${expandedSquare ? 'hidden' : ''}`}>
                            {/* Inner Top Left Row  */}
                                <div className="w-full h-full row-span-2">
                                    <InfoCells property={property} />
                                </div>

                                {/* Right Side: ROI Calculator spanning 2 rows */}
                                <div className="w-full h-full row-span-2">
                                    <CostScenarioCard property={property} />
                                </div>
                            </div>

                            {/* Square 5: Kitchen Cost Estimate */}
                            <div className={`w-full h-full ${expandedSquare ? 'hidden' : ''}`}>
                            <CostEstimateCard estimate={kitchenCostEstimate} roomType="kitchen" />
                            </div>

                            {/* Square 6: Bathroom Cost Estimate */}
                            <div className={`w-full h-full ${expandedSquare ? 'hidden' : ''}`}>
                            <CostEstimateCard estimate={bathroomCostEstimate} roomType="bathroom" />
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PropertyDialog;