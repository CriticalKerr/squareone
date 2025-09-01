// Processes CSS to make it work in all browsers

export default {
  plugins: {
    tailwindcss: {}, // Use Tailwind CSS to transform utility classes into real CSS
    autoprefixer: {}, // Add vendor prefixes (like -webkit-) for better browser support
  },
}
