/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#58cc02',
        'primary-dark': '#46a302',
        secondary: '#2b70c9',
        accent: '#ffc800',
        'surface-gray': '#e5e5e5',
        'locked-gray': '#afafaf',
      },
      fontFamily: {
        sans: ['"Noto Sans"', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
          '50%': { transform: 'scale(1.05)', opacity: '0.4' },
        },
      },
      animation: {
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
