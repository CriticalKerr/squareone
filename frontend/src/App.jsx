// The brain of the webapp that decides which page to show (index page, mapview page, or error page)

import React from "react"
import { TooltipProvider } from "@/components/ui/tooltip";          // Show helper tooltips
import { BrowserRouter, Routes, Route } from "react-router-dom";    // Page routing
import Index from "./pages/Index";                                  // Home page component
import NotFound from "./pages/NotFound";                            // 404 page component
import MapView from "@/components/MapView.jsx";                     // Map view page
import { LikesProvider } from './contexts/LikesContext';

//______________________________________________________
// APP COMPONENT
// This is the root component that sets up providers and routes
export default function App() {
    console.log("▶️ App component is rendering")

    return (
            <LikesProvider>  {/* share like state across all routes */}
                <TooltipProvider>  {/* Tooltips around the app */}
                    <BrowserRouter>  {/* BrowserRouter makes URL routing work */}
                        <Routes>
                            <Route path="/" element={<Index/>}/>  {/* Route "/" shows the Index page */}
                            <Route path="/map" element={<MapView/>}/>  {/* Route "/map" shows the MapView page */}
                            <Route path="*" element={<NotFound/>}/>  {/* Any other path shows the 404 page */}
                        </Routes>
                    </BrowserRouter>
                </TooltipProvider>
            </LikesProvider>
    )
}
