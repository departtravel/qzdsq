/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette « voyage premium » : sable, terracotta, teal profond, or.
        brand: {
          50: '#fff6ed', 100: '#ffe9d5', 200: '#fdd0aa', 300: '#fbb074',
          400: '#f8853c', 500: '#f56516', 600: '#e6480c', 700: '#bf340c',
          800: '#982b12', 900: '#7a2612',
        },
        ink: {
          50: '#f4f6f8', 100: '#e4e9ee', 700: '#20303f', 800: '#16232f', 900: '#0d1720',
        },
        teal: {
          500: '#0d9488', 600: '#0f766e', 700: '#115e59',
        },
        sand: '#faf6f0',
        gold: '#f4b740',
      },
      fontFamily: {
        display: ['"Clash Display"', 'Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 8px -2px rgba(16,35,47,.08), 0 4px 24px -8px rgba(16,35,47,.10)',
        lift: '0 12px 32px -8px rgba(16,35,47,.18)',
        glow: '0 8px 30px -6px rgba(245,101,22,.45)',
      },
      borderRadius: { xl: '0.9rem', '2xl': '1.25rem', '3xl': '1.75rem' },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(12px)' }, '100%': { opacity: 1, transform: 'none' } },
      },
      animation: { 'fade-up': 'fade-up .5s ease both' },
    },
  },
  plugins: [],
}
