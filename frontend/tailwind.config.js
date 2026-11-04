/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        clay: {
          canvas: "#F6F1EA",
          surface: "#FCFAF7",
          card: "#FFFFFF",
          border: "#E9DFD3",
          borderLight: "#F2EBE2",
        },
        terracotta: {
          50: "#FDF6F2",
          100: "#FBECE4",
          200: "#F5D6C5",
          300: "#EBB99F",
          400: "#DE9370",
          500: "#C85A32", // Primary brand terracotta from inspiration image
          600: "#B44A23",
          700: "#963A19",
          800: "#7A2E15",
          900: "#652713",
        },
        sand: {
          50: "#FBF9F5",
          100: "#F5EFE6",
          200: "#EBE0D0",
          300: "#DECEB7",
          400: "#C5B095",
          500: "#A99275",
        },
        charcoal: {
          700: "#383B3E",
          800: "#2B2D2F",
          900: "#1E2022", // Dark tactile badge & contrast buttons from inspiration
        },
        ink: {
          primary: "#2A2521",
          secondary: "#6E655D",
          muted: "#968D84",
          faint: "#BFB7AD",
        },
        market: {
          up: "#1E824C",
          down: "#C84B31",
          warn: "#D97706",
        },
      },
      boxShadow: {
        "clay-sm": "0 2px 8px -1px rgba(80, 55, 35, 0.06), 0 1px 3px -1px rgba(80, 55, 35, 0.04)",
        "clay-card": "0 10px 25px -4px rgba(80, 55, 35, 0.07), 0 4px 10px -2px rgba(80, 55, 35, 0.04)",
        "clay-hover": "0 16px 32px -4px rgba(80, 55, 35, 0.12), 0 6px 14px -3px rgba(80, 55, 35, 0.06)",
        "clay-pill": "0 6px 16px -2px rgba(200, 90, 50, 0.35)",
        "dark-pill": "0 6px 16px -2px rgba(30, 32, 34, 0.3)",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        "2xl": "18px",
        "3xl": "24px",
      },
    },
  },
  plugins: [],
};

