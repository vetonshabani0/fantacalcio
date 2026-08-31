import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import { Chrome } from "@/components/Chrome";
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
  themeColor: "#08090a",
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
    <html lang="it" className={`${archivo.variable} ${inter.variable}`}>
      <body>
        <Chrome>{children}</Chrome>
      </body>
    </html>
  );
}
