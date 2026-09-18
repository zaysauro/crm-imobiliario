create type public.user_role as enum ('admin', 'gerente', 'corretor');
create type public.lead_status as enum ('novo', 'em_atendimento', 'visita', 'proposta', 'ganho', 'perdido');
create type public.activity_type as enum ('ligacao', 'whatsapp', 'observacao', 'status_alterado', 'visita');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  email text,
  role public.user_role not null default 'corretor',
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  email text,
  origem text,
  status public.lead_status not null default 'novo',
  observacoes text,
  responsavel_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  tipo public.activity_type not null,
  descricao text,
  created_at timestamptz not null default now()
);

create index leads_responsavel_idx on public.leads(responsavel_id);
create index leads_status_idx on public.leads(status);
create index leads_created_at_idx on public.leads(created_at desc);
create index activities_lead_idx on public.activities(lead_id, created_at desc);

create or replace function public.is_manager_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'gerente')
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(coalesce(new.email, ''), '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.activities enable row level security;

create policy "profiles: authenticated can read"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles: users update themselves"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "leads: managers read all"
  on public.leads for select
  to authenticated
  using (public.is_manager_or_admin());

create policy "leads: assigned users read"
  on public.leads for select
  to authenticated
  using (responsavel_id = auth.uid());

create policy "leads: managers insert"
  on public.leads for insert
  to authenticated
  with check (public.is_manager_or_admin());

create policy "leads: assigned users insert"
  on public.leads for insert
  to authenticated
  with check (responsavel_id = auth.uid());

create policy "leads: managers update"
  on public.leads for update
  to authenticated
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());

create policy "leads: assigned users update"
  on public.leads for update
  to authenticated
  using (responsavel_id = auth.uid())
  with check (responsavel_id = auth.uid());

create policy "leads: managers delete"
  on public.leads for delete
  to authenticated
  using (public.is_manager_or_admin());

create policy "activities: managers read all"
  on public.activities for select
  to authenticated
  using (public.is_manager_or_admin());

create policy "activities: users read own lead activity"
  on public.activities for select
  to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_id and l.responsavel_id = auth.uid()
    )
  );

create policy "activities: authenticated insert"
  on public.activities for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.leads l
      where l.id = lead_id
      and (l.responsavel_id = auth.uid() or public.is_manager_or_admin())
    )
  );


-- Histórico de simulações vinculadas aos leads
create table public.lead_simulations (
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
create index lead_simulations_lead_idx on public.lead_simulations(lead_id, created_at desc);
alter table public.lead_simulations enable row level security;
create policy "lead simulations: management read" on public.lead_simulations for select to authenticated using (public.is_manager_or_admin());
create policy "lead simulations: assigned read" on public.lead_simulations for select to authenticated using (exists (select 1 from public.leads l where l.id=lead_id and l.responsavel_id=auth.uid()));
create policy "lead simulations: assigned insert" on public.lead_simulations for insert to authenticated with check (user_id=auth.uid() and exists (select 1 from public.leads l where l.id=lead_id and (l.responsavel_id=auth.uid() or public.is_manager_or_admin())));
