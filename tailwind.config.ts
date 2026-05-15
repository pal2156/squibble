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
          base: "#F1F6F9",
          surface: "#FFFFFF",
          card: "#FFFFFF",
          elevated: "#F1F6F9",
        },
        border: {
          subtle: "#BBD2DD",
          DEFAULT: "#BBD2DD",
          strong: "#678E8D",
        },
        ink: {
          DEFAULT: "#232C33",
          secondary: "#3C5352",
          muted: "rgba(60,83,82,0.6)",
        },
        accent: {
          DEFAULT: "#678E8D",
          hover: "#3C5352",
          muted: "rgba(103,142,141,0.1)",
        },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "DM Sans", "sans-serif"],
      },
      letterSpacing: {
        logo: "-0.05em",
        heading: "-0.03em",
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
