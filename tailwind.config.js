/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#e8eef7',
          100: '#c5d5ea',
          200: '#9eb8da',
          300: '#6d96c8',
          400: '#3d73b6',
          500: '#1565C0',
          600: '#1055a8',
          700: '#0a418a',
          800: '#062e6c',
          900: '#0D2B5E',
          950: '#071a3e',
        },
        silver: '#B0BEC5',
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body:    ['var(--font-body)',    'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
