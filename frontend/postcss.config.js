//______________________________________________________
// POSTCSS CONFIGURATION
// PostCSS processes your CSS files through plugins to:
// - Transform Tailwind utility classes into actual CSS
// - Add browser vendor prefixes (-webkit-, -moz-, etc.)
// - Optimize and enhance CSS for production

export default {
  plugins: {
    tailwindcss: {}, // Use Tailwind CSS to transform utility classes into real CSS
    autoprefixer: {}, // Add vendor prefixes (like -webkit-) for better browser support
  },
}
