import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM Cadena",
  description: "CRM comercial da Cadena para gestão de leads e atendimentos imobiliários.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
