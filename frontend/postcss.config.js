// postcss.config.js
export default {
  plugins: {
    // This is the new bridge that invokes the Tailwind JIT engine:
    '@tailwindcss/postcss': {},

    // Add vendor prefixes where needed:
    autoprefixer: {},
  },
}
