import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import { Chrome } from "@/components/Chrome";
import { LocaleProvider } from "@/components/LocaleProvider";
import {
  THEME_INIT_SCRIPT,
  ThemeProvider,
} from "@/components/ThemeProvider";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FantaLive — il fantacalcio, minuto per minuto",
  description:
    "Classifica, scontro diretto e sostituzioni della tua lega, aggiornati in diretta durante le partite di Serie A.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#08090a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={`${archivo.variable} ${inter.variable}`}
    >
      <head>
        {/* Applies a stored dark choice before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <LocaleProvider>
            <Chrome>{children}</Chrome>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
