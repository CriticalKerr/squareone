//______________________________________________________
// IMPORTS
// React, icons, and Badge UI
import React from 'react';
import { ChefHat, Bath, Clock, ToolCaseIcon, ListIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

//______________________________________________________
// FORMAT CURRENCY
// Turn a number into a British pound string or show ‘—’ if it’s not a number
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
// COST ESTIMATE CARD COMPONENT
// Show cost details for a room, or a message if there’s no estimate
const RefurbCostEstimateCard = ({ estimate, roomType }) => {
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

    // Pull fields we’ll display
    // These are the parts of the estimate we show on the card
    const {
        total_cost,             //total price for the job
        timeline_weeks,         //how many weeks the job may take
        detailed_description,   //a short paragraph about the work
        materials_list,         //list of materials used
        breakdown,              //object with costs per category
        labor_cost,             //cost for people doing the work
        material_cost,          //cost for the materials
    } = estimate;

    //______________________________________________________
    // JAVASCRIPT
    // Build the UI card
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
            </div>

            {/*______________________________________________________*/}
            {/* BODY */}
            <div className="flex-1 text-xs overflow-hidden space-y-3">
                {/*______________________________________________________*/}
                {/* TIMELINE */}
                {/* show how long the job might take if we know it */}
                {timeline_weeks && (
                    <div className="flex items-center gap-1">
                        <Clock className="w-5 h-5" />
                        <span className="font-medium">{timeline_weeks} weeks</span>
                    </div>
                )}

                {/*______________________________________________________*/}
                {/* DESCRIPTION */}
                {/* short text that explains the work */}
                {detailed_description && (
                    <div className="prose prose-sm text-justify [hyphens:auto] max-w-full">
                        <p className="m-0 text-slate-700">{detailed_description}</p>
                    </div>
                )}

                {/*______________________________________________________*/}
                {/* MATERIALS LIST */}
                {/* show small badges for each material */}
                {Array.isArray(materials_list) && materials_list.length > 0 && (
                    <div className="space-y-1">
                        <div className="flex items-center gap-1">
                            <ToolCaseIcon className="w-5 h-5" />
                            <span className="font-medium">Materials:</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {materials_list.map((material, i) => (
                                <Badge key={i} variant="secondary" className="text-xs px-1 py-0 break-words">
                                    {material}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/*______________________________________________________*/}
                {/* COST BREAKDOWN */}
                {/* list out each category and its cost side by side */}
                {breakdown && Object.keys(breakdown).length > 0 && (
                    <div className="space-y-1">
                        <div className="flex items-center gap-1">
                            <ListIcon className="w-5 h-5" />
                            <span className="space-y-1 font-medium">Cost Breakdown:</span>
                        </div>
                        <div className="bg-white p-1.5 rounded">
                            {/* two columns so it is easy to scan */}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                                {Object.entries(breakdown).map(([category, cost]) => (
                                    <div key={category} className="flex justify-between">
                                        {/* make the category name look nice by replacing underscores with spaces */}
                                        <span className="capitalize text-slate-600">
                                            {category.replace(/_/g, ' ')}:
                                        </span>
                                        {/* show the cost as pounds */}
                                        <span className="font-medium">{formatCurrency(cost)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/*______________________________________________________*/}
                {/* AREA DISPLAY (✓ measured, ~ estimated) */}
                {/* green means measured, blue means estimated */}
                {(() => {
                    const areaInfo = getAreaDisplay(estimate); //get the best area to show
                    return areaInfo ? (
                        <div
                            className={`text-xs font-medium p-1 rounded text-center ${
                                areaInfo.measured ? 'text-green-600 bg-green-50' : 'text-blue-600 bg-blue-50'
                            }`}
                        >
                            {/* tick for measured, tilde for estimated */}
                            {areaInfo.measured ? '✓' : '~'} {areaInfo.area}m²{' '}
                            {areaInfo.measured ? 'area measured' : 'area estimated'}
                        </div>
                    ) : null;
                })()}

                {/*______________________________________________________*/}
                {/* LABOUR & MATERIALS */}
                {/* small chips that show the separate labour and materials costs */}
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
            {/* big number at the bottom so the final price is easy to see */}
            <div className="mt-3 flex-shrink-0">
                <div className="font-bold text-base px-3 py-2 w-full text-center rounded border bg-black text-white">
                    {formatCurrency(total_cost)}
                </div>
            </div>
        </div>
    );
};

export default RefurbCostEstimateCard; //make the component available to other files

