/* eslintā€‘env node */
/* eslintā€‘disable noā€‘unusedā€‘vars */
// eslint-disable-next-line no-undef
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // expose the CSS vars youā€™re using in your components
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        // ā€¦and your primary, secondary, etc.
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        // etc.
      },
    },
  },
  plugins: [
    // if you use the shadcn tailwind-animate plugin:
    // eslint-disable-next-line no-undef
    require("tailwindcss-animate"),
    // any other pluginsā€¦
  ],
}