//Watches your screen size and tells components if you're on a phone (under 768px wide) so they can show mobile-friendly layouts

import { useState, useEffect } from 'react';

//______________________________________________________
// USE IS MOBILE HOOK
//returns true if screen width is smaller than given breakpoint
export const useIsMobile = (breakpoint = 768) => {
    const [isMobile, setIsMobile] = useState(false); //default false until we check

    useEffect(() => {
        //helper function runs on load + resize
        const checkMobile = () => {
            setIsMobile(window.innerWidth < breakpoint);
        };

        checkMobile(); //run once on mount so we get an initial value
        window.addEventListener('resize', checkMobile); //update on screen resize

        //cleanup to avoid memory leaks
        return () => window.removeEventListener('resize', checkMobile);
    }, [breakpoint]);

    return isMobile; //hook result: true or false
};
