/** @type {import('tailwindcss').Config} */
// Theme colours are CSS variables set at run time (src/theme/themes.ts): the accent ramp, the night surfaces and the day page tint.
const v = (name) => `rgb(var(${name}) / <alpha-value>)`;
const ramp = Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map(k => [k, v('--ac-' + k)]));
const night = Object.fromEntries(["0b1317","0c161c","0f1a20","101b21","111e24","121f26","132026","132027","142026","14232b","15232b","16252d","182830","1a2b34","1b2c34","1d2e36","1d303b","22343d","22353f","223640","243d48","283d47","283e4a","2a3f49","2d424e","2c4250","2e4553","2f4a58","34505e","3a5463","0f1f27","12202a"].map(h => [h, v('--nt-' + h)]));

module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: v('--ac-700'), hover: v('--ac-600'), light: v('--ac-100'), dark: v('--ac-700') },
        accent: ramp,
        night,
        daybg: v('--day-bg'),
        peach: { DEFAULT: '#FF9B7B', ink: '#7B2D17', soft: '#FFE3D8', deep: '#E4694A' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Hind Siliguri"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        latin: ['Newsreader', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
