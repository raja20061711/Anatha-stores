/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vista: {
          light: '#FFF1E7',
          DEFAULT: '#F97316',
          dark: '#EA580C',
        },
        oxford: {
          DEFAULT: '#17365D',
          light: '#234A7D',
        },
        brand: {
          primary: '#F97316',
          secondary: '#17365D',
          navy: '#17365D',
          orange: '#F97316',
          lightOrange: '#FFF1E7',
          mainBg: '#F3F6FA',
          pageBg: '#F3F6FA',
          cardBg: '#FFFFFF',
          inputBg: '#FFFFFF',
          mainText: '#17365D',
          secondaryText: '#64748B',
          border: '#D9E2EF',
          success: '#16A34A',
          warning: '#D97706',
          danger: '#DC2626',
          blue: '#17365D',
          green: '#16A34A',
          red: '#DC2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        tamil: ['"Noto Sans Tamil"', '"Nirmala UI"', 'Latha', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
