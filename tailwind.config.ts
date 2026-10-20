import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        graphite: { 900: "#0B0F0C", 800: "#111713", 700: "#161E18", 600: "#1D271F" },
        line: "#2A362C",
        gold: { DEFAULT: "#C8A44D", soft: "#E0C57F", dark: "#8F7331" },
        oliva: "#2E5B3A",
        rubro: "#A32B2B",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      keyframes: {
        fumaca: {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)", opacity: "0.55" },
          "50%": { transform: "translate3d(4%,-3%,0) scale(1.18)", opacity: "0.85" },
        },
        brilho: { "0%": { left: "-140%" }, "100%": { left: "140%" } },
      },
      animation: {
        fumaca: "fumaca 18s ease-in-out infinite",
        brilho: "brilho 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
