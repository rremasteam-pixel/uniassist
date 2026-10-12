/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      colors: {
        ink: { 50: '#f3f5f9', 100: '#e4e9f2', 200: '#c6d0e2', 300: '#9aabc9', 400: '#6a80a9', 500: '#4a618d', 600: '#384b73', 700: '#2d3c5d', 800: '#1f2a42', 900: '#141c2e', 950: '#0c1220' },
        brass: { 300: '#f2cf7a', 400: '#e8b84a', 500: '#d49a1f', 600: '#b07c12' },
      },
    },
  },
  plugins: [],
};
