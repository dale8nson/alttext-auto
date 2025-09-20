/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1", // indigo-500
          600: "#4f46e5", // indigo-600
          700: "#4338ca", // indigo-700
          800: "#3730a3", // indigo-800
          900: "#312e81", // indigo-900
        },
      },
      boxShadow: {
        soft: "0 10px 30px -12px rgba(2, 6, 23, 0.25)",
      },
    },
  },
  plugins: [],
};
