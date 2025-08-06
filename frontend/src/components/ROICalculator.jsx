import React, { useState, useMemo } from 'react';
import { Calculator,PoundSterling, Home, Target } from 'lucide-react'; // Icons for calc, trends, currency, home, target
import { Input } from '@/components/ui/input';  // Styled input box component
import { Badge } from '@/components/ui/badge'; // Badge component for labels

//______________________________________________________
// ROI CALCULATOR COMPONENT
// Show investment analysis for a property
export default function ROICalculator({ property }) {

    //______________________________________________________
    // STATE FOR INPUTS
    // Track purchase price and home report value entered by user
    const [purchasePrice, setPurchasePrice] = useState(() => {
        // Remove £ and commas, convert to number
        const cleaned = property?.price?.replace(/£|,/g, '') || '0';
        return parseFloat(cleaned) || 0;
    });
    const [homeReportValue, setHomeReportValue] = useState(0);

    //______________________________________________________
    // PARSE CONDITION ANALYSIS
    // Get bathroom and kitchen AI analysis from property data
    const conditionAnalysis = Array.isArray(property?.condition_analysis)
        ? property.condition_analysis
        : JSON.parse(property?.condition_analysis || '[]');

    const bathroomAnalysis = conditionAnalysis.find(r => r.room_type === 'bathroom');
    const kitchenAnalysis = conditionAnalysis.find(r => r.room_type === 'kitchen');
    const bathroomCostEstimate = bathroomAnalysis?.cost_estimate;
    const kitchenCostEstimate = kitchenAnalysis?.cost_estimate;

    //______________________________________________________
    // CHECK IF ROOMS NEED REFURB
    // Rooms that are not 'new/renovated' need work
    const bathroomNeedsRefurb = bathroomAnalysis?.state !== 'new/renovated';
    const kitchenNeedsRefurb = kitchenAnalysis?.state !== 'new/renovated';

    //______________________________________________________
    // CALCULATE TOTAL REFURB COSTS
    // Sum AI cost estimates for rooms needing work
    const totalRefurbCosts = useMemo(() => {
        const bathroomCost = (bathroomNeedsRefurb && bathroomCostEstimate?.total_cost) || 0;
        const kitchenCost = (kitchenNeedsRefurb && kitchenCostEstimate?.total_cost) || 0;
        return bathroomCost + kitchenCost;
    }, [bathroomCostEstimate, kitchenCostEstimate, bathroomNeedsRefurb, kitchenNeedsRefurb]);

    //______________________________________________________
    // CALCULATE VALUE INCREASE
    // 5% for bathroom, 10% for kitchen, applied to home report value
    const valueIncrease = useMemo(() => {
        let increase = 0;
        if (homeReportValue > 0) {
            if (bathroomNeedsRefurb) increase += homeReportValue * 0.05; // 5% for bathroom
            if (kitchenNeedsRefurb) increase += homeReportValue * 0.10; // 10% for kitchen
        }
        return increase;
    }, [homeReportValue, bathroomNeedsRefurb, kitchenNeedsRefurb]);

    // Calculate refurbed value (home report + value increase)
    const refurbedValue = homeReportValue + valueIncrease;

    // Calculate total investment (purchase + refurb costs)
    const totalInvestment = purchasePrice + totalRefurbCosts;

    // Calculate ROI (Refurbed Value - Total Investment)
    const roi = refurbedValue - totalInvestment;

    // Calculate ROI percentage
    useMemo(() => {
        if (totalInvestment === 0) return 0;
        return (roi / totalInvestment) * 100;
    }, [roi, totalInvestment]);
//______________________________________________________
    // FORMATTER FOR CURRENCY
    const formatCurrency = (amount) => `£${amount?.toLocaleString() || '0'}`;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <Calculator className="w-5 h-5 text-slate-600" />
                <h4 className="font-semibold text-slate-900">Investment Analysis</h4>
            </div>

            {/*______________________________________________________*/}
            {/* USER INPUTS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Purchase Price Input */}
                <div className="space-y-2">
                    <label htmlFor="purchasePrice" className="text-sm font-medium block text-slate-700">
                        Purchase Price
                    </label>
                    <div className="relative">
                        <PoundSterling className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            id="purchasePrice"
                            type="number"
                            placeholder="Enter purchase price"
                            value={purchasePrice || ''}
                            onChange={e => setPurchasePrice(parseFloat(e.target.value) || 0)}
                            className="pl-10"
                        />
                    </div>
                </div>

                {/* Home Report Value Input */}
                <div className="space-y-2">
                    <label htmlFor="homeReportValue" className="text-sm font-medium block text-slate-700">
                        Home Report Value
                    </label>
                    <div className="relative">
                        <Home className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            id="homeReportValue"
                            type="number"
                            placeholder="Enter home report value"
                            value={homeReportValue || ''}
                            onChange={e => setHomeReportValue(parseFloat(e.target.value) || 0)}
                            className="pl-10"
                        />
                    </div>
                </div>
            </div>

            {/*______________________________________________________*/}
            {/* INVESTMENT BREAKDOWN */}
            <div className="bg-slate-50 p-6 rounded-lg space-y-4">
                <h5 className="font-semibold text-slate-900 mb-3">Investment Breakdown</h5>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Investment Side */}
                    <div className="space-y-3">
                        <h6 className="text-sm font-medium text-slate-700 mb-2">Investment</h6>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-600">Purchase Price:</span>
                                <span className="font-medium">{formatCurrency(purchasePrice)}</span>
                            </div>
                            {bathroomNeedsRefurb && bathroomCostEstimate && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Bathroom Refurb:</span>
                                    <span className="font-medium">{formatCurrency(bathroomCostEstimate.total_cost)}</span>
                                </div>
                            )}
                            {kitchenNeedsRefurb && kitchenCostEstimate && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Kitchen Refurb:</span>
                                    <span className="font-medium">{formatCurrency(kitchenCostEstimate.total_cost)}</span>
                                </div>
                            )}
                            <div className="flex justify-between border-t pt-2 font-semibold">
                                <span className="text-slate-900">Total Investment:</span>
                                <span className="text-slate-900">{formatCurrency(totalInvestment)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Value Side */}
                    <div className="space-y-3">
                        <h6 className="text-sm font-medium text-slate-700 mb-2">Value</h6>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-600">Home Report Value:</span>
                                <span className="font-medium">{formatCurrency(homeReportValue)}</span>
                            </div>
                            {valueIncrease > 0 && (
                                <>
                                    {bathroomNeedsRefurb && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Bathroom (+5%):</span>
                                            <span className="font-medium text-green-600">+{formatCurrency(homeReportValue * 0.05)}</span>
                                        </div>
                                    )}
                                    {kitchenNeedsRefurb && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Kitchen (+10%):</span>
                                            <span className="font-medium text-green-600">+{formatCurrency(homeReportValue * 0.10)}</span>
                                        </div>
                                    )}
                                </>
                            )}
                            <div className="flex justify-between border-t pt-2 font-semibold">
                                <span className="text-slate-900">Refurbed Value:</span>
                                <span className="text-slate-900">{formatCurrency(refurbedValue)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}