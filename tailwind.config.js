/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        cmPrimary: "#84C598",
        cmAccent: "#B973AF",
        cmSoft: "#fafdfb",
        cmBorder: "#e6f0ea",
        text: "#1a1a1a"
      },
      maxWidth: { card: "680px" },
      boxShadow: { card: "0 2px 6px rgba(0,0,0,.06)" },
      borderRadius: { 10: "10px" }
    },
    fontFamily: { sans: ["system-ui", "Segoe UI", "Tahoma", "Arial"] }
  },
  plugins: []
};
