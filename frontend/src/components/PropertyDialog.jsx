import React from 'react';
import {X, Bed, Bath, Square, Sparkles, Wrench, TrendingUp, Building,} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ROICalculator from "@/components/ROICalculator.jsx";

const PropertyInfo = ({ property, isOpen, onClose }) => {
    if (!property || !isOpen) return null;

    // parse the condition analysis array
    const conditionAnalysis = Array.isArray(property.condition_analysis)
        ? property.condition_analysis
        : JSON.parse(property.condition_analysis || '[]');

    const bathroom = conditionAnalysis.find(r => r.room_type === 'bathroom');
    const kitchen = conditionAnalysis.find(r => r.room_type === 'kitchen');
    const bathroomState = bathroom?.state || 'unknown';
    const kitchenState = kitchen?.state || 'unknown';
    const bathroomRefurbRender = bathroom?.refurb_render_url || null;
    const kitchenRefurbRender = kitchen?.refurb_render_url || null;

    // resolve relative vs absolute URLs
    const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
    const resolveStatic = path =>
        path?.startsWith('http') ? path : `${API_BASE}${path}`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[80vw] h-[80vh] overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-2000">
                            {property.type}
                        </h2>
                        <p className="font-bold text-slate-950 my-lg-3">{property.address}</p>
                    </div>
                    <Button
                        onClick={onClose}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-slate-100"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-3 gap-6 p-6 h-[calc(90vh-120px)] overflow-y-auto">
                    {/* Left Column */}
                    <div className="space-y-6">
                        <div className="relative rounded-lg overflow-hidden">
                            <img
                                src={property.image_urls?.[4]}
                                className="w-full h-64 object-cover"
                            />
                            <div className="absolute top-3 left-3 bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold text-lg">
                                {property.price}
                            </div>
                            {property.valueIncrease && (
                                <div className="absolute top-3 right-3 bg-green-500 text-white px-2 py-1 rounded-lg text-sm font-bold flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" />
                                    <span>+{property.valueIncrease}%</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-6 text-slate-600">
                            <div className="flex items-center gap-2">
                                <Building className="w-5 h-5" />
                                <span className="font-medium">{property.property_type}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Bed className="w-5 h-5" />
                                <span className="font-medium">{property.bedrooms_count} bed</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Bath className="w-5 h-5" />
                                <span className="font-medium">{property.bathrooms_count} bath</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Square className="w-5 h-5" />
                                <span className="font-medium">{property.total_area_sqm} sqm</span>
                            </div>
                            <Badge
                                variant={kitchenState === 'new/renovated' ? 'default' : 'secondary'}
                                className="flex items-center gap-1"
                            >
                                {kitchenState === 'new/renovated' ? (
                                    <Sparkles className="w-5 h-5" />
                                ) : (
                                    <Wrench className="w-5 h-5" />
                                )}
                                <span className="font-medium">Kitchen</span>
                            </Badge>
                            <Badge
                                variant={bathroomState === 'new/renovated' ? 'default' : 'secondary'}
                                className="flex items-center gap-2"
                            >
                                {bathroomState === 'new/renovated' ? (
                                    <Sparkles className="w-5 h-5" />
                                ) : (
                                    <Wrench className="w-5 h-5" />
                                )}
                                <span className="font-medium">Bathroom</span>
                            </Badge>
                        </div>

                        <div>
                            <h4 className="font-semibold text-slate-900 mb-2">Description</h4>
                            {kitchen?.room_description}
                            {bathroom?.room_description}
                            <p className="text-slate-700 leading-relaxed">
                                {property.description}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-1">
                            {property.image_urls?.slice(0, 4).map((url, i) => (
                                <img
                                    key={i}
                                    src={url}
                                    alt=""
                                    className="rounded-lg h-50 object-cover"
                                />
                            ))}
                        </div>
                        <div className="relative rounded-lg overflow-hidden">
                            <img
                                src={property.floorplan_urls}
                            />
                        </div>

                    </div>

                    {/* Middle Column - Refurb Renders */}
                    <div className="space-y-6">
                        <div className="relative rounded-lg overflow-hidden">


                            {/* Bathroom */}
                            <div className="mt-0">
                                <div className="relative rounded-lg overflow-hidden">
                                    <h4 className="absolute top-3 left-3 bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold text-lg">
                                        Potential Bathroom Refurb
                                    </h4>
                                    {bathroomRefurbRender ? (
                                        <img
                                            src={resolveStatic(bathroomRefurbRender)}
                                            alt="Refurbished modern bathroom"
                                            className="w-full h-100 object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-40 flex items-center justify-center text-slate-400 bg-slate-100">
                                            No bathroom refurb available
                                        </div>
                                    )}
                                    <div className="bg-slate-50 p-3">
                                        <p className="text-sm text-slate-600">
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Kitchen */}
                            <div className="mt-6">
                                <div className="relative rounded-lg overflow-hidden">
                                    <h4 className="absolute top-3 left-3 bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold text-lg">
                                        Potential Kitchen Refurb
                                    </h4>
                                    {kitchenRefurbRender ? (
                                        <img
                                            src={resolveStatic(kitchenRefurbRender)}
                                            alt="Refurbished modern kitchen"
                                            className="h-full h-100 object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-40 flex items-center justify-center text-slate-400 bg-slate-100">
                                            No kitchen refurb available
                                        </div>
                                    )}
                                    <div className="bg-slate-50 p-3">
                                        <p className="text-sm text-slate-600">
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                        {/* Right Column - ROI Calculator */}
                        <div className="pl-6">
                            <ROICalculator property={property} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PropertyInfo;
