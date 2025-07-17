/* eslint‑env node */
/* eslint‑disable no‑unused‑vars */
const plugin = "tailwindcss/plugin"

// eslint-disable-next-line no-undef
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // expose the CSS vars you’re using in your components
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        // …and your primary, secondary, etc.
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        // etc.
      },
    },
  },
  plugins: [
    // if you use the shadcn tailwind-animate plugin:
    require("tailwindcss-animate"),
    // any other plugins…
  ],
}
