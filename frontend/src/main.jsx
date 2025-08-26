import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"

//______________________________________________________
// APPLICATION ENTRY POINT
//   React app is bootstrapped here by:
// - Creating the React root and mounting it to the DOM
// - Wrapping my app with providers (Router, Theme, etc.)
// - Importing global styles and setting up the app structure
// - This is where my entire React app starts running
//______________________________________________________

console.log("🏁 main.jsx is running")

ReactDOM
    .createRoot(document.getElementById("root"))
    .render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    )