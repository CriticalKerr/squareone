import React from 'react';
import { Bed, Bath, Square, Sparkles, Wrench, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';


const PropertyCard = ({ property, onClick, style }) => {
    return (
        <div
            className="cursor-pointer transform hover:scale-105 transition-transform duration-300 hover:shadow-2xl"
            style={style}
            onClick={onClick}
        >
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden w-72">
                {/* Property Image */}
                <div className="relative h-40 overflow-hidden">
                    <img
                        src={property.image_urls?.[0]} // Safe access: first image URL
                        alt={property.title}
                        className="w-full h-64 object-cover"
                    />
                    <div className="absolute top-3 left-3 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-bold">
                        {property.price}
                    </div>
                    {property.valueIncrease && (
                        <div className="absolute top-3 right-3 bg-green-500 text-white px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>+{property.valueIncrease}%</span>
                        </div>
                    )}
                </div>

                {/* Property Details */}
                <div className="p-4">
                    <h3 className="font-bold text-slate-900 text-lg mb-1">
                        {property.type}
                    </h3>
                    <p className="text-slate-600 text-sm mb-3">
                        {property.address}
                    </p>

                    {/* Property Features */}
                    <div className="flex items-center gap-4 text-slate-600 text-sm mb-3">
                        <div className="flex items-center gap-1">
                            <Bed className="w-4 h-4" />
                            <span>{property.bedroom_count}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Bath className="w-4 h-4" />
                            <span>{property.bathrooms}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Square className="w-4 h-4" />
                            <span>{property.sqft} sqft</span>
                        </div>
                    </div>

                    {/* Condition Badges */}
                    <div className="flex gap-2">
                        <Badge
                            variant={property.condition_analysis.state === 'new' ? 'default' : 'secondary'}
                            className="flex items-center gap-1 text-xs"
                        >
                            {property.kitchenCondition === 'new' ? (
                                <Sparkles className="w-3 h-3" />
                            ) : (
                                <Wrench className="w-3 h-3" />
                            )}
                            Kitchen
                        </Badge>
                        <Badge
                            variant={property.bathroomCondition === 'new' ? 'default' : 'secondary'}
                            className="flex items-center gap-1 text-xs"
                        >
                            {property.bathroomCondition === 'new' ? (
                                <Sparkles className="w-3 h-3" />
                            ) : (
                                <Wrench className="w-3 h-3" />
                            )}
                            Bathroom
                        </Badge>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PropertyCard;
