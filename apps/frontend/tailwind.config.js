/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // O tema claro/escuro é do @tms/ui, não do Tailwind. Com 'media' (o padrão),
  // o react-native-css-interop 0.2.7 lança na web ao montar o CSS
  // ("Cannot manually set color scheme, as dark mode is type 'media'")
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
}
