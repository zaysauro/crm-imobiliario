'use client'

import { CalendarEvent, EVENT_COLORS } from '../../types/calendar'
import { dateKey, eventsForDate, DIAS_PT } from '../../lib/calendar'

export default function AgendaView({ date, events, onEdit }: { date: Date; events: CalendarEvent[]; onEdit: (e: CalendarEvent) => void }) {
  const days = Array.from({length:30},(_,i)=>{const d=new Date(date);d.setHours(0,0,0,0);d.setDate(d.getDate()+i);return d}).filter(d=>eventsForDate(events,d).length)
  return <div className="cal-agenda">{days.length===0?<div className="cal-empty">Nenhum evento nos próximos 30 dias.</div>:days.map(d=><section key={dateKey(d)} className="cal-agenda-day"><header><div><strong>{DIAS_PT[d.getDay()]}</strong><span>{d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}</span></div>{dateKey(d)===dateKey(new Date())&&<b>Hoje</b>}</header>{eventsForDate(events,d).map(e=>{const c=EVENT_COLORS[e.type];return <button key={e.id} className="cal-agenda-event" onClick={()=>onEdit(e)}><span className="cal-agenda-time">{String(e.hour).padStart(2,'0')}:{String(e.min).padStart(2,'0')} · {e.dur} min</span><i style={{background:c.border}}/><strong>{e.title}</strong><span className="cal-agenda-info">{e.lead??'Sem lead'} · {e.corretor||'Sem corretor'}</span><em style={{background:c.bg,color:c.text,borderColor:c.border}}>{c.label}</em></button>})}</section>)}</div>
}
