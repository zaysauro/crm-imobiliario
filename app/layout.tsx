import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "./dark-mode.css";
import "./responsive.css";
import "./theme.css";
import "./sidebar-theme.css";
import "./mobile-theme.css";
import FollowupNotifier from "../components/followup-notifier";
import BottomNav from "../components/BottomNav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "CRM Cadena", description: "CRM comercial da Cadena para gestão de leads e atendimentos imobiliários." };

const themeScript = `(()=>{try{const s=localStorage.getItem('theme')||localStorage.getItem('crm-theme');const d=s==='dark'||(!s&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><head><Script id="theme-init" strategy="beforeInteractive">{themeScript}</Script></head><body>{children}<FollowupNotifier/><BottomNav/></body></html>;
}
