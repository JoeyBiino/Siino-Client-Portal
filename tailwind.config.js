/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Siino brand purple
        siino: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#9B7EBF',  // Main app accent color (dark mode)
          600: '#7C5DAF',  // Main app accent color (light mode)
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        // Dark mode background colors matching iOS app
        dark: {
          bg: '#0d0d10',
          surface: '#1a1a1e',
          surfaceSecondary: '#16161a',
          border: '#2a2a32',
          borderLight: '#1e1e24',
        },
      },
    },
  },
  plugins: [],
}
