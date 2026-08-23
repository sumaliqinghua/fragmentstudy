/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#faf9f5',
        ink: '#111827',
        mute: '#4b5563',
        faint: '#9ca3af',
        line: '#e5e7eb',
        teal: {
          DEFAULT: '#0d9488',
          soft: '#f0fdfa',
        },
        gold: {
          DEFAULT: '#f59e0b',
          soft: '#fef3c7',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 6px rgba(0,0,0,0.03)',
        node: '0 8px 8px rgba(13,148,136,0.2)',
      },
    },
  },
  plugins: [],
};
