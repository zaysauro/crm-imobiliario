'use client'

import { CalendarEvent } from '../../types/calendar'
import { dateKey, eventsForDate, hoursToTop, durToHeight, formatDayTitle } from '../../lib/calendar'
import EventChip from './EventChip'

export default function DayView({ date, events, onCreate, onEdit }: { date: Date; events: CalendarEvent[]; onCreate: (d: Date) => void; onEdit: (e: CalendarEvent) => void }) {
  const hours = Array.from({length:15}, (_,i)=>i+7)
  return <div className="cal-day-wrap"><div className="cal-single-head">{formatDayTitle(date)}</div><div className="cal-day-grid"><div className="cal-time-axis">{hours.map(h=><div key={h}>{String(h).padStart(2,'0')}:00</div>)}</div><div className="cal-day-column" onClick={e=>{if(e.currentTarget===e.target)onCreate(new Date(date))}}><div className="cal-hour-lines">{hours.map(h=><div className="cal-hour-cell" key={h} onClick={()=>{const d=new Date(date);d.setHours(h,0,0,0);onCreate(d)}}><span className="cal-half-line"/></div>)}</div>{eventsForDate(events,date).filter(e=>e.hour>=7&&e.hour<22).map(e=><div key={e.id} className="cal-positioned-event" style={{top:hoursToTop(e.hour,e.min),height:durToHeight(e.dur)}}><EventChip event={e} onClick={()=>onEdit(e)}/></div>)}</div></div></div>
}
