import { CalendarEvent } from '../types/calendar'

export const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
export const DIAS_PT = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
export const DIAS_ABREV = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

export function getWeekStart(date: Date) { const d = new Date(date); d.setHours(0,0,0,0); const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); return d }
export function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` }
export function sameDay(a: Date, b: Date) { return dateKey(a) === dateKey(b) }
export function formatMonthTitle(date: Date) { return `${MESES_PT[date.getMonth()]} ${date.getFullYear()}` }
export function formatDayTitle(date: Date) { return `${DIAS_PT[date.getDay()]}, ${date.getDate()} de ${MESES_PT[date.getMonth()].toLowerCase()} de ${date.getFullYear()}` }
export function hoursToTop(hour: number, min: number) { return ((hour - 7) * 60 + min) }
export function durToHeight(dur: number) { return Math.max(20, dur) }
export function eventDateTime(event: CalendarEvent) { const d = new Date(`${event.date}T00:00:00`); d.setHours(event.hour, event.min, 0, 0); return d }
export function eventsForDate(events: CalendarEvent[], date: Date) { return events.filter(e => e.date === dateKey(date)).sort((a,b) => a.hour*60+a.min-b.hour*60-b.min) }
