
import React, { useState, useMemo, useEffect } from 'react';
import {Calculator, PoundSterling, ToolCaseIcon} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

//______________________________________________________
// FORMAT CURRENCY
//turn any input into £X,XXX with no pennies or show a dash if not a real number
const formatCurrency = (amount) => {
    const num = Number(String(amount ?? '').replace(/[^\d.-]/g, '')); //strip everything except digits, dot, minus
    if (!Number.isFinite(num)) return '—'; //not a number → show dash
    return new Intl.NumberFormat('en-GB', {
        style: 'currency', //show as money
        currency: 'GBP',   //british pounds
        maximumFractionDigits: 0, //whole pounds only
    }).format(num);
};

//______________________________________________________
// FORMAT PERCENTAGE
//show a % with + for gains and − for losses (1 decimal place)
const percentDisplay = (val) => {
    if (val == null || isNaN(val)) return '0%'; //empty → zero percent
    const sign = val > 0 ? '+' : val < 0 ? '−' : ''; //pick sign
    return `${sign}${Math.abs(val).toFixed(1)}%`; //absolute value with one decimal
};

//______________________________________________________
// LABELED NUMBER INPUT
//a small number input with an optional left icon, right suffix, and attention animation
const LabeledNumberInput = ({
                                label,
                                prefixIcon: Prefix,
                                value,
                                onChange,
                                suffix,
                                placeholder,
                                shouldHighlight = false,
                                animationType = 'pulse-border'
                            }) => {
    const [isAnimating, setIsAnimating] = useState(false); //should the input wiggle/glow

    useEffect(() => {
        if (shouldHighlight) {
            setIsAnimating(value === 0 || !value); //animate when empty or zero
        } else {
            setIsAnimating(false); //no highlight requested
        }
    }, [shouldHighlight, value]);

    //pick a css class for the chosen animation
    const getAnimationClass = () => {
        if (!isAnimating) return '';
        switch (animationType) {
            case 'gentle-shake':
                return 'animate-gentle-shake';
            case 'gentle-shake-continuous':
                return 'animate-gentle-shake-continuous';
            case 'glow':
                return 'animate-glow';
            default:
                return 'animate-pulse-border';
        }
    };

    return (
        <div className="flex flex-col">
            <label className="text-[11px] font-medium text-slate-700 mb-1">{label}</label>
            <div className="relative">
                {Prefix && (
                    <Prefix className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400" />
                )}
                <Input
                    type="number"
                    placeholder={placeholder}
                    value={value || ''}
                    onChange={(e) => onChange(parseFloat(e.target.value) || 0)} //send back a number, fall back to 0
                    className={`h-7 text-xs ${Prefix ? 'pl-7' : 'pl-2'} ${suffix ? 'pr-7' : 'pr-2'} 
                      ${(value === 0 || value === null || value === undefined) && shouldHighlight ? 'highlight-empty' : ''} 
                      ${getAnimationClass()}`}
                />
                {suffix && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">
            {suffix}
          </span>
                )}
            </div>
        </div>
    );
};

