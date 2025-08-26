
import { useState, useCallback } from 'react';

const useLikes = () => {
    // Load likes from localStorage on initialization
    const [likedProperties, setLikedProperties] = useState(() => {
        try {
            const saved = localStorage.getItem('likedProperties');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error loading liked properties:', error);
            return [];
        }
    });

    const [isAnimating, setIsAnimating] = useState({}); // Track animation state per property

    const toggleLike = useCallback(async (propertyId) => {
        if (!propertyId) {
            console.warn('No propertyId provided to toggleLike');
            return { success: false, error: 'No property ID' };
        }

        const isCurrentlyLiked = likedProperties.includes(propertyId);

        // Start animation immediately for instant feedback
        setIsAnimating(prev => ({ ...prev, [propertyId]: true }));

        // Update UI immediately
        const newLiked = isCurrentlyLiked
            ? likedProperties.filter(id => id !== propertyId)
            : [...likedProperties, propertyId];

        setLikedProperties(newLiked);
        localStorage.setItem('likedProperties', JSON.stringify(newLiked));

        try {
            // Call your FastAPI backend - but don't let it break the UI if it fails
            const response = await fetch(`/api/properties/${propertyId}/like`, {
                method: isCurrentlyLiked ? 'DELETE' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Stop animation after a delay
            setTimeout(() => {
                setIsAnimating(prev => ({ ...prev, [propertyId]: false }));
            }, 600);

            return { success: true, isLiked: !isCurrentlyLiked };
        } catch (error) {
            console.warn('API call failed, but continuing with local update:', error);

            // Don't revert the local change - just continue without server sync
            // This way the UI still works even if the backend is down

            // Stop animation after a delay
            setTimeout(() => {
                setIsAnimating(prev => ({ ...prev, [propertyId]: false }));
            }, 600);

            return { success: true, isLiked: !isCurrentlyLiked, error: error.message };
        }
    }, [likedProperties]);

    const isLiked = useCallback((propertyId) => {
        if (!propertyId) return false;
        return likedProperties.includes(propertyId);
    }, [likedProperties]);

    const getIsAnimating = useCallback((propertyId) => {
        if (!propertyId) return false;
        return isAnimating[propertyId] || false;
    }, [isAnimating]);

    return {
        likedProperties,
        toggleLike,
        isLiked,
        getIsAnimating
    };
};

export default useLikes;