'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../supabase-client'

type Lead = { status: string }
const stages=[['novo','Novo'],['em_atendimento','Em atendimento'],['visita','Visita'],['proposta','Proposta'],['ganho','Ganho'],['perdido','Perdido']] as const
const tone:Record<string,string>={novo:'blue',em_atendimento:'amber',visita:'green',proposta:'amber',ganho:'green',perdido:'red'}

export default function DashboardFunnel(){
 const supabase=useMemo(()=>createClient(),[])
 const [leads,setLeads]=useState<Lead[]>([])
 const [view,setView]=useState<'bars'|'funnel'>('bars')
 useEffect(()=>{supabase.from('leads').select('status').limit(500).then(({data})=>setLeads((data??[]) as Lead[]))},[supabase])
 const count=(status:string)=>leads.filter(l=>l.status===status).length
 const max=Math.max(1,...stages.map(([id])=>count(id)))
 return <section className="card dashboard-funnel-toggle"><div className="toolbar"><div><h2 className="section-title">Funil de vendas</h2><div className="sub">Alterne entre a visão de barras e um funil visual do processo comercial.</div></div><div className="funnel-switch"><button className={view==='bars'?'active':''} onClick={()=>setView('bars')}>Barras</button><button className={view==='funnel'?'active':''} onClick={()=>setView('funnel')}>Funil</button></div></div>{view==='bars'?<div className="funnel-list">{stages.map(([id,label],i)=>{const n=count(id);const width=leads.length&&n?Math.max(8,Math.round(n/leads.length*100)):0;return <div className="funnel-row" key={id}><div className="funnel-label"><span>{String(i+1).padStart(2,'0')}</span><strong>{label}</strong><b>{n}</b></div><div className="funnel-track"><div className={`funnel-fill ${tone[id]}`} style={{width:`${width}%`}}/></div></div>})}</div>:<div className="real-funnel">{stages.map(([id,label],i)=>{const n=count(id);const width=Math.max(34,Math.round((n/max)*100));return <div className="real-funnel-row" key={id}><div className={`real-funnel-shape ${tone[id]}`} style={{width:`${width}%`}}><span>{String(i+1).padStart(2,'0')} · {label}</span><strong>{n}</strong></div></div>})}</div>}</section>
}
