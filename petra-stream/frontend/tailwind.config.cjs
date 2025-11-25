// /workspaces/Petra-Stream/petra-stream/frontend/tailwind.config.cjs
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Petra brand color scale — adjust hexes to taste
        petra: {
          50:  '#f8f9ff',
          100: '#eef2ff',
          200: '#e1d9ff',
          300: '#cdb6ff',
          400: '#b48cff',
          500: '#8f63ff', // <- this is the value theme('colors.petra.500') will resolve to
          600: '#6f45e6',
          700: '#5530b4',
          800: '#3d238f',
          900: '#2b155e'
        }
      }
    }
  },
  plugins: []
}
