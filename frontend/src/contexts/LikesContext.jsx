//Shares which properties are 'loved' between different parts of the app

import React, { createContext, useContext } from 'react';
import useLikes from '../hooks/useLikes';

//______________________________________________________
// CREATE CONTEXT
//holds like-related state so it can be shared across the app
const LikesContext = createContext();

//______________________________________________________
// LIKES PROVIDER
//wraps children and makes like state available via context
export const LikesProvider = ({ children }) => {
    const likesHook = useLikes(); //custom hook that manages likes
    return (
        <LikesContext.Provider value={likesHook}>
            {children}
        </LikesContext.Provider>
    );
};

//______________________________________________________
// USE LIKES CONTEXT HOOK
//lets components read likes state and actions safely
//eslint disable here avoids dev hot-reload warning
// eslint-disable-next-line react-refresh/only-export-components
export const useLikesContext = () => {
    const context = useContext(LikesContext);
    if (!context) {
        //throwing error ensures hook is only used inside provider
        throw new Error('useLikesContext must be used within a LikesProvider');
    }
    return context;
};
