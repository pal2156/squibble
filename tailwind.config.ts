import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#EEF5F8",
          surface: "#E4EFF4",
          card: "#FFFFFF",
          elevated: "#D6E8EF",
        },
        border: {
          subtle: "rgba(92,124,137,0.12)",
          DEFAULT: "rgba(92,124,137,0.22)",
          strong: "rgba(92,124,137,0.42)",
        },
        ink: {
          DEFAULT: "#242424",
          secondary: "#4A6C7A",
          muted: "#7A9DAB",
        },
        accent: {
          DEFAULT: "#1F4959",
          hover: "#255e76",
          muted: "rgba(31,73,89,0.07)",
        },
        emerald: {
          glow: "rgba(52,211,153,0.12)",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Inter"',
          '"Segoe UI"',
          "sans-serif",
        ],
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "scale-in": "scaleIn 0.15s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
