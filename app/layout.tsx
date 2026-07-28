import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";

export const metadata: Metadata = {
  title: "SOL/USD · Sentiment Dashboard",
  description: "Predicción de precios de Solana con análisis de sentimiento de Reddit — Tesina LCC Datos",
};

/* Aplica el tema guardado antes del primer paint para evitar el flash blanco. */
const noFlash = `
(function(){
  try {
    var t = localStorage.getItem("sol-dashboard-theme");
    if (!t) t = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.style.colorScheme = t;
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlash }} />
      </head>
      <body className="min-h-screen bg-bg">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
