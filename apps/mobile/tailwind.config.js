/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: { fontFamily: { sans: ['KlodaInterRegular'], 'inter-medium': ['KlodaInterMedium'], 'inter-semibold': ['KlodaInterSemiBold'], 'inter-bold': ['KlodaInterBold'] }, colors: {
  "surface": "#fcfaf7",
  "outerSurface": "#f8f4f1",
  "ink": "#1c1917",
  "muted": "#57534d",
  "border": "#e8e5e2",
  "card": "#f3efec",
  "elevated": "#ffffff",
  "primary": "#292524",
  "secure": "#009966",
  "processing": "#c26f00",
  "error": "#d02c2a",
  "soft": "#f3efec",
  "secureSoft": "#ddfaec"
},
    keyframes: { 'logo-reveal': { from: { opacity: '0', transform: 'scale(0.88)' }, to: { opacity: '1', transform: 'scale(1)' } } },
    animation: { 'logo-reveal': 'logo-reveal 400ms ease-out both' },
  } },
};
