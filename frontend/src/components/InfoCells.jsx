import React from 'react';
import {Building, Bed, Bath, Square, Wrench, Sparkles, TrendingUp, MapPin, Home, PoundSterling, Link, Info,} from 'lucide-react';

//______________________________________________________
// SECTION HEADER
// Small header with an icon and title text
const SectionHeader = ({ icon: Icon, title, iconSize = 'w-4 h-4' }) => (
    <div className="flex items-center gap-1 mb-2 flex-shrink-0">

        {/* Show icon */}
        {Icon && <Icon className={`${iconSize} text-slate-600`} aria-hidden="true" />}

        {/* Show title */}
        <h5 className="font-semibold text-slate-900 text-sm">{title}</h5>
    </div>
);

//______________________________________________________
// INFO CELL
// Square box showing an icon, a value, and a label/unit
const InfoCell = ({ icon: Icon, value, label, accent, unit, iconSize = 'w-5 h-5' }) => (
    <div className="bg-white rounded flex flex-col items-center justify-center p-1 aspect-square text-center">
        {Icon && (
            <Icon
                className={`${iconSize} mb-1 ${accent ? 'text-green-600' : 'text-slate-600'}`}
                aria-hidden="true"
            />
        )}
        {value != null && (
            <div className="flex items-baseline gap-1">
                <span className="text-xs font-medium truncate">{value}</span>
                {unit && <span className="text-[10px] text-slate-500">{unit}</span>}
            </div>
        )}
        {label && (
            <span className="text-[10px] text-slate-500 capitalize">{label}</span>
        )}
    </div>
);

//______________________________________________________
// FORMAT CURRENCY TEXT
// Add a £ sign if missing or show dash if no data
const formatCurrency = (raw) => {
    if (raw == null || raw === '') return '—';
    let str = String(raw);
    if (!str.startsWith('£')) str = `£${str}`;
    return str;
};

//______________________________________________________
// PROPERTY INFO SECTION
// Show a grid of property details and text sections below
const PropertyInfoSection = ({ property = {}, kitchenState, bathroomState }) => {
    if (!property) return null;

    return (
        <div className="flex flex-col gap-1 w-full h-full">
            {/* Top: Property Info Squares with header */}
            <div className="bg-slate-50 rounded-lg p-2">
                <SectionHeader icon={Info} title="Property Info" iconSize="w-4 h-4" />
                <div className="grid grid-cols-4 gap-1">
                    <InfoCell icon={Building} value={property.property_type || 'Property'}/>
                    <InfoCell icon={Bed} value={property.bedrooms_count ?? 0}/>
                    <InfoCell icon={Bath} value={property.bathrooms_count ?? 0}/>
                    <InfoCell icon={Square} value={property.total_area_sqm ?? 0} unit="m²"/>
                    <InfoCell icon={PoundSterling} value={formatCurrency(property.price)}/>
                    <InfoCell icon={TrendingUp} value={`${property.valueIncrease ?? 0}%`}/>
                    <InfoCell icon={kitchenState === 'new/renovated' ? Sparkles : Wrench} label="kitchen"/>
                    <InfoCell icon={bathroomState === 'new/renovated' ? Sparkles : Wrench} label="bathroom"/>
                </div>
            </div>

            {/* Bottom part: address, description, and link */}
            <div className="bg-slate-50 rounded-lg p-2 flex flex-col">
                {/* Address */}
                <div className="mb-2">
                    <SectionHeader icon={MapPin} title="Address" />
                    <p className="text-xs text-slate-900 leading-tight bg-white p-1.5 rounded">
                        {property.address || 'No address available'}
                    </p>
                </div>

                {/* Description */}
                <div className="mb-2 flex flex-col">
                    <SectionHeader icon={Home} title="Description" />
                    <div className="bg-white p-1.5 rounded flex-1 overflow-hidden">
                        <p
                            className="text-xs text-slate-700 leading-tight m-0"
                            style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 4,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                            }}
                        >
                            {property.description || 'No description available for this property.'}
                        </p>
                    </div>
                </div>

                {/* Listing Link */}
                {property.listing_link && (
                    <div className="flex flex-col">
                        <SectionHeader icon={Link} title="Link to Listing" />
                        <div className="bg-white p-1.5 rounded">
                            <p
                                className="text-xs text-slate-700 leading-tight break-all m-0"
                                style={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                }}
                            >
                                {property.listing_link}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PropertyInfoSection;
