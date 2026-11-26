/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 950: "#06142a", 900: "#0b1f3a", 800: "#12305a", 700: "#1a437c" },
        brand: { DEFAULT: "#1d4ed8", 50: "#eff6ff", 100: "#dbeafe", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8" },
        cyan2: { DEFAULT: "#0891b2", 100: "#cffafe", 400: "#22d3ee" },
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"], mono: ["JetBrains Mono", "ui-monospace", "monospace"] },
      boxShadow: { card: "0 1px 2px rgba(11,31,58,.06), 0 4px 16px rgba(11,31,58,.06)" },
    },
  },
  plugins: [],
};
