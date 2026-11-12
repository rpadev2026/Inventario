import type { Metadata } from "next";
import { Poppins, Open_Sans } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

// Tipografía de la aplicación: Poppins (títulos y botones) + Open Sans (texto). Poppins no es variable (un archivo por grosor):
// solo se carga el 600, el único que usa tema.css. Open Sans sí es variable: un solo archivo cubre todos sus grosores.
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["600"], display: "swap" });
const openSans = Open_Sans({ variable: "--font-open-sans", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Inventario del Restaurant",
  description: "Control de insumos y materia prima",
};

// Dinámico siempre: el nonce de la CSP (proxy.ts) cambia en cada petición y las páginas prerenderizadas no lo llevarían.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  return (
    <html
      lang="es"
      className={`${poppins.variable} ${openSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
