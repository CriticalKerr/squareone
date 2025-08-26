import React from 'react';
import { useLikesContext } from '../contexts/LikesContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { Heart } from 'lucide-react';
import {
    Building,
    Bed,
    Bath,
    Square,
    Wrench,
    Sparkles,
    MapPin,
    Home,
    PoundSterling,
    Info,
    HammerIcon,
    Link2Icon,
} from 'lucide-react';

//______________________________________________________
// SECTION HEADER
//small header row that shows an icon and a title
const SectionHeader = ({ icon: Icon, title, iconSize = 'w-4 h-4' }) => (
    <div className="flex items-center gap-1 mb-2 flex-shrink-0">
        {/* show icon if we got one */}
        {Icon && <Icon className={`${iconSize} text-slate-600`} aria-hidden="true" />}
        {/* show title text */}
        <h5 className="font-semibold text-slate-900 text-sm">{title}</h5>
    </div>
);

//______________________________________________________
// INFO CELL
//tiny square card that shows an icon, a main value, and a small label
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
        {label && <span className="text-[10px] text-slate-500 capitalize">{label}</span>}
    </div>
);

//______________________________________________________
// FORMAT CURRENCY TEXT
//adds a £ if missing, or a dash if empty
const formatCurrency = (raw) => {
    if (raw == null || raw === '') return '—'; //no value means show a dash
    let str = String(raw); //force into a string
    if (!str.startsWith('£')) str = `£${str}`; //prepend pound sign if not present
    return str;
};

//______________________________________________________
// CALCULATE COMBINED REFURB COST
//adds kitchen and bathroom refurb totals together (0 if missing)
const calculateCombinedRefurbCost = (property) => {
    if (!property?.condition_analysis) return 0; //no analysis means no cost

    const conditionAnalysis = Array.isArray(property.condition_analysis)
        ? property.condition_analysis
        : JSON.parse(property.condition_analysis || '[]'); //parse if string

    const bathroomAnalysis = conditionAnalysis.find((r) => r.room_type === 'bathroom'); //bathroom entry
    const kitchenAnalysis = conditionAnalysis.find((r) => r.room_type === 'kitchen'); //kitchen entry

    const bathroomCost = bathroomAnalysis?.cost_estimate?.total_cost || 0; //bathroom total
    const kitchenCost = kitchenAnalysis?.cost_estimate?.total_cost || 0; //kitchen total

    return bathroomCost + kitchenCost; //combined total
};

//______________________________________________________
// FORMAT COMBINED REFURB COST
//shortens large amounts like 15000 → "£15k"
const formatRefurbCost = (cost) => {
    if (cost === 0) return '—'; //no cost available
    if (cost >= 1000) {
        return `£${(cost / 1000).toFixed(0)}k`; //round to nearest thousand
    }
    return `£${cost}`; //small number as-is
};

//______________________________________________________
// GET COMBINED ROOM DESCRIPTIONS
//joins the kitchen and bathroom descriptions into one neat paragraph
const getCombinedRoomDescriptions = (property) => {
    if (!property?.condition_analysis) return 'No description available for this property.';

    const conditionAnalysis = Array.isArray(property.condition_analysis)
        ? property.condition_analysis
        : JSON.parse(property.condition_analysis || '[]'); //parse if string

    const bathroomAnalysis = conditionAnalysis.find((r) => r.room_type === 'bathroom');
    const kitchenAnalysis = conditionAnalysis.find((r) => r.room_type === 'kitchen');

    const descriptions = []; //collect lines here

    if (kitchenAnalysis?.room_description) {
        descriptions.push(`Kitchen: ${kitchenAnalysis.room_description}`);
    }

    if (bathroomAnalysis?.room_description) {
        descriptions.push(`Bathroom: ${bathroomAnalysis.room_description}`);
    }

    return descriptions.length > 0
        ? descriptions.join(' ')
        : 'No room descriptions available for this property.';
};

