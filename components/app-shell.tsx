'use client'

import { ReactNode, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '../supabase-client'
import DashboardMiniKanban from './dashboard-mini-kanban'
import DashboardFunnel from './dashboard-funnel'

type Props = { children: ReactNode; role?: string; email?: string; title?: string }
const mainItems = [['/','⌂','Dashboard'],['/#leads','◉','Leads'],['/atendimentos','☷','Atendimentos'],['/kanban','▦','Kanban'],['/followups','◷','Follow-ups'],['/calendario','▣','Calendário'],['/importacao','⇩','Importar leads'],['/imoveis','⌂','Imóveis'],['/simulador','▤','Simulador'],['/contratos','▤','Contratos'],['/visitas','◷','Visitas'],['/propostas','✓','Propostas'],['/relatorios','▥','Relatórios'],['/dashboard-gerencial','▥','Dashboard Gerencial'],['/gestao','♙','Gestão da equipe'],['/auditoria','◌','Auditoria']] as const

export default function AppShell({ children, role = 'corretor', email = '', title = 'CRM Cadena' }: Props) {
  const pathname = usePathname(); const router = useRouter()
  const [darkMode,setDarkMode]=useState(false); const [collapsed,setCollapsed]=useState(false)
  async function logout(){const supabase=createClient();await supabase.auth.signOut();router.replace('/login')}
  useEffect(()=>{const saved=window.localStorage.getItem('sidebar-collapsed');setCollapsed(saved==='true');const savedTheme=window.localStorage.getItem('theme')||window.localStorage.getItem('crm-theme');const prefers=window.matchMedia('(prefers-color-scheme: dark)').matches;const dark=savedTheme==='dark'||(!savedTheme&&prefers);setDarkMode(dark);document.documentElement.classList.toggle('dark',dark);document.documentElement.dataset.theme=dark?'dark':'light'},[])
  const toggleTheme=()=>setDarkMode(v=>{const next=!v;document.documentElement.classList.toggle('dark',next);document.documentElement.dataset.theme=next?'dark':'light';window.localStorage.setItem('theme',next?'dark':'light');window.localStorage.setItem('crm-theme',next?'dark':'light');return next})
  const toggleSidebar=()=>setCollapsed(v=>{const next=!v;window.localStorage.setItem('sidebar-collapsed',String(next));return next})
  const showDashboardExtras=pathname==='/'
  const isActive=(href:string)=>pathname===href||(href!=='/'&&pathname.startsWith(href.split('#')[0]))
  const avatar=(email||'U').slice(0,1).toUpperCase()
  return <div className={`shell ${collapsed?'sidebar-collapsed':''}`}>
    <aside className={`sidebar ${collapsed?'collapsed':''}`}>
      <div className="sidebar-header"><div className="brand">CRM <span>Cadena</span></div><button className="sidebar-toggle" onClick={toggleSidebar} aria-label={collapsed?'Expandir sidebar':'Recolher sidebar'}>{collapsed?'›':'‹'}</button></div>
      <nav className="nav" aria-label="Navegação principal"><div className="nav-scroll">
        {mainItems.map(([href,icon,label])=><a key={href} href={href} title={collapsed?label:undefined} className={`nav-item ${isActive(href)?'active':''}`}><span className="nav-icon" aria-hidden="true">{icon}</span>{!collapsed&&<span className="nav-label">{label}</span>}</a>)}
        <div className="nav-divider" />
        <a href="/journal" title={collapsed?'Meu Journal':undefined} className={`nav-item ${isActive('/journal')?'active':''}`}><span className="nav-icon" aria-hidden="true">✎</span>{!collapsed&&<span className="nav-label">Meu Journal</span>}</a>
      </div></nav>
      <div className="sidebar-footer"><a href="/configuracoes" title={collapsed?'Configurações':undefined} className={`nav-item ${isActive('/configuracoes')?'active':''}`}><span className="nav-icon" aria-hidden="true">⚙</span>{!collapsed&&<span className="nav-label">Configurações</span>}</a><button className="sidebar-logout nav-item" onClick={toggleTheme} type="button" title={collapsed?(darkMode?'Modo claro':'Modo noturno'):undefined}><span className="nav-icon" aria-hidden="true">{darkMode?'☀️':'🌙'}</span>{!collapsed&&<span className="nav-label">{darkMode?'Modo claro':'Modo noturno'}</span>}</button><button className="sidebar-logout nav-item" onClick={logout}><span className="nav-icon" aria-hidden="true">↪</span>{!collapsed&&<span className="nav-label">Sair</span>}</button></div>
    </aside>
    <main className="main"><header className="topbar"><div className="mobile-topbar-brand"><span className="mobile-brand-icon" aria-hidden="true">🏠</span><strong>CRM Cadena</strong></div><strong className="desktop-topbar-title">{title}</strong><div className="topbar-user"><button className="mobile-notification" type="button" aria-label="Notificações">🔔</button><span className="desktop-user-text">{email}{email&&role?` · ${role}`:''}</span><span className="mobile-avatar" aria-label="Usuário">{avatar}</span><button className="btn topbar-exit" onClick={logout}>Sair</button></div></header>
      {showDashboardExtras&&<style>{`.dashboard-funnel{display:none!important}.dashboard-funnel-toggle{margin-top:24px}.funnel-switch{display:flex;gap:4px;padding:4px;border:1px solid var(--border,#e5e7eb);border-radius:10px;background:var(--surface,#fff)}.funnel-switch button{border:0;background:transparent;padding:7px 12px;border-radius:7px;cursor:pointer;font:inherit}.funnel-switch button.active{background:var(--text,#111827);color:#fff}.real-funnel{display:flex;flex-direction:column;align-items:center;gap:5px;padding:12px 0 4px}.real-funnel-row{width:100%;display:flex;justify-content:center}.real-funnel-shape{min-width:34%;height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 22px;border-radius:4px;clip-path:polygon(3% 0,97% 0,100% 100%,0 100%);font-weight:600;box-sizing:border-box}.real-funnel-shape strong{font-size:18px}.real-funnel-shape.blue{background:#dbeafe;color:#1e3a8a}.real-funnel-shape.amber{background:#fef3c7;color:#92400e}.real-funnel-shape.green{background:#dcfce7;color:#166534}.real-funnel-shape.red{background:#fee2e2;color:#991b1b}`}</style>}
      {children}{showDashboardExtras&&<><DashboardFunnel/><div className="dashboard-mini-kanban-slot"><DashboardMiniKanban/></div></>}</main></div>
}
