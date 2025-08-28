/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#e7f5ff",
          100: "#d0ebff",
          200: "#a5d8ff",
          300: "#74c0fc",
          400: "#339af0",
          500: "#228be6",
          600: "#1c7ed6",
          700: "#1971c2",
          800: "#1864ab",
          900: "#145a99",
        },
        dark: {
          100: "#C1C2C5",
          200: "#A6A7AB",
          300: "#909296",
          400: "#5c5f66",
          500: "#373A40",
          600: "#2C2E33",
          700: "#25262b",
          800: "#1A1B1E",
          900: "#141517",
          950: "#101113",
        },
        mdt: {
          bg: "#1A1B1E",
          card: "#25262b",
          border: "#2C2E33",
          accent: "#373A40",
          text: "#C1C2C5",
          muted: "#909296",
        },
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
