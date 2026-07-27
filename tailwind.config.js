/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#1a1a2e',
          card: '#2d2d44',
          border: '#3d3d54',
        },
        accent: {
          DEFAULT: '#ff6b35',
          light: '#ff8c42',
          dark: '#e55a2b',
        },
      },
    },
  },
  plugins: [],
};