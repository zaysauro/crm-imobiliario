'use client'

import { CalendarEvent } from '../../types/calendar'
import { DIAS_ABREV, dateKey, eventsForDate, sameDay } from '../../lib/calendar'
import EventChip from './EventChip'

export default function MonthView({ date, events, onCreate, onEdit }: { date: Date; events: CalendarEvent[]; onCreate: (d: Date) => void; onEdit: (e: CalendarEvent) => void }) {
  const first = new Date(date.getFullYear(),date.getMonth(),1); const offset = first.getDay()===0?6:first.getDay()-1; first.setDate(first.getDate()-offset)
  const days = Array.from({length:42},(_,i)=>{const d=new Date(first);d.setDate(first.getDate()+i);return d})
  return <div className="cal-month"><div className="cal-month-weekdays">{DIAS_ABREV.slice(1).concat(DIAS_ABREV[0]).map(d=><div key={d}>{d}</div>)}</div><div className="cal-month-grid">{days.map(d=>{const dayEvents=eventsForDate(events,d);return <div className={`cal-month-cell ${d.getMonth()!==date.getMonth()?'outside':''} ${sameDay(d,new Date())?'today':''}`} key={dateKey(d)} onClick={()=>onCreate(new Date(d))}><div className="cal-month-number">{d.getDate()}</div><div className="cal-month-events">{dayEvents.slice(0,2).map(e=><EventChip key={e.id} event={e} compact onClick={()=>onEdit(e)}/>)}</div>{dayEvents.length>2&&<button className="cal-more" onClick={e=>{e.stopPropagation();onCreate(new Date(d))}}>+{dayEvents.length-2} mais</button>}</div>})}</div></div>
}
