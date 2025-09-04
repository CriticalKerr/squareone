
import React, { useState } from 'react';
import { Sparkles, Wrench, ChefHat, Bath, PoundSterling, X } from 'lucide-react';

//______________________________________________________
// PROPERTY FILTERS COMPONENT
// Minimalistic filter UI with clean buttons
const PropertyFilters = ({ onFiltersChange, currentFilters = {} }) => {

    //______________________________________________________
    // FILTERS STATE
    const [filters, setFilters] = useState({
        kitchenCondition: currentFilters.kitchenCondition || 'all',
        bathroomCondition: currentFilters.bathroomCondition || 'all',
        priceRange: currentFilters.priceRange || 'all',
        ...currentFilters
    });

    //______________________________________________________
    // HANDLE FILTER CHANGE
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
    const clearFilters = () => {
        const clearedFilters = {
            kitchenCondition: 'all',
            bathroomCondition: 'all',
            priceRange: 'all'
        };
        setFilters(clearedFilters);
        onFiltersChange(clearedFilters);
    };

    //______________________________________________________
    // COUNT ACTIVE FILTERS
    const getActiveFilterCount = () => {
        let count = 0;
        if (filters.kitchenCondition !== 'all') count++;
        if (filters.bathroomCondition !== 'all') count++;
        if (filters.priceRange !== 'all') count++;
        return count;
    };

//______________________________________________________
// FILTER BUTTON COMPONENT
    const FilterButton = ({ isActive, onClick, icon: Icon, iconSize = "w-3 h-3", children }) => (
        <button
            onClick={onClick}
            className={`
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium 
            transition-all duration-200 border touch-manipulation
            ${isActive
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }
        `}
        >
            {Icon && <Icon className={iconSize} />}  {/* USE iconSize prop here instead of hardcoded "w-3 h-3" */}
            {children}
        </button>
    );


    return (
        <div className="mt-0">
            {/* Filter Header */}
            <div className="flex items-center gap-3 mb-2">
                {/* Clear button */}
                {getActiveFilterCount() > 0 && (
                    <button
                        onClick={clearFilters}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all duration-200"
                    >
                        <X className="w-3 h-3" />
                        Clear
                    </button>
                )}
            </div>

            {/* Side by Side Filters - Tighter spacing */}
            <div className="grid grid-cols-0 md:grid-cols-1 gap-2">
                {/* Kitchen Filters */}
                <div>
                    <div className="text-xs text-slate-500 mb-0"></div>
                    <div className="flex gap-1 flex-wrap">
                        <FilterButton
                            isActive={filters.kitchenCondition === 'all'}
                            onClick={() => handleFilterChange('kitchenCondition', 'all')}
                            icon={ChefHat}
                            iconSize="w-4 h-4"
                        >
                            All
                        </FilterButton>
                        <FilterButton
                            isActive={filters.kitchenCondition === 'new/renovated'}
                            onClick={() => handleFilterChange('kitchenCondition', 'new/renovated')}
                            icon={Sparkles}
                            iconSize="w-4 h-4"
                        >
                            New
                        </FilterButton>
                        <FilterButton
                            isActive={filters.kitchenCondition === 'could be refurbished'}
                            onClick={() => handleFilterChange('kitchenCondition', 'could be refurbished')}
                            icon={Wrench}
                            iconSize="w-4 h-4"
                        >
                            Refurb
                        </FilterButton>
                    </div>
                </div>

                {/* Bathroom Filters */}
                <div>
                    <div className="text-xs text-slate-500 mb-0"></div>
                    <div className="flex gap-1 flex-wrap">
                        <FilterButton
                            isActive={filters.bathroomCondition === 'all'}
                            onClick={() => handleFilterChange('bathroomCondition', 'all')}
                            icon={Bath}
                            iconSize="w-4 h-4"
                        >
                            All
                        </FilterButton>
                        <FilterButton
                            isActive={filters.bathroomCondition === 'new/renovated'}
                            onClick={() => handleFilterChange('bathroomCondition', 'new/renovated')}
                            icon={Sparkles}
                            iconSize="w-4 h-4"
                        >
                            New
                        </FilterButton>
                        <FilterButton
                            isActive={filters.bathroomCondition === 'could be refurbished'}
                            onClick={() => handleFilterChange('bathroomCondition', 'could be refurbished')}
                            icon={Wrench}
                            iconSize="w-4 h-4"
                        >
                            Refurb
                        </FilterButton>
                    </div>
                </div>

                {/* Price Filters */}
                <div>
                    <div className="text-xs text-slate-500 mb-0"></div>
                    <div className="flex gap-1 flex-wrap">
                        <FilterButton
                            isActive={filters.priceRange === 'all'}
                            onClick={() => handleFilterChange('priceRange', 'all')}
                            icon={PoundSterling}
                            iconSize="w-4 h-4"
                        >
                            All
                        </FilterButton>
                        <FilterButton
                            isActive={filters.priceRange === '< 150k'}
                            onClick={() => handleFilterChange('priceRange', '< 150k')}
                        >
                            under 150k
                        </FilterButton>
                        <FilterButton
                            isActive={filters.priceRange === '150k-200k'}
                            onClick={() => handleFilterChange('priceRange', '150k-200k')}
                        >
                            150-200k
                        </FilterButton>
                        <FilterButton
                            isActive={filters.priceRange === '> 200k'}
                            onClick={() => handleFilterChange('priceRange', '> 200k')}
                        >
                            over 200k
                        </FilterButton>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PropertyFilters;
