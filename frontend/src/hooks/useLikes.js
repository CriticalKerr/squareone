//Manages which property a user hearted by saving them in their browser,
//updating the UI instantly when a user clicks hearts,
//and tries to sync with the server in the background even if it's offline.

import { useState, useCallback } from 'react';

//______________________________________________________
// USE LIKES HOOK
//handles local likes state, animations, and server sync
const useLikes = () => {
    //______________________________________________________
    // LOCAL STORAGE STATE
    //load liked property IDs from browser storage (or [] if none)
    const [likedProperties, setLikedProperties] = useState(() => {
        try {
            const saved = localStorage.getItem('likedProperties');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error loading liked properties:', error);
            return [];
        }
    });

    //tracks if heart animation is running for a given property
    const [isAnimating, setIsAnimating] = useState({});

    //______________________________________________________
    // TOGGLE LIKE
    //flip heart on/off for one property and try to sync with backend
    const toggleLike = useCallback(async (propertyId) => {
        if (!propertyId) {
            console.warn('No propertyId provided to toggleLike');
            return { success: false, error: 'No property ID' };
        }

        const isCurrentlyLiked = likedProperties.includes(propertyId);

        //start animation immediately for fast feedback
        setIsAnimating(prev => ({ ...prev, [propertyId]: true }));

        //optimistically update local UI + storage
        const newLiked = isCurrentlyLiked
            ? likedProperties.filter(id => id !== propertyId)
            : [...likedProperties, propertyId];

        setLikedProperties(newLiked);
        localStorage.setItem('likedProperties', JSON.stringify(newLiked));

        try {
            //call backend API but don’t block UI if it fails
            const response = await fetch(`/api/properties/${propertyId}/like`, {
                method: isCurrentlyLiked ? 'DELETE' : 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            //stop animation after 600ms
            setTimeout(() => {
                setIsAnimating(prev => ({ ...prev, [propertyId]: false }));
            }, 600);

            return { success: true, isLiked: !isCurrentlyLiked };
        } catch (error) {
            console.warn('API call failed, continuing with local update:', error);

            //don’t roll back local changes; UI keeps working offline
            setTimeout(() => {
                setIsAnimating(prev => ({ ...prev, [propertyId]: false }));
            }, 600);

            return { success: true, isLiked: !isCurrentlyLiked, error: error.message };
        }
    }, [likedProperties]);

    //______________________________________________________
    // IS LIKED
    //check if one property is liked
    const isLiked = useCallback((propertyId) => {
        if (!propertyId) return false;
        return likedProperties.includes(propertyId);
    }, [likedProperties]);

    //______________________________________________________
    // GET IS ANIMATING
    //check if heart animation is running for one property
    const getIsAnimating = useCallback((propertyId) => {
        if (!propertyId) return false;
        return isAnimating[propertyId] || false;
    }, [isAnimating]);

    return {
        likedProperties, //array of liked property IDs
        toggleLike,      //function to toggle like
        isLiked,         //check if property is liked
        getIsAnimating   //check if property heart is animating
    };
};

export default useLikes;
