-- CRM Cadena — histórico de simulações vinculadas aos leads
create table if not exists public.lead_simulations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  titulo text not null default 'Simulação MCMV',
  input_data jsonb not null default '{}'::jsonb,
  property_data jsonb not null default '{}'::jsonb,
  result_data jsonb not null default '{}'::jsonb,
  pdf_generated boolean not null default false,
  pdf_generated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists lead_simulations_lead_idx
  on public.lead_simulations(lead_id, created_at desc);

alter table public.lead_simulations enable row level security;

drop policy if exists "lead simulations: management read" on public.lead_simulations;
create policy "lead simulations: management read"
on public.lead_simulations
for select to authenticated
using (public.is_manager_or_admin());

drop policy if exists "lead simulations: assigned read" on public.lead_simulations;
create policy "lead simulations: assigned read"
on public.lead_simulations
for select to authenticated
using (
  exists (
    select 1 from public.leads l
    where l.id = lead_id
      and l.responsavel_id = auth.uid()
      and l.deleted_at is null
  )
);

drop policy if exists "lead simulations: assigned insert" on public.lead_simulations;
create policy "lead simulations: assigned insert"
on public.lead_simulations
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.leads l
    where l.id = lead_id
      and (l.responsavel_id = auth.uid() or public.is_manager_or_admin())
      and l.deleted_at is null
  )
);

-- Mantém o evento visível no histórico de atendimento sem alterar o enum
-- activity_type existente: a simulação é registrada como uma observação
-- automaticamente pelo simulador depois que o PDF é gerado.
