module.exports = {
  content: ['./app/**/*.{html,js,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        '#e9e8e7': '#e9e8e7',
        '#8b8685': '#8b8685',
        '#656463': '#656463',
        '#454443': '#454443',
        '#353433': '#353433',
        '#252423': '#252423',
        '#090807': '#090807',
        '#bbeeff': '#bbeeff',
        '#d7fc70': '#d7fc70',
        '#ffffbb': '#ffffbb',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    ({ addVariant }) => {
      addVariant('coarse', '@media (pointer: coarse)')
    },
  ],
}
