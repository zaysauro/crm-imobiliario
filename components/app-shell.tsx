'use client'

import { ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '../supabase-client'
import DashboardMiniKanban from './dashboard-mini-kanban'
import DashboardFunnel from './dashboard-funnel'

type Props = { children: ReactNode; role?: string; email?: string; title?: string }
const items = [['/','Dashboard'],['/#leads','Leads'],['/atendimentos','Atendimentos'],['/kanban','Kanban'],['/followups','Follow-ups'],['/importacao','Importar leads'],['/imoveis','Imóveis'],['/contratos','Contratos'],['/visitas','Visitas'],['/propostas','Propostas'],['/relatorios','Relatórios'],['/dashboard-gerencial','Dashboard Gerencial'],['/gestao','Gestão da equipe'],['/auditoria','Auditoria'],['/configuracoes','Configurações']] as const

export default function AppShell({ children, role = 'corretor', email = '', title = 'CRM Cadena' }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  async function logout() { const supabase = createClient(); await supabase.auth.signOut(); router.replace('/login') }
  const showDashboardExtras = pathname === '/'
  return <div className="shell"><aside className="sidebar"><div className="brand">CRM <span>Cadena</span></div><nav className="nav">{items.map(([href, label]) => <a key={href} href={href} className={(pathname === href || (href !== '/' && pathname.startsWith(href.split('#')[0]))) ? 'active' : ''}>{label}</a>)}</nav></aside><main className="main"><header className="topbar"><strong>{title}</strong><div className="topbar-user"><span>{email}{email && role ? ` · ${role}` : ''}</span><button className="btn" onClick={logout}>Sair</button></div></header>{showDashboardExtras&&<style>{`.dashboard-funnel{display:none!important}.dashboard-funnel-toggle{margin-top:24px}.funnel-switch{display:flex;gap:4px;padding:4px;border:1px solid var(--border,#e5e7eb);border-radius:10px;background:var(--surface,#fff)}.funnel-switch button{border:0;background:transparent;padding:7px 12px;border-radius:7px;cursor:pointer;font:inherit}.funnel-switch button.active{background:var(--text,#111827);color:#fff}.real-funnel{display:flex;flex-direction:column;align-items:center;gap:5px;padding:12px 0 4px}.real-funnel-row{width:100%;display:flex;justify-content:center}.real-funnel-shape{min-width:34%;height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 22px;border-radius:4px;clip-path:polygon(3% 0,97% 0,100% 100%,0 100%);font-weight:600;box-sizing:border-box}.real-funnel-shape strong{font-size:18px}.real-funnel-shape.blue{background:#dbeafe;color:#1e3a8a}.real-funnel-shape.amber{background:#fef3c7;color:#92400e}.real-funnel-shape.green{background:#dcfce7;color:#166534}.real-funnel-shape.red{background:#fee2e2;color:#991b1b}`}</style>}{children}{showDashboardExtras&&<><DashboardFunnel /><div className="dashboard-mini-kanban-slot"><DashboardMiniKanban /></div></>}</main></div>
}
