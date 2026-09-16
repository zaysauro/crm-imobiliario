-- Rodar manualmente no Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('visita','reuniao','treinamento')),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  description text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  participants uuid[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT calendar_events_end_after_start CHECK (end_at > start_at)
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos veem eventos" ON public.calendar_events
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Autenticados criam eventos" ON public.calendar_events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Criador ou gestor edita" ON public.calendar_events
  FOR ALL USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin','gerente')
    )
  )
  WITH CHECK (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin','gerente')
    )
  );

CREATE OR REPLACE FUNCTION public.set_calendar_event_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.set_calendar_event_updated_at();

-- Vincula visitas criadas pelo calendário à agenda de visitas existente.
ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS calendar_event_id uuid UNIQUE REFERENCES public.calendar_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_start_at ON public.calendar_events(start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_lead_id ON public.calendar_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON public.calendar_events(created_by);
CREATE INDEX IF NOT EXISTS idx_visits_calendar_event_id ON public.visits(calendar_event_id);
