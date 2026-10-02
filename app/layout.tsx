import type { Metadata } from "next";
import { Geist, Geist_Mono, Poppins, Open_Sans } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Tipografía de la aplicación: Poppins (títulos y botones) + Open Sans (texto).
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });
const openSans = Open_Sans({ variable: "--font-open-sans", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Inventario del Restaurant",
  description: "Control de insumos y materia prima",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} ${openSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
