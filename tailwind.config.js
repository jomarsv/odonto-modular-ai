/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/client/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eef8ff",
          100: "#d9efff",
          600: "#0b73b7",
          700: "#095b92"
        }
      }
    }
  },
  plugins: []
};
