'use client'

import { CalendarEvent } from '../../types/calendar'
import { DIAS_ABREV, dateKey, eventsForDate, hoursToTop, durToHeight, sameDay } from '../../lib/calendar'
import EventChip from './EventChip'

export default function WeekView({ date, events, onCreate, onEdit }: { date: Date; events: CalendarEvent[]; onCreate: (d: Date) => void; onEdit: (e: CalendarEvent) => void }) {
  const day = new Date(date); const weekday = day.getDay(); day.setDate(day.getDate() - (weekday === 0 ? 6 : weekday - 1)); day.setHours(0,0,0,0)
  const days = Array.from({length:7}, (_,i) => { const d = new Date(day); d.setDate(day.getDate()+i); return d })
  const hours = Array.from({length:15}, (_,i) => i+7)
  return <div className="cal-week-wrap"><div className="cal-week-header"><div className="cal-time-head" />{days.map(d=><div className={`cal-day-head ${sameDay(d,new Date())?'today':''}`} key={dateKey(d)}><span>{DIAS_ABREV[d.getDay()]}</span><strong>{d.getDate()}</strong></div>)}</div><div className="cal-week-grid"><div className="cal-time-axis">{hours.map(h=><div key={h}>{String(h).padStart(2,'0')}:00</div>)}</div>{days.map(d=><div className="cal-day-column" key={dateKey(d)} onClick={e => { if (e.currentTarget === e.target) onCreate(new Date(d)) }}><div className="cal-hour-lines">{hours.map(h=><div className="cal-hour-cell" key={h} onClick={() => { const x = new Date(d); x.setHours(h,0,0,0); onCreate(x) }}><span className="cal-half-line" /></div>)}</div>{eventsForDate(events,d).filter(e=>e.hour+e.min/60>=7 && e.hour<22).map(e=><div key={e.id} className="cal-positioned-event" style={{top:hoursToTop(e.hour,e.min),height:durToHeight(e.dur)}}><EventChip event={e} onClick={()=>onEdit(e)} /></div>)}</div>)}</div></div>
}
