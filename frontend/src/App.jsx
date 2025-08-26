import React from "react"
import { TooltipProvider } from "@/components/ui/tooltip";          // Show helper tooltips
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"; // Data fetching toolkit
import { BrowserRouter, Routes, Route } from "react-router-dom";    // Page routing
import Index from "./pages/Index";                                  // Home page component
import NotFound from "./pages/NotFound";                            // 404 page component
import MapView from "@/components/MapView.jsx";                     // Map view page
import { LikesProvider } from './contexts/LikesContext';


//______________________________________________________
// REACT-QUERY SETUP
// Create a client to manage server data and caching
const queryClient = new QueryClient();

//______________________________________________________
// APP COMPONENT
// This is the root component that sets up providers and routes
export default function App() {
    console.log("▶️ App component is rendering")

    return (
        // Wrap everything in QueryClientProvider so React Query works
        <QueryClientProvider client={queryClient}>
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
        </QueryClientProvider>
    )
}
