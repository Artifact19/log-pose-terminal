/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        clay: {
          canvas: "#F4EFEA", // Warm on the eyes soothing linen beige
          surface: "#FAF6F0", // Soft matte cashmere console surface
          card: "#FAF6F0",    // Tactile console deck card
          well: "#ECE3D8",    // Sunken tactile groove
          border: "#E2D7CB",  // Warm tactile border
          borderLight: "#FFFFFF",
          borderDark: "#D2C5B6",
        },
        beige: {
          50: "#FCFAF7",
          100: "#F7F3ED",
          200: "#EFE8DE",
          300: "#E4D9CC",
          400: "#D3C4B3",
          500: "#B8A592",
          600: "#9A8672",
        },
        terracotta: {
          50: "#FDF6F2",
          100: "#FBECE4",
          200: "#F5D6C5",
          300: "#EBB99F",
          400: "#DE9370",
          500: "#C85A32",
          600: "#B44A23",
          700: "#963A19",
          800: "#7A2E15",
          900: "#652713",
        },
        sand: {
          50: "#FAF7F2",
          100: "#F3ECE1",
          200: "#E9DFD0",
          300: "#DCCEBA",
          400: "#C2AF97",
          500: "#A89278",
        },
        ink: {
          primary: "#2C2420",   // Warm Deep Espresso (soothing, high-contrast)
          secondary: "#675B53", // Warm Roasted Mocha
          muted: "#95877E",     // Warm Stone
          faint: "#C2B5AA",     // Faint Sandstone
        },
        market: {
          up: "#1E824C",
          down: "#C84B31",
          warn: "#D97706",
        },
      },
      boxShadow: {
        "tactile-card": "0 10px 28px -4px rgba(120, 95, 75, 0.12), 0 3px 8px -2px rgba(120, 95, 75, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.95)",
        "tactile-btn": "0 4px 14px -1px rgba(120, 95, 75, 0.16), 0 2px 5px -1px rgba(120, 95, 75, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
        "tactile-btn-pressed": "inset 0 2px 5px rgba(120, 95, 75, 0.25), 0 1px 2px rgba(255, 255, 255, 0.8)",
        "tactile-well": "inset 0 2px 5px rgba(120, 95, 75, 0.12), inset 0 1px 2px rgba(120, 95, 75, 0.08), 0 1px 0 rgba(255, 255, 255, 0.9)",
        "tactile-knob": "0 6px 16px -2px rgba(120, 95, 75, 0.22), 0 2px 6px rgba(120, 95, 75, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.9)",
        "clay-sm": "0 2px 8px -1px rgba(120, 95, 75, 0.08), 0 1px 3px -1px rgba(120, 95, 75, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.85)",
        "clay-card": "0 10px 28px -4px rgba(120, 95, 75, 0.12), 0 3px 8px -2px rgba(120, 95, 75, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.95)",
        "clay-pill": "0 6px 20px -2px rgba(200, 90, 50, 0.38), 0 2px 8px rgba(200, 90, 50, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
        "console-glow": "0 8px 24px -2px rgba(168, 85, 247, 0.35), 0 2px 8px rgba(200, 90, 50, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.45)",
      },
      fontFamily: {
        sans: ["Outfit", "Plus Jakarta Sans", "Inter", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        "2xl": "20px",
        "3xl": "28px",
        "4xl": "36px",
      },
    },
  },
  plugins: [],
};
