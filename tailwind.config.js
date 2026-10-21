/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#2563EB',
          navy: '#0F172A',
          pageBg: '#F1F5F9',
          cardBg: '#FFFFFF',
          green: '#16A34A',
          orange: '#F97316',
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
