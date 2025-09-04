import React, { useState, useEffect, useRef } from 'react';
import {X, Bed, Bath, Square, Sparkles, Wrench, ChevronLeft, ChevronRight, Home, Hammer, ArrowLeft, Link2} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import CostEstimateCard from "@/components/RefurbCostEstimateCard.jsx";
import CostScenarioCard from "@/components/CostScenarioCard.jsx";
import { useIsMobile } from '../hooks/useIsMobile';
import InfoCells from './InfoCells';
import useLikes from '../hooks/useLikes';
import { Heart } from 'lucide-react';
import RefurbCostEstimateCard from "@/components/RefurbCostEstimateCard.jsx";

//______________________________________________________
// PROPERTY DIALOG COMPONENT  
// Shows a popup with property details, images, and cost info
const PropertyDialog = ({ property, isOpen, triggerPosition, onClose }) => {
    const isMobile = useIsMobile();
    const { isLiked, toggleLike } = useLikes();

    //______________________________________________________
    // STATE FOR EXPANSION AND CAROUSEL
    const [isExpanded, setIsExpanded] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const dialogRef = useRef(null);
    const [expandedSquare, setExpandedSquare] = useState(null);

    // ADD THESE NEW STATE VARIABLES FOR TRACKING REFURB COSTS
    const [currentKitchenCost, setCurrentKitchenCost] = useState(0);
    const [currentBathroomCost, setCurrentBathroomCost] = useState(0);

    //______________________________________________________
    // CLICK HANDLER
    const handleLikeClick = async (e) => {
        e.stopPropagation(); // Prevent any parent click handlers
        const result = await toggleLike(property.id || property.listing_id);
        if (!result.success) {
            // Optionally show an error message
            console.error('Failed to toggle like:', result.error);
        }
    };

    //______________________________________________________
    // DELAYED EXPAND EFFECT
    useEffect(() => {
        if (isOpen && !isExpanded && !isMobile) {
            // Only use the expand animation on desktop
            const timer = setTimeout(() => setIsExpanded(true), 50);
            return () => clearTimeout(timer);
        } else if (!isOpen) {
            setIsExpanded(false);
        } else if (isMobile) {
            // On mobile, skip the expand animation
            setIsExpanded(true);
        }
    }, [isExpanded, isOpen, isMobile]);

    //______________________________________________________
    // ESCAPE KEY HANDLER
    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape' && isOpen) {
                onClose?.();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => {
                document.removeEventListener('keydown', handleEscape);
            };
        }
    }, [isOpen, onClose]);

    //______________________________________________________
    // FOCUS MANAGEMENT
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
        // Mobile: always full screen
        if (isMobile) {
            return {
                top: '0',
                left: '0',
                transform: 'none',
            };
        }

        // Desktop: existing logic
        if (!triggerPosition) {
            return {top: '50%', left: '50%', transform: 'translate(-50%, -50%)'};
        }
        if (!isExpanded) {
            return {
                top: `${triggerPosition.y}px`,
                left: `${triggerPosition.x}px`,
                transform: 'translate(-50%, -50%)'
            };
        } else {
            return {top: '50%', left: '50%', transform: 'translate(-50%, -50%)'};
        }
    };

    // Don't render anything if not open
    if (!isOpen) return null;

    //______________________________________________________
    // MOBILE LAYOUT
    if (isMobile) {
        // If an image is expanded, show full-screen image viewer
        if (expandedSquare) {
            return (
                <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
                    {/* Close button */}
                    <button
                        onClick={() => setExpandedSquare(null)}
                        className="absolute top-4 right-4 z-10 bg-white/20 hover:bg-white/30 text-white p-3 rounded-full touch-manipulation"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {/* Full screen image */}
                    <div className="relative w-full h-full flex items-center justify-center">
                        <img
                            src={expandedSquare === 1
                                ? allCarouselImages[currentImageIndex]
                                : expandedSquare === 2
                                    ? kitchenRefurbRender
                                    : bathroomRefurbRender
                            }
                            className="max-w-full max-h-full object-contain"
                            alt={expandedSquare === 1
                                ? (isCurrentImageFloorplan ? 'Property floorplan' : 'Property image')
                                : expandedSquare === 2
                                    ? 'Kitchen refurbishment'
                                    : 'Bathroom refurbishment'
                            }
                        />

                        {/* Navigation arrows for main property images */}
                        {expandedSquare === 1 && totalImages > 1 && (
                            <>
                                <button
                                    onClick={prevImage}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white p-4 rounded-full touch-manipulation"
                                >
                                    <ChevronLeft className="w-6 h-6" />
                                </button>
                                <button
                                    onClick={nextImage}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white p-4 rounded-full touch-manipulation"
                                >
                                    <ChevronRight className="w-6 h-6" />
                                </button>
                            </>
                        )}

                        {/* Image counter for main property images */}
                        {expandedSquare === 1 && totalImages > 1 && (
                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full">
                                {currentImageIndex + 1} / {totalImages}
                            </div>
                        )}

                        {/* Image type indicator */}
                        <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg text-sm font-medium">
                            {expandedSquare === 1
                                ? (isCurrentImageFloorplan ? 'Floor Plan' : 'Property Image')
                                : expandedSquare === 2
                                    ? 'Kitchen Refurbishment'
                                    : 'Bathroom Refurbishment'
                            }
                        </div>
                    </div>
                </div>
            );
        }

        // Normal mobile layout
        return (
            <div className="fixed inset-0 bg-white z-50 flex flex-col">
                {/* Mobile Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
                    <button
                        onClick={onClose}
                        className="p-2 -ml-2 rounded-md hover:bg-gray-100 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h2 className="font-semibold text-gray-900 text-center flex-1 px-4 line-clamp-1">
                        {property?.title || 'Property Details'}
                    </h2>
                    <div className="w-10" />
                </div>

                {/* Mobile Content - Scrollable */}
                <div className="flex-1 overflow-y-auto pb-safe mobile-scroll">
                    {/* Hero Image Section - NOW CLICKABLE */}
                    <div
                        className="relative h-64 bg-slate-100 cursor-pointer touch-manipulation"
                        onClick={() => setExpandedSquare(1)}
                    >
                        <img
                            src={allCarouselImages[currentImageIndex]}
                            className={`w-full h-full transition-all duration-300 ${
                                isCurrentImageFloorplan ? 'object-contain bg-slate-100' : 'object-cover'
                            }`}
                            alt={isCurrentImageFloorplan ? 'Property floorplan' : `Property view ${currentImageIndex + 1}`}
                        />

                        {/* Image Type Indicator */}
                        <div className="absolute top-3 left-3 bg-black/80 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1">
                            <Home className="w-3 h-3" />
                            {isCurrentImageFloorplan ? 'Floor Plan' : 'Property'}
                        </div>

                        {/* Price Badge */}
                        <div className="absolute top-3 right-3 bg-black text-white px-3 py-1.5 rounded-lg text-sm font-bold">
                            {property.price}
                        </div>

                        {/* Expand hint */}
                        <div className="absolute bottom-3 right-3 bg-black/60 text-white px-2 py-1 rounded text-xs">
                            Tap to expand
                        </div>

                        {/* Navigation Arrows */}
                        {totalImages > 1 && (
                            <>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        prevImage();
                                    }}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full touch-manipulation"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        nextImage();
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full touch-manipulation"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </>
                        )}

                        {/* Image Counter */}
                        {totalImages > 1 && (
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                                {currentImageIndex + 1} / {totalImages}
                            </div>
                        )}
                    </div>

                    {/* Property Details */}
                    <div className="p-4 space-y-4">
                        {/* Basic Info */}
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{property.property_type}</h3>
                            <p className="text-gray-600 mb-3">{property.address}</p>

                            {/* Property Features */}
                            <div className="flex items-center gap-4 text-gray-600 mb-4">
                                <div className="flex items-center gap-1">
                                    <Bed className="w-4 h-4" />
                                    <span className="font-medium">{property.bedrooms_count}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Bath className="w-4 h-4" />
                                    <span className="font-medium">{property.bathrooms_count}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Square className="w-4 h-4" />
                                    <span className="font-medium">{property.total_area_sqm} m²</span>
                                </div>
                            </div>

                            {/* Condition Badges */}
                            <div className="flex gap-2 mb-4">
                                <Badge
                                    variant={kitchenState === 'new/renovated' ? 'default' : 'secondary'}
                                    className="flex items-center gap-1"
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
                                    className="flex items-center gap-1"
                                >
                                    {bathroomState === 'new/renovated' ? (
                                        <Sparkles className="w-3 h-3" />
                                    ) : (
                                        <Wrench className="w-3 h-3" />
                                    )}
                                    Bathroom
                                </Badge>
                            </div>

                            {/* ZOOPLA LINK */}
                            {property.listing_link && (
                                <div className="mb-4">
                                    <a
                                        href={property.listing_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 px-4 py-3 rounded-lg font-bold text-sm touch-manipulation transition-colors w-full justify-center"
                                    >
                                        <Link2 className="w-5 h-5" />
                                        Check Out on Zoopla
                                    </a>
                                </div>
                            )}

                            {/* LIKE BUTTON */}
                            <div className="mb-4">
                                <button
                                    onClick={handleLikeClick}
                                    className={`inline-flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm touch-manipulation transition-all w-full justify-center ${
                                        isLiked(property.id || property.listing_id)
                                            ? 'bg-slate-100 text-slate-950 border-2 border-slate-950 hover:bg-slate-100'
                                            : 'bg-gray-50 text-gray-600 border-2 border-gray-200 hover:bg-gray-100'
                                    }`}
                                >
                                    <Heart
                                        className={`w-5 h-5 transition-all ${
                                            isLiked(property.id || property.listing_id) ? 'fill-current text-slate-950' : ''
                                        }`}
                                    />
                                    {isLiked(property.id || property.listing_id) ? 'Loved!' : 'Love this property'}
                                </button>
                            </div>


                        </div>

                        {/* Refurb Images */}
                        {(kitchenRefurbRender || bathroomRefurbRender) && (
                            <div className="space-y-4">
                                <h4 className="text-lg font-semibold text-gray-900">Renovation Possibilities</h4>

                                {/* Kitchen Refurb - CLICKABLE */}
                                {kitchenRefurbRender && (
                                    <div
                                        className="bg-slate-50 rounded-xl overflow-hidden cursor-pointer touch-manipulation"
                                        onClick={() => setExpandedSquare(2)}
                                    >
                                        <div className="relative h-48">
                                            <img
                                                src={kitchenRefurbRender}
                                                alt="Kitchen refurbishment"
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute top-3 left-3 bg-black/80 text-white px-2 py-1 rounded text-sm font-medium">
                                                Kitchen Refurb
                                            </div>
                                            <div className="absolute bottom-3 right-3 bg-black/60 text-white px-2 py-1 rounded text-xs">
                                                Tap to expand
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Bathroom Refurb */}
                                {bathroomRefurbRender && (
                                    <div
                                        className="bg-slate-50 rounded-xl overflow-hidden cursor-pointer touch-manipulation"
                                        onClick={() => setExpandedSquare(3)}
                                    >
                                        <div className="relative h-48">
                                            <img
                                                src={bathroomRefurbRender}
                                                alt="Bathroom refurbishment"
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute top-3 left-3 bg-black/80 text-white px-2 py-1 rounded text-sm font-medium">
                                                Bathroom Refurb
                                            </div>
                                            <div className="absolute bottom-3 right-3 bg-black/60 text-white px-2 py-1 rounded text-xs">
                                                Tap to expand
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Cost Estimates */}
                        <div className="space-y-4">
                            <h4 className="text-lg font-semibold text-gray-900">Cost Estimates</h4>

                            {kitchenCostEstimate && (
                                <div className="bg-white border border-gray-200 rounded-xl p-1">
                                    <CostEstimateCard
                                        estimate={kitchenCostEstimate}
                                        roomType="kitchen"
                                        onCostChange={setCurrentKitchenCost}  // ADD THIS LINE
                                    />
                                </div>
                            )}

                            {bathroomCostEstimate && (
                                <div className="bg-white border border-gray-200 rounded-xl p-1">
                                    <CostEstimateCard
                                        estimate={bathroomCostEstimate}
                                        roomType="bathroom"
                                        onCostChange={setCurrentBathroomCost}  // ADD THIS LINE
                                    />
                                </div>
                            )}

                            <div className="bg-white border border-gray-200 rounded-xl p-1">
                                <CostScenarioCard
                                    property={property}
                                    kitchenDIYMode={true}               // CHANGE TO TRUE
                                    bathroomDIYMode={true}              // CHANGE TO TRUE
                                    kitchenDIYCost={currentKitchenCost}  // ADD THIS LINE
                                    bathroomDIYCost={currentBathroomCost} // ADD THIS LINE
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    //______________________________________________________
    // DESKTOP LAYOUT (existing grid layout)
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
                {/* Close Button */}
                {isExpanded && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-10 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-colors"
                        aria-label="Close property details"
                    >
                        <X className="w-4 h-4 text-slate-600" />
                    </button>
                )}

                {/* PREVIEW STATE (desktop small view) */}
                {!isExpanded && (
                    <div className="w-72">
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

                        <div className="p-4">
                            <h3 id="property-dialog-title" className="font-bold text-slate-900 text-lg mb-1">
                                {property.property_type}
                            </h3>
                            <p className="text-slate-600 text-sm mb-3">
                                {property.address}
                            </p>

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

                {/* EXPANDED STATE (desktop grid) */}
                {isExpanded && (
                    <div className="w-full h-full p-1">
                        <div className={`gap-1 w-full h-full ${expandedSquare ? 'flex' : 'grid grid-cols-3 grid-rows-2'}`}>
                            {/* Your existing desktop grid layout stays the same */}
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

                                {totalImages > 1 && (
                                    <>
                                        <button onClick={(e) => {e.stopPropagation(); prevImage();}}
                                                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button onClick={(e) => {e.stopPropagation(); nextImage();}}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </>
                                )}

                                {totalImages > 1 && (
                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                                        {currentImageIndex + 1} / {totalImages}
                                    </div>
                                )}
                            </div>

                            {/* Rest of your existing desktop grid squares stay the same */}
                            <div className={`relative rounded-lg overflow-hidden bg-slate-100 w-full h-full cursor-pointer ${expandedSquare === 2 ? 'flex-1' : ''} ${expandedSquare && expandedSquare !== 2 ? 'hidden' : ''}`}
                                 onClick={() => setExpandedSquare(expandedSquare === 2 ? null : 2)}>
                                <h4 className="absolute top-2 left-2 bg-slate-900 text-white px-2 py-1 rounded text-xs font-bold z-10">
                                    Kitchen Refurb
                                </h4>
                                {kitchenRefurbRender ? (
                                    <img
                                        src={kitchenRefurbRender}
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

                            <div className={`relative rounded-lg overflow-hidden bg-slate-100 w-full h-full cursor-pointer ${expandedSquare === 3 ? 'flex-1' : ''} ${expandedSquare && expandedSquare !== 3 ? 'hidden' : ''}`}
                                 onClick={() => setExpandedSquare(expandedSquare === 3 ? null : 3)}>
                                <h4 className="absolute top-2 left-2 bg-slate-900 text-white px-2 py-1 rounded text-xs font-bold z-10">
                                    Bathroom Refurb
                                </h4>
                                {bathroomRefurbRender ? (
                                    <img
                                        src={bathroomRefurbRender}
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

                            <div className={`grid grid-cols-2 grid-rows-2 gap-1 w-full h-full ${expandedSquare ? 'hidden' : ''}`}>
                                <div className="w-full h-full row-span-2">
                                    <InfoCells property={property} />
                                </div>
                                <div className="w-full h-full row-span-2">
                                    <CostScenarioCard
                                        property={property}
                                        kitchenDIYMode={true}
                                        bathroomDIYMode={true}
                                        kitchenDIYCost={currentKitchenCost}
                                        bathroomDIYCost={currentBathroomCost}
                                    />
                                </div>
                            </div>

                            <div className={`w-full h-full ${expandedSquare ? 'hidden' : ''}`}>
                                <RefurbCostEstimateCard
                                    estimate={kitchenCostEstimate}
                                    roomType="kitchen"
                                    onCostChange={setCurrentKitchenCost}
                                />
                            </div>

                            <div className={`w-full h-full ${expandedSquare ? 'hidden' : ''}`}>
                                <RefurbCostEstimateCard
                                    estimate={bathroomCostEstimate}
                                    roomType="bathroom"
                                    onCostChange={setCurrentBathroomCost}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PropertyDialog;
