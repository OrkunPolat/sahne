import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "@sahne/ui/styles.css";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { ControlBar } from "@/components/ControlBar";

const display = Bricolage_Grotesque({ subsets: ["latin", "latin-ext"], variable: "--font-display", display: "swap" });
const body = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = { title: "Sahne", description: "Canlı etkileşim platformu" };

const THEME_SCRIPT = `(function(){try{var ok=["midnight-gold","obsidian-neon","cream-forest","burgundy-champagne"];var t=localStorage.getItem("sahne.theme");document.documentElement.setAttribute("data-theme",ok.indexOf(t)>=0?t:"midnight-gold");var l=localStorage.getItem("sahne.locale");if(l==="tr"||l==="en")document.documentElement.lang=l;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="tr"
      data-theme="midnight-gold"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable}`}
      style={{ "--font-display": display.style.fontFamily, "--font-body": body.style.fontFamily } as React.CSSProperties}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Providers>
          <ControlBar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
