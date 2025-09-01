//______________________________________________________
// IMPORTS
// React, icons, Badge UI, and Switch component for toggles
import React, { useState, useEffect } from 'react';
import { ChefHat, Bath, Clock, ToolCaseIcon, ListIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

//______________________________________________________
// FORMAT CURRENCY
// Turn a number into a British pound string or show '—' if it's not a number
const formatCurrency = (amount) => {
    //turn anything we get into a string, strip out non-number characters, then into a Number
    const num = Number(String(amount ?? '').replace(/[^\d.-]/g, '')); //keep digits, dot, and minus only

    //if it is not a real number, show a dash to say "no value"
    if (!Number.isFinite(num)) return '—';

    //format the number like £12,345 using UK rules
    return new Intl.NumberFormat('en-GB', {
        style: 'currency',           //show it as money
        currency: 'GBP',             //use British pounds
        maximumFractionDigits: 0,    //whole pounds only
    }).format(num);
};

//______________________________________________________
// TOGGLE SWITCH COMPONENT
// Small inline toggle for cost breakdown items
const ToggleSwitch = ({ enabled, onChange, small = false }) => (
    <button
        onClick={(e) => {
            e.stopPropagation();
            onChange(!enabled);
        }}
        className={`relative inline-flex items-center ${small ? 'h-4 w-7' : 'h-5 w-9'} rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1 ${
            enabled ? 'bg-slate-900' : 'bg-slate-300'
        }`}
    >
        <span
            className={`inline-block ${small ? 'h-3 w-3' : 'h-4 w-4'} rounded-full bg-white transition-transform duration-200 ${
                enabled ? (small ? 'translate-x-3' : 'translate-x-4') : 'translate-x-0.5'
            }`}
        />
    </button>
);

//______________________________________________________
// COST ESTIMATE CARD COMPONENT
// Show cost details for a room, or a message if there's no estimate
const RefurbCostEstimateCard = ({
                                    estimate,
                                    roomType,
                                    onCostChange // Add this new prop
                                }) => {
    // State for individual cost toggles (removed isEditMode/DIY mode)
    const [costToggles, setCostToggles] = useState({});

    // Initialize cost toggles when estimate changes
    useEffect(() => {
        if (estimate?.breakdown) {
            const initialToggles = {};
            Object.keys(estimate.breakdown).forEach(category => {
                initialToggles[category] = true; // All enabled by default
            });
            setCostToggles(initialToggles);
        }
    }, [estimate]);

    // Calculate custom total based on toggles (always active now)
    const customTotal = React.useMemo(() => {
        if (!estimate?.breakdown) {
            return estimate?.total_cost || 0;
        }

        // Add up only the enabled items
        let total = 0;
        Object.entries(estimate.breakdown).forEach(([category, cost]) => {
            if (costToggles[category] !== false) { // If toggle is ON, add this cost
                const numCost = Number(cost) || 0;
                total += numCost;
            }
        });

        return Math.max(0, total);
    }, [estimate, costToggles]);

    //Calculate the "original breakdown total" for fair comparison
    const originalBreakdownTotal = React.useMemo(() => {
        if (!estimate?.breakdown) {
            return estimate?.total_cost || 0;
        }

        let total = 0;
        Object.entries(estimate.breakdown).forEach(([, cost]) => {
            const numCost = Number(cost) || 0;
            total += numCost;
        });

        return total;
    }, [estimate]);


    // Notify parent whenever the current total cost changes
    useEffect(() => {
        if (onCostChange) {
            onCostChange(customTotal);
        }
    }, [customTotal, onCostChange]);

    // Toggle individual cost item
    const toggleCostItem = (category) => {
        setCostToggles(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    //empty state if no estimate provided
    //if we have nothing to show, return a small friendly panel
    if (!estimate) {
        return (
            <div className="h-full bg-slate-50 p-3 rounded-lg flex flex-col items-center justify-center">
                {/* pick an icon that matches the room type */}
                {roomType === 'kitchen' ? (
                    <ChefHat className="w-8 h-8 text-slate-400 mb-2" />
                ) : (
                    <Bath className="w-8 h-8 text-slate-400 mb-2" />
                )}
                <p className="text-sm text-slate-500 font-medium text-center">No cost estimate</p>
            </div>
        );
    }

    //______________________________________________________
    // AREA USED DISPLAY HELPER
    // Decide which area value to show (measured vs estimated)
    const getAreaDisplay = (estimate) => {
        //safety check: if estimate is missing, stop here
        if (!estimate) return null;

        //pull the different area values from the estimate object
        const floorplanArea = estimate.floorplan_area_sqm;   //area read from a floorplan
        const estimatedArea = estimate.estimated_area_sqm;   //area guessed by a model or rule
        const usedArea = estimate.used_area_sqm;             //area measured another way
        const usedFloorplan = estimate.used_floorplan_area;  //true if floorplan area was used

        //start with nothing to show
        let displayArea = null;  //the number we will show
        let isMeasured = false;  //true if it came from the floorplan

        //if the floorplan was used and has a value, prefer that and mark as measured
        if (usedFloorplan && floorplanArea) {
            displayArea = floorplanArea;
            isMeasured = true;
        } else if (usedArea || estimatedArea) {
            //otherwise, show a measured value if we have it, or fall back to an estimate
            displayArea = usedArea || estimatedArea;
            isMeasured = false;
        }

        //give back both the area number and whether it was measured or estimated
        return displayArea ? { area: displayArea, measured: isMeasured } : null;
    };

    // Pull fields we'll display - with safe defaults
    const {
        timeline_weeks,
        detailed_description,
        materials_list = [],
        breakdown = {},
        labor_cost,
        material_cost,
    } = estimate || {};

    // Check if breakdown has data
    const hasBreakdownData = breakdown && Object.keys(breakdown).length > 0;

    //______________________________________________________
    // RENDER THE CARD
    return (
        <div className="h-full bg-slate-50 p-3 rounded-lg flex flex-col">
            {/*______________________________________________________*/}
            {/* HEADER */}
            <div className="flex items-center gap-1 mb-2">
                {/* small icon that matches kitchen or bathroom */}
                {roomType === 'kitchen' ? (
                    <ChefHat className="w-4 h-4 text-slate-600" />
                ) : (
                    <Bath className="w-4 h-4 text-slate-600" />
                )}
                <h5 className="font-semibold text-slate-900 text-sm">Refurb Cost</h5>

                {/* Timeline - Right side (removed DIY toggle) */}
                <div className="ml-auto flex items-center gap-1">
                    {timeline_weeks && (
                        <div className="h-6 px-2 text-xs font-medium border border-slate-300 text-slate-600 bg-white rounded flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{timeline_weeks} weeks</span>
                        </div>
                    )}
                </div>
            </div>

            {/*______________________________________________________*/}
            {/* BODY */}
            <div className="flex-1 text-xs overflow-hidden space-y-3">

                {/*______________________________________________________*/}
                {/* DESCRIPTION */}
                {detailed_description && (
                    <div className="prose prose-sm text-justify [hyphens:auto] max-w-full">
                        <p className="m-0 text-slate-700">{detailed_description}</p>
                    </div>
                )}

                {/*______________________________________________________*/}
                {/* MATERIALS LIST */}
                {Array.isArray(materials_list) && materials_list.length > 0 && (
                    <div className="space-y-1">
                        <div className="flex items-center gap-1">
                            <ToolCaseIcon className="w-5 h-5" />
                            <span className="font-medium">Materials:</span>
                        </div>
                        <div className="flex flex-wrap gap-0.5">
                            {materials_list.map((material, i) => (
                                <Badge key={i} variant="secondary" className="text-xs px-1 py-0 break-words">
                                    {material}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/*______________________________________________________*/}
                {/* COST BREAKDOWN - 2-column layout with toggles (always visible) */}
                {hasBreakdownData && (
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <ListIcon className="w-5 h-5" />
                            <span className="font-medium">Cost Breakdown:</span>
                            <span className="text-xs text-slate-600 ml-1 font-medium">
                                (click toggles to customise)
                            </span>
                        </div>
                        <div className="bg-white p-2 rounded border">
                            {/* Two-column grid layout for cost breakdown */}
                            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                                {Object.entries(breakdown).map(([category, cost]) => (
                                    <div key={category} className={`flex items-center justify-between p-1 rounded bg-slate-50 border border-slate-200 ${
                                        !costToggles[category] ? 'opacity-50 bg-red-50 border-red-200' : ''
                                    }`}>
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            {/* Toggle is always visible */}
                                            <ToggleSwitch
                                                enabled={costToggles[category] !== false}
                                                onChange={() => toggleCostItem(category)}
                                                small={true}
                                            />
                                            <span className={`capitalize text-slate-600 text-xs ${
                                                !costToggles[category] ? 'line-through' : ''
                                            }`}>
                                                {category.replace(/_/g, ' ')}:
                                            </span>
                                        </div>
                                        <span className={`font-medium text-xs ml-1 ${
                                            !costToggles[category] ? 'line-through text-slate-400' : ''
                                        }`}>
                                            {formatCurrency(cost)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Area Display & Savings Row */}
                            {(() => {
                                const areaInfo = getAreaDisplay(estimate);
                                // FIXED: Compare against original breakdown total, not estimate.total_cost
                                const hasSavings = customTotal !== originalBreakdownTotal && originalBreakdownTotal > 0;
                                const hasAreaInfo = !!areaInfo;

                                // Only show the row if we have area info OR savings
                                if (!hasAreaInfo && !hasSavings) return null;

                                return (
                                    <div className="mt-3 pt-2 border-t border-slate-200">
                                        <div className={`flex gap-2 ${hasSavings && hasAreaInfo ? '' : ''}`}>
                                            {/* Area Display */}
                                            {hasAreaInfo && (
                                                <div className={`${hasSavings ? 'flex-1' : 'w-full'}`}>
                                                    <div
                                                        className={`text-xs font-medium p-2 rounded text-center ${
                                                            areaInfo.measured ? 'text-green-800 bg-green-50' : 'text-blue-600 bg-blue-50'
                                                        }`}
                                                    >
                                                        {areaInfo.measured ? '✓' : '~'} {areaInfo.area}m²{' '}
                                                        {areaInfo.measured ? 'area measured' : 'area estimated'}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Savings */}
                                            {hasSavings && (
                                                <div className={`${hasAreaInfo ? 'flex-1' : 'w-full'}`}>
                                                    <div className="text-green-800 font-medium text-xs bg-green-50 p-2 rounded text-center">
                                                        <span>Potential Savings: </span>
                                                        <span className="font-bold">{formatCurrency(originalBreakdownTotal - customTotal)}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}

                {/*______________________________________________________*/}
                {/* LABOUR & MATERIALS */}
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
            </div>

            {/*______________________________________________________*/}
            {/* TOTAL COST */}
            <div className="mt-3 flex-shrink-0">
                <div className={`font-bold text-base px-3 py-2 w-full text-center rounded border ${
                    customTotal !== originalBreakdownTotal
                        ? 'bg-black text-white border-green-600'
                        : 'bg-black text-white'
                }`}>
                    {formatCurrency(customTotal)}
                    {customTotal !== originalBreakdownTotal && originalBreakdownTotal > 0 && (
                        <span className="text-xs ml-2 opacity-90">
                            (was {formatCurrency(originalBreakdownTotal)})
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RefurbCostEstimateCard;