import React, { useState, useMemo } from 'react';
import { Calculator, PoundSterling } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

//______________________________________________________
// FORMAT CURRENCY
// Turn a number into a British pound string or show ‘—’ if it’s not valid
const formatCurrency = (amount) => {
    const num = Number(String(amount ?? '').replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(num)) return '—';
    return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        maximumFractionDigits: 0,
    }).format(num);
};

//______________________________________________________
// FORMAT PERCENTAGE
// Show a percent with +/− sign and one decimal place
const percentDisplay = (val) => {
    if (val == null || isNaN(val)) return '0%';
    const sign = val > 0 ? '+' : val < 0 ? '−' : '';
    return `${sign}${Math.abs(val).toFixed(1)}%`;
};

//______________________________________________________
// Labeled Number Input Component
// Input with a label, optional icon, and suffix inside the box
const LabeledNumberInput = ({ label, prefixIcon: Prefix, value, onChange, suffix, placeholder }) => (
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
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                className={`h-7 text-xs ${Prefix ? 'pl-7' : 'pl-2'} ${suffix ? 'pr-7' : 'pr-2'}`}
            />
            {suffix && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">
          {suffix}
        </span>
            )}
        </div>
    </div>
);

//______________________________________________________
// Toggle Refurb Row Component
// Button to include/exclude kitchen or bathroom refurb, shows cost
const ToggleRefurbRow = ({ name, enabled, onToggle, costEstimate }) => (
    <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2">
            <Button
                variant={enabled ? 'default' : 'outline'}
                size="sm"
                onClick={onToggle}
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
// Summary Row Component
// Show a label and value side by side
const SummaryRow = ({ label, value, valueClassName }) => (
    <div className="flex justify-between text-[12px]">
        <span className="text-slate-600">{label}</span>
        <span className={`font-medium ${valueClassName || ''}`}>{value}</span>
    </div>
);

//______________________________________________________
// CostScenarioCard Component
// Main card showing purchase, refurb, and ROI calculations
const CostScenarioCard = ({ property }) => {

    //____________________________________________________
    // STATE SETUP
    const [purchasePrice, setPurchasePrice] = useState(() => {
        if (!property?.price) return 0;
        const cleaned = property.price.replace(/[£,\s]/g, '');
        return parseFloat(cleaned) || 0;
    });
    const [homeReportValue, setHomeReportValue] = useState(0);
    const [expectedAdjPercent, setExpectedAdjPercent] = useState(0);
    const [includeKitchenRefurb, setIncludeKitchenRefurb] = useState(true);
    const [includeBathroomRefurb, setIncludeBathroomRefurb] = useState(true);

    //______________________________________________________
    // PARSE CONDITION ANALYSIS
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
    // CALCULATE TOTAL REFURB COSTS
    const totalRefurbCosts = useMemo(() => {
        const bathCost = includeBathroomRefurb && bathroomCostEstimate?.total_cost ? bathroomCostEstimate.total_cost : 0;
        const kitCost = includeKitchenRefurb && kitchenCostEstimate?.total_cost ? kitchenCostEstimate.total_cost : 0;
        return bathCost + kitCost;
    }, [bathroomCostEstimate, kitchenCostEstimate, includeBathroomRefurb, includeKitchenRefurb]);

    const totalInvestment = purchasePrice + totalRefurbCosts;

    //______________________________________________________
    // DETERMINE ELIGIBILITY FOR VALUE UPLIFT
    const kitchenEligible = includeKitchenRefurb && kitchenCostEstimate && kitchenState === 'could be refurbished';
    const bathroomEligible = includeBathroomRefurb && bathroomCostEstimate && bathroomState === 'could be refurbished';
    const addedValuePercent = useMemo(() => {
        let pct = 0;
        if (kitchenEligible) pct += 0.10;
        if (bathroomEligible) pct += 0.05;
        return pct;
    }, [kitchenEligible, bathroomEligible]);

    const addedValue = useMemo(() => homeReportValue * addedValuePercent, [homeReportValue, addedValuePercent]);
    const expectedBaseValue = useMemo(() => homeReportValue + addedValue, [homeReportValue, addedValue]);
    const finalExpectedValue = useMemo(
        () => expectedBaseValue * (1 + (expectedAdjPercent || 0) / 100),
        [expectedBaseValue, expectedAdjPercent]
    );

    const profit = finalExpectedValue - totalInvestment;

    const roi = useMemo(() => {
        if (totalInvestment === 0) return 0;
        return ((finalExpectedValue - totalInvestment) / totalInvestment) * 100;
    }, [finalExpectedValue, totalInvestment]);

    //______________________________________________________
    // PURCHASE DIFFERENCE
    const purchaseDiff = useMemo(() => purchasePrice - homeReportValue, [purchasePrice, homeReportValue]);
    const purchaseDiffPct = useMemo(() => (homeReportValue ? (purchaseDiff / homeReportValue) * 100 : 0), [purchaseDiff, homeReportValue]);
    const isPremium = purchaseDiff > 0;

    //______________________________________________________
    // UPLIFT DESCRIPTION TEXT
    const upliftDescription = useMemo(() => {
        const parts = [];
        if (kitchenEligible) parts.push('Kitchen +10%');
        if (bathroomEligible) parts.push('Bathroom +5%');
        return parts.length > 0 ? parts.join(', ') : 'None';
    }, [kitchenEligible, bathroomEligible]);

    //______________________________________________________
    // NO PROPERTY DATA CHECK
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
    // RENDER CARD
    return (
        <div className="h-full bg-slate-50 p-3 rounded-lg flex flex-col text-xs">

            {/* Header with icon and title */}
            <div className="flex items-center gap-2 mb-2">
                <Calculator className="w-4 h-4 text-slate-600" />
                <h5 className="font-semibold text-slate-900 text-sm">Investment ROI</h5>
            </div>

            {/* Input fields and toggles */}
            <div className="flex-1 flex flex-col gap-3 min-h-0">

                {/* Price inputs */}
                <div className="grid grid-cols-2 gap-2">
                    <LabeledNumberInput
                        label="Home Report Value"
                        prefixIcon={PoundSterling}
                        value={homeReportValue}
                        onChange={setHomeReportValue}
                        placeholder="Report value"
                    />
                    <div>
                        <LabeledNumberInput
                            label="Purchase Price"
                            prefixIcon={PoundSterling}
                            value={purchasePrice}
                            onChange={setPurchasePrice}
                            placeholder="Purchase"
                        />
                        {homeReportValue > 0 && (
                            <div className="mt-1">
                                {isPremium ? (
                                    <div className="text-red-600 text-[11px]">
                                        Premium {percentDisplay(purchaseDiffPct)}
                                    </div>
                                ) : (
                                    <div className="text-green-600 text-[11px]">
                                        Discount {percentDisplay(-purchaseDiffPct)}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Refurb Toggles */}
                {(kitchenCostEstimate || bathroomCostEstimate) && (
                    <div className="bg-white p-2 rounded space-y-1">
                        <div className="font-medium mb-1">Include Refurb</div>
                        {kitchenCostEstimate && (
                            <ToggleRefurbRow
                                name="Kitchen"
                                enabled={includeKitchenRefurb}
                                onToggle={() => setIncludeKitchenRefurb((v) => !v)}
                                costEstimate={kitchenCostEstimate?.total_cost}
                            />
                        )}
                        {bathroomCostEstimate && (
                            <ToggleRefurbRow
                                name="Bathroom"
                                enabled={includeBathroomRefurb}
                                onToggle={() => setIncludeBathroomRefurb((v) => !v)}
                                costEstimate={bathroomCostEstimate?.total_cost}
                            />
                        )}
                    </div>
                )}

                {/* Added value + adjustment */}
                <div className="grid grid-cols-1 gap-2">
                    <div className="bg-white p-2 rounded">
                        <div className="flex justify-between">
                            <div className="font-medium">Added Value</div>
                            <div className="font-medium">{formatCurrency(addedValue)}</div>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                            Uplift: {upliftDescription} ({percentDisplay(addedValuePercent * 100)})
                        </div>
                    </div>
                    <div className="bg-white p-2 rounded">
                        <LabeledNumberInput
                            label="Expected Adjustment"
                            value={expectedAdjPercent}
                            onChange={setExpectedAdjPercent}
                            placeholder="Extra %"
                            suffix="%"
                        />
                    </div>
                </div>

                {/* Summary */}
                <div className="bg-white p-2 rounded space-y-1">
                    <SummaryRow label="Total Investment" value={formatCurrency(totalInvestment)} />
                    <SummaryRow label="Expected Base" value={formatCurrency(expectedBaseValue)} />
                    <SummaryRow label="Final Expected" value={formatCurrency(finalExpectedValue)} />
                    <SummaryRow
                        label="Profit"
                        value={formatCurrency(profit)}
                        valueClassName={profit >= 0 ? 'text-green-700' : 'text-red-700'}
                    />
                </div>
            </div>

            {/* ROI badge */}
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
