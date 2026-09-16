'use client'

import { CalendarEvent, EVENT_COLORS } from '../../types/calendar'

export default function EventChip({ event, onClick, compact = false }: { event: CalendarEvent; onClick?: () => void; compact?: boolean }) {
  const c = EVENT_COLORS[event.type]
  return <button type="button" className={`cal-event-chip ${compact ? 'compact' : ''}`} style={{ backgroundColor: c.bg, borderLeftColor: c.border, color: c.text }} onClick={e => { e.stopPropagation(); onClick?.() }} title={event.title}>
    <span className="cal-event-time">{String(event.hour).padStart(2,'0')}:{String(event.min).padStart(2,'0')}</span>
    <strong>{event.title}</strong>
    {!compact && event.lead && <span className="cal-event-meta">{event.lead}</span>}
  </button>
}
