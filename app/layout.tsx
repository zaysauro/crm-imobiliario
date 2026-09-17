import type { Metadata } from "next";
import "./globals.css";
import "./dark-mode.css";
import "./responsive.css";
import FollowupNotifier from "../components/followup-notifier";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CRM Cadena",
  description: "CRM comercial da Cadena para gestão de leads e atendimentos imobiliários.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}<FollowupNotifier /></body>
    </html>
  );
}
