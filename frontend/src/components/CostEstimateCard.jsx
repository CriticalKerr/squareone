import React from 'react';
import { ChefHat, Bath, Clock } from 'lucide-react'; // Icons for kitchen, bath, and time
import { Badge } from '@/components/ui/badge'; // Badge component for labels

//______________________________________________________
// FORMAT CURRENCY
// Turn a number into a British pound string or show ‘—’ if it’s not a number
const formatCurrency = (amount) => {
    const num = Number(String(amount ?? '').replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(num)) return '—'; // If it’s not a real number, show a dash
    return new Intl.NumberFormat('en-GB', { // Format as £X,XXX with no pence
        style: 'currency',
        currency: 'GBP',
        maximumFractionDigits: 0,
    }).format(num);
};

//______________________________________________________
// COST ESTIMATE CARD COMPONENT
// Show cost details for a room, or a message if there’s no estimate
const CostEstimateCard = ({ estimate, roomType }) => {
    // If there’s no estimate data, show a simple placeholder
    if (!estimate) {
        return (
            <div className="h-full bg-slate-50 p-3 rounded-lg flex flex-col items-center justify-center">
                {roomType === 'kitchen' ? (
                    <ChefHat className="w-8 h-8 text-slate-400 mb-2" />
                ) : (
                    <Bath className="w-8 h-8 text-slate-400 mb-2" />
                )}
                <p className="text-sm text-slate-500 font-medium text-center">
                    No cost estimate
                </p>
            </div>
        );
    }

    // Destructure estimate details for easy use
    const {
        total_cost,
        timeline_weeks,
        detailed_description,
        materials_list,
        breakdown,
        used_floorplan_area,
        floorplan_area_sqm,
        labor_cost,
        material_cost,
        vat_included,
    } = estimate;

    return (
        <div className="h-full bg-slate-50 p-3 rounded-lg flex flex-col">

            {/*______________________________________________________*/}
            {/* HEADER */}
            <div className="flex items-center gap-1 mb-2">
                {roomType === 'kitchen' ? (
                    <ChefHat className="w-4 h-4 text-slate-600" /> // Small kitchen icon
                ) : (
                    <Bath className="w-4 h-4 text-slate-600" /> // Small bath icon
                )}
                {/* Title */}
                <h5 className="font-semibold text-slate-900 text-sm">Refurb Cost</h5>
            </div>

            {/*______________________________________________________*/}
            {/* BODY */}
            <div className="flex-1 text-xs space-y-2 overflow-hidden">
                {/* Show timeline if provided */}
                {timeline_weeks && (
                    <div className="flex items-center gap-1 text-slate-600 bg-white p-1 rounded">
                        {/* Clock icon */}
                        <Clock className="w-3 h-3" />
                        {/* Weeks text */}
                        <span className="font-medium">{timeline_weeks} weeks</span>
                    </div>
                )}

                {/* Show description if provided */}
                {detailed_description && (
                    <div className="prose prose-sm text-justify [hyphens:auto] max-w-full">
                        <p className="m-0 text-slate-700">{detailed_description}</p>
                    </div>
                )}

                {/* List key materials */}
                {Array.isArray(materials_list) && materials_list.length > 0 && (
                    <div>
                        <p className="font-medium text-slate-700 mb-1">Key Materials:</p>
                        <div className="flex flex-wrap gap-1">
                            {materials_list.map((material, i) => (
                                <Badge
                                    key={i}
                                    variant="secondary"
                                    className="text-xs px-1 py-0 break-words"
                                >
                                    {material}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/* Show cost breakdown */}
                {breakdown && Object.keys(breakdown).length > 0 && (
                    <div className="bg-white p-1.5 rounded">
                        <p className="font-medium text-slate-700 mb-1">Costs:</p>
                        <div className="space-y-0.5">
                            {Object.entries(breakdown).map(([category, cost]) => (
                                <div key={category} className="flex justify-between">
                  <span className="capitalize text-slate-600">
                    {category.replace(/_/g, ' ')}:
                  </span>
                                    <span className="font-medium">{formatCurrency(cost)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Show floorplan measurement */}
                {used_floorplan_area && floorplan_area_sqm && (
                    <div className="text-xs text-green-600 font-medium bg-green-50 p-1 rounded text-center">
                        ✓ {floorplan_area_sqm}m² measured
                    </div>
                )}

                {/* Show labor and material costs */}
                <div className="flex gap-1">
                    {labor_cost && (
                        <div className="bg-blue-50 px-1.5 py-0.5 rounded flex-1 text-center">
              <span className="text-blue-700 font-medium text-xs">
                Labor: {formatCurrency(labor_cost)}
              </span>
                        </div>
                    )}
                    {material_cost && (
                        <div className="bg-orange-50 px-1.5 py-0.5 rounded flex-1 text-center">
              <span className="text-orange-700 font-medium text-xs">
                Materials: {formatCurrency(material_cost)}
              </span>
                        </div>
                    )}
                </div>

                {/* Show VAT info */}
                {vat_included !== undefined && (
                    <div className="bg-gray-100 p-1 rounded text-center">
            <span className="text-gray-600 text-xs">
              {vat_included ? 'Inc. VAT' : 'Ex. VAT'}
            </span>
                    </div>
                )}
            </div>

            {/*______________________________________________________*/}
            {/* TOTAL COST */}
            <div className="mb-2">
                <Badge
                    variant="outline"
                    className="font-bold text-base px-2 py-1 w-full justify-center bg-black text-white"
                >
                    {formatCurrency(total_cost)}
                </Badge>
            </div>
        </div>
    );
};

export default CostEstimateCard;
