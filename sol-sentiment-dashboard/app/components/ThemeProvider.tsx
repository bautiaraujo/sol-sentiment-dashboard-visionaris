"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Theme = "dark" | "light";

/* ────────────────────────────────────────────────────────────── */
/*  PALETAS                                                      */
/*  Los charts de ECharts se dibujan en canvas, así que no       */
/*  resuelven var(--x). Necesitan valores literales por tema.    */
/* ────────────────────────────────────────────────────────────── */
export interface Palette {
  bg: string; card: string; border: string; borderSoft: string; grid: string;
  heading: string; body: string; muted: string;
  real: string; baseline: string; full: string;
  reddit: string; fg: string; combined: string; forecast: string;
  positive: string; negative: string;
  tooltipBg: string;
}

export const PALETTES: Record<Theme, Palette> = {
  dark: {
    bg: "#060D1F", card: "#0C1830", border: "#1E3A5F", borderSoft: "#111F38", grid: "#1E3A5F",
    heading: "#E8F4FF", body: "#9BB5D5", muted: "#6B89B0",
    real: "#E8F4FF", baseline: "#F5A623", full: "#4F80FF",
    reddit: "#FF6B35", fg: "#10CFAA", combined: "#9B6BFF", forecast: "#9B6BFF",
    positive: "#10CFAA", negative: "#FF4D6A",
    tooltipBg: "rgba(12,24,48,0.96)",
  },
  light: {
    bg: "#F1F5FA", card: "#FFFFFF", border: "#D5E1F0", borderSoft: "#E6EDF6", grid: "#DEE8F4",
    heading: "#08172E", body: "#3B587A", muted: "#7089A8",
    real: "#0B1B33", baseline: "#C87A00", full: "#2E5FE8",
    reddit: "#DB4A11", fg: "#00907A", combined: "#7141D8", forecast: "#7141D8",
    positive: "#00907A", negative: "#D62445",
    tooltipBg: "rgba(255,255,255,0.97)",
  },
};

interface Ctx { theme: Theme; palette: Palette; toggle: () => void }
const ThemeCtx = createContext<Ctx>({ theme: "dark", palette: PALETTES.dark, toggle: () => {} });

export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (typeof window !== "undefined"
      ? window.localStorage.getItem("sol-dashboard-theme")
      : null) as Theme | null;
    const prefersLight =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: light)").matches;
    setTheme(stored ?? (prefersLight ? "light" : "dark"));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("sol-dashboard-theme", theme);
  }, [theme, mounted]);

  const toggle = useCallback(() => setTheme(t => (t === "dark" ? "light" : "dark")), []);

  return (
    <ThemeCtx.Provider value={{ theme, palette: PALETTES[theme], toggle }}>
      {children}
    </ThemeCtx.Provider>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  BOTÓN DE TOGGLE                                              */
/* ────────────────────────────────────────────────────────────── */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
      className="theme-toggle"
    >
      <span className="theme-toggle-track">
        <span className="theme-toggle-thumb">{isDark ? "☾" : "☀"}</span>
      </span>
      <span className="theme-toggle-label">{isDark ? "Oscuro" : "Claro"}</span>
    </button>
  );
}
