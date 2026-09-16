'use client'

import { CalendarEvent } from '../../types/calendar'
import { MESES_PT, dateKey, sameDay } from '../../lib/calendar'

export default function MiniCalendar({ date, events, onChange }: { date: Date; events: CalendarEvent[]; onChange: (d: Date) => void }) {
  const first=new Date(date.getFullYear(),date.getMonth(),1);const offset=first.getDay()===0?6:first.getDay()-1;first.setDate(first.getDate()-offset)
  const days=Array.from({length:42},(_,i)=>{const d=new Date(first);d.setDate(first.getDate()+i);return d})
  const has=(d:Date)=>events.some(e=>e.date===dateKey(d))
  const shift=(n:number)=>{const d=new Date(date);d.setMonth(d.getMonth()+n);onChange(d)}
  return <div className="cal-mini"><div className="cal-mini-head"><button onClick={()=>shift(-1)}>‹</button><strong>{MESES_PT[date.getMonth()]} {date.getFullYear()}</strong><button onClick={()=>shift(1)}>›</button></div><div className="cal-mini-week">{['S','T','Q','Q','S','S','D'].map((x,i)=><span key={i}>{x}</span>)}</div><div className="cal-mini-grid">{days.map(d=><button key={dateKey(d)} className={`${d.getMonth()!==date.getMonth()?'outside':''} ${sameDay(d,date)?'selected':''} ${sameDay(d,new Date())?'today':''}`} onClick={()=>onChange(new Date(d))}>{d.getDate()}{has(d)&&<i/>}</button>)}</div></div>
}