//______________________________________________________
// PROPERTY INFO SECTION
//shows key facts in a grid, then address, analysis text, and an external link
const PropertyInfoSection = ({ property = {}, kitchenState, bathroomState }) => {
    const { isLiked, toggleLike, getIsAnimating } = useLikesContext();
    const isMobile = useIsMobile();

    if (!property) return null;

    const combinedRefurbCost = calculateCombinedRefurbCost(property);
    const combinedRoomDescriptions = getCombinedRoomDescriptions(property);

    const handleLikeClick = async (e) => {
        e.stopPropagation();
        try {
            const result = await toggleLike(property.id || property.listing_id);
            if (!result.success) {
                console.error('Failed to toggle like:', result.error);
            }
        } catch (error) {
            console.error('Error in handleLikeClick:', error);
        }
    };

    const propertyId = property.id || property.listing_id;
    isLiked(propertyId);
    getIsAnimating(propertyId);

    return (
        <div className="flex flex-col gap-1 w-full h-full relative">

            {/*______________________________________________________*/}
            {/* TOP: PROPERTY INFO GRID */}
            <div className="bg-slate-50 rounded-lg p-2">
                <SectionHeader icon={Info} title="Property Info" iconSize="w-4 h-4" />
                <div className="grid grid-cols-4 gap-1">
                    {/*type of place*/}
                    <InfoCell icon={Building} value={property.property_type || 'Property'} />
                    {/*how many bedrooms*/}
                    <InfoCell icon={Bed} value={property.bedrooms_count ?? 0} />
                    {/*how many bathrooms*/}
                    <InfoCell icon={Bath} value={property.bathrooms_count ?? 0} />
                    {/*total size in square meters*/}
                    <InfoCell icon={Square} value={property.total_area_sqm ?? 0} unit="m²" />
                    {/*asking price with pound sign*/}
                    <InfoCell icon={PoundSterling} value={formatCurrency(property.price)} />
                    {/*sum of kitchen+bathroom refurb costs, shortened*/}
                    <InfoCell icon={HammerIcon} value={formatRefurbCost(combinedRefurbCost)} label="" />
                    {/*kitchen state icon: sparkles if new, wrench if needs work*/}
                    <InfoCell icon={kitchenState === 'new/renovated' ? Sparkles : Wrench} label="kitchen" />
                    {/*bathroom state icon: sparkles if new, wrench if needs work*/}
                    <InfoCell icon={bathroomState === 'new/renovated' ? Sparkles : Wrench} label="bathroom" />
                </div>
            </div>

            {/*______________________________________________________*/}
            {/* BOTTOM: ADDRESS, ROOM ANALYSIS, AND LINK */}
            <div className="bg-slate-50 rounded-lg p-2 flex flex-col">
                {/*______________________________________________________*/}
                {/* ADDRESS WITH LOVE BUTTON */}
                <div className="mb-2 flex items-start gap-2">
                    <div className="flex-1">
                        <SectionHeader icon={MapPin} title="Address" />
                        <p className="text-xs text-slate-900 leading-tight bg-white p-1.5 rounded">
                            {property.address || 'No address available'}
                        </p>
                    </div>

                    {/* LOVE BUTTON - USING MARKER STYLE */}
                    <button
                        onClick={handleLikeClick}
                        className={`p-2 rounded-full transition-all touch-manipulation shadow-sm flex-shrink-0 ${
                            isLiked(property.id || property.listing_id)
                                ? 'bg-slate-100 border-2 border-slate-950'
                                : 'bg-white border-2 border-gray-200 hover:bg-gray-100'
                        }`}
                        style={{
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                        }}
                    >
                        <Heart
                            size={isMobile ? 20 : 18}
                            className={getIsAnimating(propertyId) ? 'animate-heart-pop-continuous' : ''}
                            fill={isLiked(propertyId) ? '#000000' : 'none'}
                            color='#000000'
                        />
                    </button>
                </div>

                {/*______________________________________________________*/}
                {/* ROOM ANALYSIS */}
                <div className="mb-2 flex flex-col">
                    <SectionHeader icon={Home} title="Room Analysis" />
                    <div className="bg-white p-1.5 rounded flex-1 overflow-hidden">
                        <p
                            className="text-xs text-slate-700 leading-tight m-0"
                            style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 10,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                            }}
                        >
                            {combinedRoomDescriptions}
                        </p>
                    </div>
                </div>

                {/*______________________________________________________*/}
                {/* EXTERNAL LINK */}
                {property.listing_link && (
                    <div>
                        <a
                            href={property.listing_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            <Link2Icon className="w-3 h-3" />
                            <span>View on Zoopla</span>
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PropertyInfoSection;