import { Newsreader } from "next/font/google";

import "./site.css";

/**
 * Mission 205 — grupo da página institucional. Fonte de título própria
 * (serifada, só para títulos) e CSS do site carregados apenas aqui: o
 * produto autenticado não recebe nada deste grupo.
 */
const displayFont = Newsreader({
  subsets: ["latin"],
  variable: "--font-site-display",
  display: "swap",
});

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${displayFont.variable} site-root flex min-h-full flex-col bg-background`}>{children}</div>;
}
