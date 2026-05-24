/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fefbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          DEFAULT: '#d4a843',
          500: '#d4a843',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
          950: '#451a03',
        },
        darkbg: {
          50: '#f8fafc',
          100: '#f1f5f9',
          900: '#0f172a',
          950: '#070b13',
        },
        gold2: '#e5c17b',
        red: '#ef4444',
        primary: '#0ea5e9',
        surface: 'rgba(255,255,255,0.1)'
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
