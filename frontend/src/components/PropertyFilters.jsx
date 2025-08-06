import React, { useState } from 'react';
import { Sparkles, Wrench, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

//______________________________________________________
// PROPERTY FILTERS COMPONENT
// Show a button to toggle filters and a dropdown to pick kitchen/bathroom conditions
const PropertyFilters = ({ onFiltersChange, currentFilters = {} }) => {

    //______________________________________________________
    // EXPAND TOGGLE STATE
    // Track if the filter dropdown is open or closed
    const [isExpanded, setIsExpanded] = useState(false);

    //______________________________________________________
    // FILTERS STATE
    // Keep track of selected filter values, default to 'all'
    const [filters, setFilters] = useState({
        kitchenCondition: currentFilters.kitchenCondition || 'all',
        bathroomCondition: currentFilters.bathroomCondition || 'all',
        ...currentFilters
    });

    //______________________________________________________
    // HANDLE FILTER CHANGE
    // Update state and notify parent when a filter button is clicked
    const handleFilterChange = (filterType, value) => {
        const newFilters = {
            ...filters,
            [filterType]: value
        };
        setFilters(newFilters);
        onFiltersChange(newFilters);
    };

    //______________________________________________________
    // CLEAR FILTERS
    // Reset both filters back to 'all' and notify parent
    const clearFilters = () => {
        const clearedFilters = {
            kitchenCondition: 'all',
            bathroomCondition: 'all'
        };
        setFilters(clearedFilters);
        onFiltersChange(clearedFilters);
    };

    //______________________________________________________
    // COUNT ACTIVE FILTERS
    // Count how many filters are not 'all' to show a badge
    const getActiveFilterCount = () => {
        let count = 0;
        if (filters.kitchenCondition !== 'all') count++;
        if (filters.bathroomCondition !== 'all') count++;
        return count;
    };

    return (
        <div className="relative">

            {/*______________________________________________________*/}
            {/* FILTER TOGGLE BUTTON */}
            <Button
                variant="outline"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 relative"
            >
                <Filter className="w-4 h-4" />
                Filter
                {getActiveFilterCount() > 0 && (
                    <Badge variant="default" className="ml-1 px-1.5 py-0.5 text-xs">
                        {getActiveFilterCount()}
                    </Badge>
                )}
            </Button>

            {/*______________________________________________________*/}
            {/* FILTER DROPDOWN */}
            {isExpanded && (
                <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg p-4 z-50 min-w-80">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-900">Filter Properties</h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsExpanded(false)}
                            className="p-1"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    {/*______________________________________________________*/}
                    {/* KITCHEN CONDITION FILTER */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Kitchen Condition
                        </label>
                        <div className="flex gap-2">
                            <Button
                                variant={filters.kitchenCondition === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleFilterChange('kitchenCondition', 'all')}
                                className="flex items-center gap-1"
                            >
                                All
                            </Button>
                            <Button
                                variant={filters.kitchenCondition === 'new/renovated' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleFilterChange('kitchenCondition', 'new/renovated')}
                                className="flex items-center gap-1"
                            >
                                <Sparkles className="w-3 h-3" />
                                New/Renovated
                            </Button>
                            <Button
                                variant={filters.kitchenCondition === 'could be refurbished' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleFilterChange('kitchenCondition', 'could be refurbished')}
                                className="flex items-center gap-1"
                            >
                                <Wrench className="w-3 h-3" />
                                Could be Refurbished
                            </Button>
                        </div>
                    </div>

                    {/*______________________________________________________*/}
                    {/* BATHROOM CONDITION FILTER */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Bathroom Condition
                        </label>
                        <div className="flex gap-2">
                            <Button
                                variant={filters.bathroomCondition === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleFilterChange('bathroomCondition', 'all')}
                                className="flex items-center gap-1"
                            >
                                All
                            </Button>
                            <Button
                                variant={filters.bathroomCondition === 'new/renovated' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleFilterChange('bathroomCondition', 'new/renovated')}
                                className="flex items-center gap-1"
                            >
                                <Sparkles className="w-3 h-3" />
                                New/Renovated
                            </Button>
                            <Button
                                variant={filters.bathroomCondition === 'could be refurbished' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleFilterChange('bathroomCondition', 'could be refurbished')}
                                className="flex items-center gap-1"
                            >
                                <Wrench className="w-3 h-3" />
                                Could be Refurbished
                            </Button>
                        </div>
                    </div>

                    {/* Clear filters button */}
                    <Button variant="link" size="sm" onClick={clearFilters} className="text-xs">
                        Clear Filters  {/* Reset all filters */}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default PropertyFilters;