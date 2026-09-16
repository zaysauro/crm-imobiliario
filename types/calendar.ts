export type EventType = 'visita' | 'followup' | 'proposta' | 'ligacao' | 'reuniao'

export interface CalendarEvent {
  id: string
  type: EventType
  title: string
  lead?: string
  lead_id?: string
  date: string
  hour: number
  min: number
  dur: number
  corretor: string
  corretor_id?: string
  notes?: string
  created_at?: string
}

export type CalendarView = 'day' | 'week' | 'month' | 'agenda'

export const EVENT_TYPES: { value: EventType; label: string; bg: string; border: string; text: string; monthBg: string }[] = [
  { value: 'visita', label: 'Visita', bg: '#eff6ff', border: '#2563eb', text: '#1e40af', monthBg: '#dbeafe' },
  { value: 'followup', label: 'Follow-up', bg: '#f0fdf4', border: '#16a34a', text: '#15803d', monthBg: '#dcfce7' },
  { value: 'proposta', label: 'Proposta', bg: '#f5f3ff', border: '#7c3aed', text: '#6d28d9', monthBg: '#ede9fe' },
  { value: 'ligacao', label: 'Ligação', bg: '#fffbeb', border: '#d97706', text: '#b45309', monthBg: '#fef3c7' },
  { value: 'reuniao', label: 'Reunião', bg: '#fef2f2', border: '#dc2626', text: '#b91c1c', monthBg: '#fee2e2' },
]

export const EVENT_COLORS = Object.fromEntries(EVENT_TYPES.map(t => [t.value, t])) as Record<EventType, (typeof EVENT_TYPES)[number]>
