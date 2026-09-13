-- Módulos comerciais do CRM Cadena
-- Execute este arquivo no SQL Editor do projeto Supabase.

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  empreendimento text,
  unidade text,
  tipo text,
  area_m2 numeric,
  valor numeric,
  status text not null default 'disponivel' check (status in ('disponivel','reservado','vendido','indisponivel')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  property_id uuid references public.properties(id) on delete set null,
  assigned_to uuid not null references public.profiles(id) on delete restrict,
  scheduled_at timestamptz not null,
  status text not null default 'agendada' check (status in ('agendada','confirmada','realizada','cancelada','nao_compareceu')),
  notes text,
  result text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  property_id uuid references public.properties(id) on delete set null,
  assigned_to uuid not null references public.profiles(id) on delete restrict,
  value numeric,
  status text not null default 'rascunho' check (status in ('rascunho','enviada','em_negociacao','aprovada','recusada','cancelada')),
  valid_until date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_properties_status on public.properties(status);
create index if not exists idx_visits_lead on public.visits(lead_id);
create index if not exists idx_visits_assigned on public.visits(assigned_to);
create index if not exists idx_visits_scheduled on public.visits(scheduled_at);
create index if not exists idx_proposals_lead on public.proposals(lead_id);
create index if not exists idx_proposals_assigned on public.proposals(assigned_to);
create index if not exists idx_proposals_status on public.proposals(status);

-- Reutiliza o gatilho set_updated_at já criado no schema principal.
drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at before update on public.properties
for each row execute function public.set_updated_at();

drop trigger if exists visits_set_updated_at on public.visits;
create trigger visits_set_updated_at before update on public.visits
for each row execute function public.set_updated_at();

drop trigger if exists proposals_set_updated_at on public.proposals;
create trigger proposals_set_updated_at before update on public.proposals
for each row execute function public.set_updated_at();

alter table public.properties enable row level security;
alter table public.visits enable row level security;
alter table public.proposals enable row level security;

drop policy if exists properties_read_authenticated on public.properties;
create policy properties_read_authenticated on public.properties for select to authenticated using (true);

drop policy if exists properties_manage_manager on public.properties;
create policy properties_manage_manager on public.properties for all to authenticated
using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());

drop policy if exists visits_read_own_or_manager on public.visits;
create policy visits_read_own_or_manager on public.visits for select to authenticated
using (public.is_manager_or_admin() or assigned_to = auth.uid());

drop policy if exists visits_insert_own_or_manager on public.visits;
create policy visits_insert_own_or_manager on public.visits for insert to authenticated
with check (public.is_manager_or_admin() or assigned_to = auth.uid());

drop policy if exists visits_update_own_or_manager on public.visits;
create policy visits_update_own_or_manager on public.visits for update to authenticated
using (public.is_manager_or_admin() or assigned_to = auth.uid())
with check (public.is_manager_or_admin() or assigned_to = auth.uid());

drop policy if exists visits_delete_manager on public.visits;
create policy visits_delete_manager on public.visits for delete to authenticated
using (public.is_manager_or_admin());

drop policy if exists proposals_read_own_or_manager on public.proposals;
create policy proposals_read_own_or_manager on public.proposals for select to authenticated
using (public.is_manager_or_admin() or assigned_to = auth.uid());

drop policy if exists proposals_insert_own_or_manager on public.proposals;
create policy proposals_insert_own_or_manager on public.proposals for insert to authenticated
with check (public.is_manager_or_admin() or assigned_to = auth.uid());

drop policy if exists proposals_update_own_or_manager on public.proposals;
create policy proposals_update_own_or_manager on public.proposals for update to authenticated
using (public.is_manager_or_admin() or assigned_to = auth.uid())
with check (public.is_manager_or_admin() or assigned_to = auth.uid());

drop policy if exists proposals_delete_manager on public.proposals;
create policy proposals_delete_manager on public.proposals for delete to authenticated
using (public.is_manager_or_admin());