//______________________________________________________
// TOGGLE REFURB ROW
//a row with a toggle button for including a refurb and a small cost hint
const ToggleRefurbRow = ({ name, enabled, onToggle, shouldHighlight = false, isDIYMode = false, valueUpliftPercent }) => (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] ${shouldHighlight && !enabled ? 'animate-gentle-shake-continuous' : ''}`}>
        <div className="flex items-center gap-2">
            <Button
                variant={enabled ? 'default' : 'outline'}
                size="sm"
                onClick={onToggle} //flip enabled on click
                className="h-6 px-2 text-xs"
            >
                {enabled ? '✓' : '○'} {isDIYMode ? ` ${name}` : `${name}`}
            </Button>
            {enabled && valueUpliftPercent && (
                <span className="text-green-600 font-medium">+{valueUpliftPercent}%</span>
            )}
        </div>
    </div>
);


//______________________________________________________
// SUMMARY ROW
//simple label on the left and a bold value on the right
const SummaryRow = ({ label, value, valueClassName }) => (
    <div className="flex justify-between text-[12px]">
        <span className="text-slate-600">{label}</span>
        <span className={`font-medium ${valueClassName || ''}`}>{value}</span>
    </div>
);

//______________________________________________________
// COST SCENARIO CARD
//lets you enter prices, toggle refurbs, and see profit and roi
const CostScenarioCard = ({
                              property,
                              kitchenDIYMode = false,
                              bathroomDIYMode = false,
                              kitchenDIYCost,
                              bathroomDIYCost
                          }) => {
    //______________________________________________________
    // STATE
    //numbers start at 0, toggles start off
    const [purchasePrice, setPurchasePrice] = useState(0);
    const [homeReportValue, setHomeReportValue] = useState(0);
    const [expectedAdjPercent, setExpectedAdjPercent] = useState(0);
    const [includeKitchenRefurb, setIncludeKitchenRefurb] = useState(false);
    const [includeBathroomRefurb, setIncludeBathroomRefurb] = useState(false);
    const [shouldHighlightFields, setShouldHighlightFields] = useState(false);
    const [soldOverReportPercent, setSoldOverReportPercent] = useState(0);


    //turn on highlight shortly after load or when property changes
    useEffect(() => {
        const timer = setTimeout(() => {
            setShouldHighlightFields(true);
        }, 500);
        return () => clearTimeout(timer);
    }, [property]);

    //______________________________________________________
    // PARSE CONDITION ANALYSIS
    //pull out kitchen/bathroom analysis and their cost estimates + states
    const conditionAnalysis = useMemo(() => {
        if (!property?.condition_analysis) return [];
        return Array.isArray(property.condition_analysis)
            ? property.condition_analysis
            : JSON.parse(property.condition_analysis || '[]');
    }, [property?.condition_analysis]);

    const bathroomAnalysis = conditionAnalysis.find((r) => r.room_type === 'bathroom');
    const kitchenAnalysis = conditionAnalysis.find((r) => r.room_type === 'kitchen');
    const bathroomCostEstimate = bathroomAnalysis?.cost_estimate;
    const kitchenCostEstimate = kitchenAnalysis?.cost_estimate;
    const bathroomState = bathroomAnalysis?.state || 'unknown';
    const kitchenState = kitchenAnalysis?.state || 'unknown';

    //______________________________________________________
    // TOTAL REFURB COSTS - Updated to use DIY costs when available
    //add selected refurb totals together based on toggles
    const totalRefurbCosts = useMemo(() => {
        const bathCost = includeBathroomRefurb ? (
            bathroomDIYMode && bathroomDIYCost !== undefined ? bathroomDIYCost : (bathroomCostEstimate?.total_cost || 0)
        ) : 0;
        const kitCost = includeKitchenRefurb ? (
            kitchenDIYMode && kitchenDIYCost !== undefined ? kitchenDIYCost : (kitchenCostEstimate?.total_cost || 0)
        ) : 0;
        return bathCost + kitCost;
    }, [bathroomCostEstimate, kitchenCostEstimate, includeBathroomRefurb, includeKitchenRefurb, bathroomDIYMode, kitchenDIYMode, bathroomDIYCost, kitchenDIYCost]);

    const totalInvestment = purchasePrice + totalRefurbCosts; //money going in

    //______________________________________________________
    // VALUE UPLIFT RULES
    //kitchen adds +10%, bathroom adds +5% if their state says "could be refurbished"
    const kitchenEligible = includeKitchenRefurb && kitchenCostEstimate && kitchenState === 'could be refurbished';
    const bathroomEligible = includeBathroomRefurb && bathroomCostEstimate && bathroomState === 'could be refurbished';
    const addedValuePercent = useMemo(() => {
        let pct = 0; //start at 0%
        if (kitchenEligible) pct += 0.10; //+10%
        if (bathroomEligible) pct += 0.05; //+5%
        return pct;
    }, [kitchenEligible, bathroomEligible]);

    const addedValue = useMemo(() => homeReportValue * addedValuePercent, [homeReportValue, addedValuePercent]); //extra money after refurb

    // NEW CALCULATION FLOW
    const marketAdjustedHomeReport = useMemo(() => {
        // Apply market adjustment to original home report value
        return homeReportValue * (1 + (expectedAdjPercent || 0) / 100);
    }, [homeReportValue, expectedAdjPercent]);

    const adjustedHomeReportWithRefurbs = useMemo(() => {
        // Add refurb value to the market-adjusted home report
        return marketAdjustedHomeReport + addedValue;
    }, [marketAdjustedHomeReport, addedValue]);

    const finalSalePrice = useMemo(() => {
        // Apply "sold over report" to the adjusted home report value
        return adjustedHomeReportWithRefurbs * (1 + (soldOverReportPercent || 0) / 100);
    }, [adjustedHomeReportWithRefurbs, soldOverReportPercent]);

    const profit = finalSalePrice - totalInvestment; //how much you make after selling

    //return on investment in percent
    const roi = useMemo(() => {
        if (totalInvestment === 0) return 0;
        return ((finalSalePrice - totalInvestment) / totalInvestment) * 100;
    }, [finalSalePrice, totalInvestment]);

    //______________________________________________________
    // PURCHASE DIFFERENCE
    //how far the purchase is from the home report value
    const purchaseDiff = useMemo(() => purchasePrice - homeReportValue, [purchasePrice, homeReportValue]); //positive means over
    const purchaseDiffPct = useMemo(() => (homeReportValue ? (purchaseDiff / homeReportValue) * 100 : 0), [purchaseDiff, homeReportValue]); //percent difference
    const isPremium = purchaseDiff > 0; //buying over report value

    //______________________________________________________
    // UPLIFT DESCRIPTION
    //short text like "Kitchen +10%, Bathroom +5%" or "None"
    useMemo(() => {
        const parts = [];
        if (kitchenEligible) parts.push('Kitchen +10%');
        if (bathroomEligible) parts.push('Bathroom +5%');
        return parts.length > 0 ? parts.join(', ') : 'None';
    }, [kitchenEligible, bathroomEligible]);




//______________________________________________________
    // RENDER
    return (
        <div className="bg-slate-50 p-3 rounded-lg h-full flex flex-col">
            {/*______________________________________________________*/}
            {/* HEADER */}
            <div className="flex items-center gap-1 mb-3">
                <Calculator className="w-4 h-4 text-slate-600" />
                <h5 className="font-semibold text-slate-900 text-sm">Cost Scenario</h5>
            </div>

            {/* INPUTS */}
            <div className="mb-2">
                <div className="grid grid-cols-2 gap-2">
                    <LabeledNumberInput
                        label="Home Report Value"
                        prefixIcon={PoundSterling}
                        value={homeReportValue}
                        onChange={setHomeReportValue}
                        placeholder="0"
                        shouldHighlight={shouldHighlightFields}
                        animationType="gentle-shake-continuous"
                    />
                    <LabeledNumberInput
                        label="Purchase Price"
                        prefixIcon={PoundSterling}
                        value={purchasePrice}
                        onChange={setPurchasePrice}
                        placeholder="0"
                        shouldHighlight={shouldHighlightFields}
                        animationType="gentle-shake-continuous"
                    />
                    <LabeledNumberInput
                        label="Market Adjustment"
                        value={expectedAdjPercent}
                        onChange={setExpectedAdjPercent}
                        suffix="%"
                        placeholder="0"
                        shouldHighlight={shouldHighlightFields}
                        animationType="gentle-shake-continuous"
                    />
                    <LabeledNumberInput
                        label="Sold Over Home Report"
                        value={soldOverReportPercent}
                        onChange={setSoldOverReportPercent}
                        suffix="%"
                        placeholder="0"
                        shouldHighlight={shouldHighlightFields}
                        animationType="gentle-shake-continuous"
                    />
                </div>
            </div>


            <div className="flex items-center gap-1 mb-2">
                <h5 className="font-semibold text-slate-900 text-xs">Include Refurbishments:</h5>
            </div>

            {/*______________________________________________________*/}
            {/* REFURB TOGGLES */}
            <div className="mb-3">
                <div className="grid grid-cols-1 gap-2">
                    <ToggleRefurbRow
                        name="Kitchen Refurb"
                        enabled={includeKitchenRefurb}
                        onToggle={() => setIncludeKitchenRefurb(!includeKitchenRefurb)}
                        costEstimate={kitchenDIYMode && kitchenDIYCost !== undefined ? kitchenDIYCost : kitchenCostEstimate?.total_cost}
                        shouldHighlight={shouldHighlightFields}
                        isDIYMode={kitchenDIYMode}
                        valueUpliftPercent={10}
                    />
                    <ToggleRefurbRow
                        name="Bathroom Refurb"
                        enabled={includeBathroomRefurb}
                        onToggle={() => setIncludeBathroomRefurb(!includeBathroomRefurb)}
                        costEstimate={bathroomDIYMode && bathroomDIYCost !== undefined ? bathroomDIYCost : bathroomCostEstimate?.total_cost}
                        shouldHighlight={shouldHighlightFields}
                        isDIYMode={bathroomDIYMode}
                        valueUpliftPercent={5}
                    />
                </div>
            </div>

            {/*______________________________________________________*/}
            {/* SUMMARY */}
            <div className="mt-auto space-y-1">
                {/*______________________________________________________*/}
                {/* ADDED VALUE FROM REFURBS */}
                {(kitchenEligible || bathroomEligible) && homeReportValue > 0 && (
                    <div className="mb-1 p-2 rounded text-[12px] border">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-600">Est. Value Added:</span>
                            <div className="flex items-center gap-1">
                                <span className="font-medium text-green-700">
                                    {formatCurrency(addedValue)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/*______________________________________________________*/}
                {/* PURCHASE DIFFERENCE */}
                {homeReportValue > 0 && purchasePrice > 0 && (
                    <div className="mb-1 p-2 rounded text-[12px] border">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-600">Purchase vs Report:</span>
                            <div className="flex items-center gap-1">
                <span className={`font-medium ${isPremium ? 'text-red-800' : 'text-green-800'}`}>
                    {formatCurrency(Math.abs(purchaseDiff))} {isPremium ? 'over' : 'under'}
                </span>
                                <span className={`text-xs ${isPremium ? 'text-red-800' : 'text-green-800'}`}>
                    ({percentDisplay(purchaseDiffPct)})
                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="border-t pt-2">
                    <SummaryRow label="Total Investment" value={formatCurrency(totalInvestment)} />
                    <SummaryRow label="Home Report Value" value={formatCurrency(adjustedHomeReportWithRefurbs)} />
                    <SummaryRow label="Sale Price" value={formatCurrency(finalSalePrice)} />
                    <SummaryRow label="Profit" value={formatCurrency(profit)} valueClassName={profit >= 0 ? 'text-green-700' : 'text-red-700'}/>
                </div>
            </div>
            {/* NOTE */}
            <div className="mt-2 text-[10px] text-slate-600 text-justify">
                (Note: Calculations exclude additional costs such as legal fees,
                stamp duty, surveys, and agency charges. The uplift is fixed at 5–10%,
                though actual values vary by property.)
            </div>

            {/*______________________________________________________*/}
            {/* ROI BADGE */}
            <div className="mt-3 flex-shrink-0">
                <div
                    className={`font-bold text-base px-3 py-2 w-full text-center rounded border ${
                        roi >= 0
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : 'bg-red-100 text-red-800 border-red-200'
                    }`}
                >
                    {roi.toFixed(1)}% ROI
                </div>
            </div>

        </div>
    );
};

export default CostScenarioCard;
