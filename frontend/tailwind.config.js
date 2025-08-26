/* eslint‑env node */
/* eslint‑disable no‑unused‑vars */
// eslint-disable-next-line no-undef
module.exports = {

  //______________________________________________________
// TAILWIND CSS CONFIGURATION
// This file configures Tailwind CSS to:
// - Scan the React files for class names to include in the final CSS
// - Add custom colors that match the design system
// - Enable animation utilities for smooth transitions
// - Purge unused styles to keep bundle size small

  //______________________________________________________
  // FILES TO SCAN
  // Where Tailwind should look for class names in your code
  content: ["./src/**/*.{js,jsx,ts,tsx}"],

  //______________________________________________________
  // THEME EXTENSIONS
  // Add extra colors that match the CSS variables in your components
  theme: {
    extend: {
      colors: {
        // expose the CSS vars used in the components
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
      },
    },
  },

  //______________________________________________________
  // PLUGINS
  // External Tailwind plugins to support animations
  plugins: [
    // Load the animate plugin for extra animation utilities
    // eslint-disable-next-line no-undef
    require("tailwindcss-animate"),
  ],
}
