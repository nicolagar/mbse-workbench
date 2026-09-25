/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        product: "#2563eb",
        process: "#0d9488",
        resource: "#7c3aed"
      }
    }
  },
  plugins: []
};
