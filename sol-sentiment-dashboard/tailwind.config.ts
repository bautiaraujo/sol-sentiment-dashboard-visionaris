import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-raleway)", "sans-serif"],
        mono:    ["var(--font-fira)", "monospace"],
      },
      /* Todos los tokens apuntan a variables CSS: cambian solos con el tema */
      colors: {
        bg:       "var(--c-bg)",
        card:     "var(--c-card)",
        border:   "var(--c-border)",
        soft:     "var(--c-soft)",
        primary:  "var(--c-primary)",
        positive: "var(--c-positive)",
        negative: "var(--c-negative)",
        baseline: "var(--c-baseline)",
        muted:    "var(--c-muted)",
        heading:  "var(--c-heading)",
        body:     "var(--c-body)",
        reddit:   "var(--c-reddit)",
        fgidx:    "var(--c-fg)",
        forecast: "var(--c-forecast)",
      },
      boxShadow: {
        glow: "0 0 24px rgba(var(--rgb-primary), 0.15)",
        card: "var(--card-shadow)",
      },
    },
  },
  plugins: [],
};
export default config;
