import React, { createContext, useContext } from 'react';
import useLikes from '../hooks/useLikes';

const LikesContext = createContext();

export const LikesProvider = ({ children }) => {
    const likesHook = useLikes();
    return (
        <LikesContext.Provider value={likesHook}>
            {children}
        </LikesContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLikesContext = () => {
    const context = useContext(LikesContext);
    if (!context) {
        throw new Error('useLikesContext must be used within a LikesProvider');
    }
    return context;
};