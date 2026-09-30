/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        surface: '#fff8f5',
        ink: '#1C1917',
        muted: '#57534E',
        border: '#E7E5E4',
      },
    },
  },
};
