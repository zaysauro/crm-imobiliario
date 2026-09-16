-- Calendário completo: compatível com a tabela 007 já existente.
-- Execute no Supabase SQL Editor.

ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS date date;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS hour integer;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS min integer DEFAULT 0;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS dur integer DEFAULT 60;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS lead_name text;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS corretor_id uuid;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS corretor_name text;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS notes text;

UPDATE public.calendar_events SET date = (start_at AT TIME ZONE 'America/Sao_Paulo')::date WHERE date IS NULL;
UPDATE public.calendar_events SET hour = EXTRACT(HOUR FROM (start_at AT TIME ZONE 'America/Sao_Paulo'))::integer WHERE hour IS NULL;
UPDATE public.calendar_events SET min = EXTRACT(MINUTE FROM (start_at AT TIME ZONE 'America/Sao_Paulo'))::integer WHERE min IS NULL;
UPDATE public.calendar_events SET dur = GREATEST(15, EXTRACT(EPOCH FROM (end_at-start_at))/60)::integer WHERE dur IS NULL;
UPDATE public.calendar_events e SET lead_name = l.nome FROM public.leads l WHERE e.lead_id=l.id AND e.lead_name IS NULL;
UPDATE public.calendar_events e SET corretor_id=e.created_by WHERE e.corretor_id IS NULL;
UPDATE public.calendar_events e SET corretor_name=COALESCE(p.nome,p.email) FROM public.profiles p WHERE e.corretor_id=p.id AND e.corretor_name IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='organization_id') THEN
    UPDATE public.calendar_events e SET organization_id=p.organization_id FROM public.profiles p WHERE e.created_by=p.id AND e.organization_id IS NULL;
  END IF;
END $$;

ALTER TABLE public.calendar_events ALTER COLUMN date SET NOT NULL;
ALTER TABLE public.calendar_events ALTER COLUMN hour SET NOT NULL;
ALTER TABLE public.calendar_events ALTER COLUMN min SET DEFAULT 0;
ALTER TABLE public.calendar_events ALTER COLUMN dur SET DEFAULT 60;

CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON public.calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_corretor ON public.calendar_events(corretor_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_org_date ON public.calendar_events(organization_id,date);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Todos veem eventos" ON public.calendar_events;
DROP POLICY IF EXISTS "Autenticados criam eventos" ON public.calendar_events;
DROP POLICY IF EXISTS "Criador ou gestor edita" ON public.calendar_events;
DROP POLICY IF EXISTS "org members can manage events" ON public.calendar_events;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='organization_id') THEN
    CREATE POLICY "org members can manage calendar events" ON public.calendar_events FOR ALL TO authenticated
      USING (organization_id IS NOT DISTINCT FROM (SELECT organization_id FROM public.profiles WHERE id=auth.uid()))
      WITH CHECK (organization_id IS NOT DISTINCT FROM (SELECT organization_id FROM public.profiles WHERE id=auth.uid()));
  ELSE
    CREATE POLICY "authenticated calendar events" ON public.calendar_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
