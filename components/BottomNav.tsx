'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

const items=[
  {href:'/',icon:'⌂',label:'Dashboard'},
  {href:'/#leads',icon:'◉',label:'Leads'},
  {href:'/calendario',icon:'▣',label:'Calendário'},
  {href:'/journal',icon:'✎',label:'Journal'},
]
const more=[
  ['/atendimentos','Atendimentos'],['/kanban','Kanban'],['/followups','Follow-ups'],['/importacao','Importar leads'],['/imoveis','Imóveis'],['/simulador','Simulador'],['/contratos','Contratos'],['/visitas','Visitas'],['/propostas','Propostas'],['/relatorios','Relatórios'],['/dashboard-gerencial','Dashboard Gerencial'],['/gestao','Gestão da equipe'],['/auditoria','Auditoria'],['/configuracoes','Configurações'],
] as const

export default function BottomNav(){
 const pathname=usePathname();const router=useRouter();const [open,setOpen]=useState(false)
 const active=(href:string)=>pathname===href|| (href!=='/'&&pathname.startsWith(href.split('#')[0]))
 return <>
  <nav className="mobile-bottom-nav" aria-label="Navegação mobile">
   {items.map(i=><button key={i.href} type="button" className={active(i.href)?'active':''} onClick={()=>router.push(i.href)}><span aria-hidden="true">{i.icon}</span><small>{i.label}</small></button>)}
   <button type="button" className={open?'active':''} onClick={()=>setOpen(true)}><span aria-hidden="true">☰</span><small>Mais</small></button>
  </nav>
  {open&&<div className="mobile-more-overlay" onClick={()=>setOpen(false)}>
   <section className="mobile-more-drawer" role="dialog" aria-modal="true" aria-label="Mais opções" onClick={e=>e.stopPropagation()}>
    <div className="mobile-drawer-handle" />
    <div className="mobile-more-header"><strong>Menu</strong><button type="button" aria-label="Fechar menu" onClick={()=>setOpen(false)}>×</button></div>
    <div className="mobile-more-grid">{more.map(([href,label])=><button key={href} type="button" className={active(href)?'active':''} onClick={()=>{setOpen(false);router.push(href)}}>{label}</button>)}</div>
   </section>
  </div>}
 </>
}
