import React, { useState, useMemo, useEffect } from 'react';
import { Calculator, PoundSterling } from 'lucide-react';
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
const ToggleRefurbRow = ({ name, enabled, onToggle, costEstimate, shouldHighlight = false }) => (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] ${shouldHighlight && !enabled ? 'animate-gentle-shake-continuous' : ''}`}>
        <div className="flex items-center gap-2">
            <Button
                variant={enabled ? 'default' : 'outline'}
                size="sm"
                onClick={onToggle} //flip enabled on click
                className="h-6 px-2 text-xs"
            >
                {enabled ? '✓' : '○'} {name}
            </Button>
            {typeof costEstimate === 'number' && (
                <span className="text-slate-500">{formatCurrency(costEstimate)}</span>
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
const CostScenarioCard = ({ property }) => {
    //______________________________________________________
    // STATE
    //numbers start at 0, toggles start off
    const [purchasePrice, setPurchasePrice] = useState(0);
    const [homeReportValue, setHomeReportValue] = useState(0);
    const [expectedAdjPercent, setExpectedAdjPercent] = useState(0);
    const [includeKitchenRefurb, setIncludeKitchenRefurb] = useState(false);
    const [includeBathroomRefurb, setIncludeBathroomRefurb] = useState(false);
    const [shouldHighlightFields, setShouldHighlightFields] = useState(false);

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
    // TOTAL REFURB COSTS
    //add selected refurb totals together based on toggles
    const totalRefurbCosts = useMemo(() => {
        const bathCost = includeBathroomRefurb && bathroomCostEstimate?.total_cost ? bathroomCostEstimate.total_cost : 0;
        const kitCost = includeKitchenRefurb && kitchenCostEstimate?.total_cost ? kitchenCostEstimate.total_cost : 0;
        return bathCost + kitCost;
    }, [bathroomCostEstimate, kitchenCostEstimate, includeBathroomRefurb, includeKitchenRefurb]);

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
    const expectedBaseValue = useMemo(() => homeReportValue + addedValue, [homeReportValue, addedValue]); //new value before market tweak
    const finalExpectedValue = useMemo(
        () => expectedBaseValue * (1 + (expectedAdjPercent || 0) / 100), //apply market % up or down
        [expectedBaseValue, expectedAdjPercent]
    );

    const profit = finalExpectedValue - totalInvestment; //how much you make after selling

    //return on investment in percent
    const roi = useMemo(() => {
        if (totalInvestment === 0) return 0;
        return ((finalExpectedValue - totalInvestment) / totalInvestment) * 100;
    }, [finalExpectedValue, totalInvestment]);

    //______________________________________________________
    // PURCHASE DIFFERENCE
    //how far the purchase is from the home report value
    const purchaseDiff = useMemo(() => purchasePrice - homeReportValue, [purchasePrice, homeReportValue]); //positive means over
    const purchaseDiffPct = useMemo(() => (homeReportValue ? (purchaseDiff / homeReportValue) * 100 : 0), [purchaseDiff, homeReportValue]); //percent difference
    const isPremium = purchaseDiff > 0; //buying over report value

    //______________________________________________________
    // UPLIFT DESCRIPTION
    //short text like "Kitchen +10%, Bathroom +5%" or "None"
    const upliftDescription = useMemo(() => {
        const parts = [];
        if (kitchenEligible) parts.push('Kitchen +10%');
        if (bathroomEligible) parts.push('Bathroom +5%');
        return parts.length > 0 ? parts.join(', ') : 'None';
    }, [kitchenEligible, bathroomEligible]);

    //______________________________________________________
    // NO PROPERTY DATA
    if (!property) {
        return (
            <div className="h-full bg-slate-50 p-3 rounded-lg flex flex-col items-center justify-center">
                <Calculator className="w-8 h-8 text-slate-400 mb-2" />
                <p className="text-sm text-slate-500 font-medium text-center">
                    No property data
                </p>
            </div>
        );
    }

    //______________________________________________________
    // JSX
    //build the card ui with inputs, toggles, and results
    return (
        <div className="h-full bg-slate-50 p-3 rounded-lg flex flex-col text-xs">

            {/*______________________________________________________*/}
            {/* HEADER */}
            <div className="flex items-center gap-2 mb-2">
                <Calculator className="w-4 h-4 text-slate-600" />
                <h5 className="font-semibold text-slate-900 text-sm">ROI Scenario</h5>
            </div>

            {/*______________________________________________________*/}
            {/* INPUTS & TOGGLES WRAPPER */}
            <div className="flex-1 flex flex-col gap-3 min-h-0">

                {/*______________________________________________________*/}
                {/* PRICE INPUTS */}
                <div className="grid grid-cols-2 gap-2">
                    <LabeledNumberInput
                        label="Home Report Value"
                        prefixIcon={PoundSterling}
                        value={homeReportValue}
                        onChange={setHomeReportValue}
                        shouldHighlight={shouldHighlightFields}
                        animationType="gentle-shake-continuous"
                    />
                    <div>
                        <LabeledNumberInput
                            label="Purchase Price"
                            prefixIcon={PoundSterling}
                            value={purchasePrice}
                            onChange={setPurchasePrice}
                            shouldHighlight={shouldHighlightFields}
                            animationType="gentle-shake-continuous"
                        />
                        {homeReportValue > 0 && (
                            <div className="mt-1">
                                {isPremium ? (
                                    <div className="text-red-600 text-[10px]">
                                        {percentDisplay(purchaseDiffPct)} Over Home Report
                                    </div>
                                ) : (
                                    <div className="text-green-600 text-[10px]">
                                        {percentDisplay(-purchaseDiffPct)} Under Home Report
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/*______________________________________________________*/}
                {/* REFURB TOGGLES */}
                {(kitchenCostEstimate || bathroomCostEstimate) && (
                    <div className="bg-white">
                        <div className="font-bold mb-1">Include Refurb</div>
                        <div className="grid grid-cols-2 gap-2">
                            {kitchenCostEstimate && (
                                <ToggleRefurbRow
                                    name="Kitchen"
                                    enabled={includeKitchenRefurb}
                                    onToggle={() => setIncludeKitchenRefurb((v) => !v)}
                                    costEstimate={kitchenCostEstimate?.total_cost}
                                    shouldHighlight={shouldHighlightFields}
                                />
                            )}
                            {bathroomCostEstimate && (
                                <ToggleRefurbRow
                                    name="Bathroom"
                                    enabled={includeBathroomRefurb}
                                    onToggle={() => setIncludeBathroomRefurb((v) => !v)}
                                    costEstimate={bathroomCostEstimate?.total_cost}
                                    shouldHighlight={shouldHighlightFields}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/*______________________________________________________*/}
                {/* ADDED VALUE & MARKET ADJUSTMENT */}
                <div className="grid grid-cols-1 gap-2">
                    <div className="bg-white p-2 rounded">
                        <div className="flex justify-between">
                            <div className="font-bold">Est. Value Added</div>
                            <div className="font-bold">{formatCurrency(addedValue)}</div>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                            Uplift: {upliftDescription} ({percentDisplay(addedValuePercent * 100)})
                        </div>
                    </div>
                    <div className="bg-white p-2 rounded">
                        <LabeledNumberInput
                            label="If Sold Over Home Report Value by:"
                            value={expectedAdjPercent}
                            onChange={setExpectedAdjPercent}
                            suffix="%"
                            shouldHighlight={shouldHighlightFields}
                            animationType="gentle-shake-continuous"
                        />
                    </div>
                </div>

                {/*______________________________________________________*/}
                {/* SUMMARY NUMBERS */}
                <div className="bg-white p-2 rounded space-y-1">
                    <SummaryRow label="Total Investment" value={formatCurrency(totalInvestment)} />
                    <SummaryRow label="Home Report Value" value={formatCurrency(expectedBaseValue)} />
                    <SummaryRow label="Sale Price" value={formatCurrency(finalExpectedValue)} />
                    <SummaryRow label="Profit" value={formatCurrency(profit)} valueClassName={profit >= 0 ? 'text-green-700' : 'text-red-700'}/>
                </div>
            </div>

            {/* NOTE */}
            <div className="mt-2 text-xxs text-slate-600 text-justify">
                (Note: Calculations exclude additional purchase costs such as legal fees,
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


