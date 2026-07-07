/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        bg: '#0D1B2A',
        bg2: '#142334',
        bg3: '#1C2E42',
        border: '#263D56',
        accent: '#C9A96E',
        accent2: '#3D7EBF',
        success: '#27AE7A',
        alert: '#E8503A',
        warning: '#E8A020',
        text: '#F5F0E8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
