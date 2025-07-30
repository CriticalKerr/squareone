import React, { useState, useEffect } from 'react';
import { Calculator, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const ROICalculator = ({ property }) => {
    const [purchasePrice, setPurchasePrice] = useState(0);
    const [kitchenCost, setKitchenCost] = useState(15000);
    const [bathroomCost, setBathroomCost] = useState(8000);
    const [otherCosts, setOtherCosts] = useState(5000);
    const [expectedValue, setExpectedValue] = useState(0);
    const [roi, setROI] = useState(0);

    // Extract numeric value from price string and calculate expected value
    useEffect(() => {
        const numericPrice = parseInt(property.price.replace(/[£,]/g, ''), 10);
        setPurchasePrice(numericPrice);

        let valueIncrease = 0;
        if (property.kitchenCondition === 'old') valueIncrease += 0.08;
        if (property.bathroomCondition === 'old') valueIncrease += 0.05;

        setExpectedValue(numericPrice * (1 + valueIncrease));
    }, [property]);

    // Calculate ROI whenever inputs change
    useEffect(() => {
        const totalCosts =
            purchasePrice +
            (property.kitchenCondition === 'old' ? kitchenCost : 0) +
            (property.bathroomCondition === 'old' ? bathroomCost : 0) +
            otherCosts;

        const profit = expectedValue - totalCosts;
        const roiPercentage = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;
        setROI(roiPercentage);
    }, [purchasePrice, kitchenCost, bathroomCost, otherCosts, expectedValue, property]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: 'GBP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const totalRefurbCost =
        (property.kitchenCondition === 'old' ? kitchenCost : 0) +
        (property.bathroomCondition === 'old' ? bathroomCost : 0) +
        otherCosts;

    const totalInvestment = purchasePrice + totalRefurbCost;
    const projectedProfit = expectedValue - totalInvestment;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-slate-700" />
                <h3 className="text-xl font-bold text-slate-900">ROI & Refurbishment Calculator</h3>
            </div>

            {/* Current Property Status */}
            <div className="bg-slate-50 p-4 rounded-lg">
                <h4 className="font-semibold text-slate-700 mb-3">Current Property Status</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-slate-600">Purchase Price</p>
                        <p className="font-bold text-lg">{property.price}</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-600">Size</p>
                        <p className="font-bold text-lg">{property.sqft} sqft</p>
                    </div>
                </div>
                <div className="flex gap-2 mt-3">
                    <Badge variant={property.kitchenCondition === 'new' ? 'default' : 'secondary'}>
                        Kitchen: {property.kitchenCondition}
                    </Badge>
                    <Badge variant={property.bathroomCondition === 'new' ? 'default' : 'secondary'}>
                        Bathroom: {property.bathroomCondition}
                    </Badge>
                </div>
            </div>

            {/* Refurbishment Costs */}
            <div className="space-y-4">
                <h4 className="font-semibold text-slate-700">Refurbishment Costs</h4>

                {property.kitchenCondition === 'old' && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Kitchen Renovation
                        </label>
                        <Input
                            type="number"
                            value={kitchenCost}
                            onChange={(e) => setKitchenCost(Number(e.target.value))}
                            className="w-full"
                        />
                    </div>
                )}

                {property.bathroomCondition === 'old' && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Bathroom Renovation
                        </label>
                        <Input
                            type="number"
                            value={bathroomCost}
                            onChange={(e) => setBathroomCost(Number(e.target.value))}
                            className="w-full"
                        />
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Other Costs (flooring, painting, etc.)
                    </label>
                    <Input
                        type="number"
                        value={otherCosts}
                        onChange={(e) => setOtherCosts(Number(e.target.value))}
                        className="w-full"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Expected Property Value After Refurb
                    </label>
                    <Input
                        type="number"
                        value={expectedValue}
                        onChange={(e) => setExpectedValue(Number(e.target.value))}
                        className="w-full"
                    />
                </div>
            </div>

            {/* Results */}
            <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Investment Summary
                </h4>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-slate-600">Total Investment</p>
                        <p className="font-bold text-lg">{formatCurrency(totalInvestment)}</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-600">Refurb Costs</p>
                        <p className="font-bold text-lg">{formatCurrency(totalRefurbCost)}</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-600">Expected Value</p>
                        <p className="font-bold text-lg">{formatCurrency(expectedValue)}</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-600">Projected Profit</p>
                        <p className={`font-bold text-lg ${projectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(projectedProfit)}
                        </p>
                    </div>
                </div>

                <div className="border-t pt-3">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700">Return on Investment (ROI)</span>
                        <span className={`text-2xl font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {roi.toFixed(1)}%
            </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ROICalculator;
