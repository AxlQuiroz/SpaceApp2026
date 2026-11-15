import type { Metadata, Viewport } from "next";
import { Pixelify_Sans, Silkscreen, VT323 } from "next/font/google";
import { Providers } from "@/lib/providers";
import "./globals.css";

const pixelify = Pixelify_Sans({ subsets: ["latin"], variable: "--font-pixelify", display: "swap" });
const silkscreen = Silkscreen({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-silkscreen", display: "swap" });
const vt323 = VT323({ subsets: ["latin"], weight: "400", variable: "--font-vt323", display: "swap" });

export const metadata: Metadata = {
  title: "RockieOS · Luna y Marte",
  description: "Entrenador de decisiones y recursos en bases de la Luna y Marte para niños de 7 a 12 años.",
};

export const viewport: Viewport = { themeColor: "#0a0e16" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${pixelify.variable} ${silkscreen.variable} ${vt323.variable}`}>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
