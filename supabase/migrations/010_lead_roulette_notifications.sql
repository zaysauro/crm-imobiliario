-- CRM Cadena — roleta manual de distribuição + notificações de novos leads
-- A roleta distribui os leads ainda sem responsável entre os corretores selecionados.
-- Não existe atraso entre leads: a distribuição é imediata.

create table if not exists public.lead_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists lead_notifications_user_created_idx
  on public.lead_notifications(user_id, created_at desc);

create index if not exists lead_notifications_unread_idx
  on public.lead_notifications(user_id, read_at)
  where read_at is null;

alter table public.lead_notifications enable row level security;

drop policy if exists "lead notifications: own read" on public.lead_notifications;
create policy "lead notifications: own read"
  on public.lead_notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "lead notifications: own update" on public.lead_notifications;
create policy "lead notifications: own update"
  on public.lead_notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.distribute_pending_leads(p_corretor_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_org uuid;
  v_batch uuid;
  v_lead record;
  v_corretor uuid;
  v_index integer := 0;
  v_total integer := 0;
begin
  v_role := public.current_user_role();

  if v_role not in ('admin', 'gerente') then
    raise exception 'Apenas gerente ou administrador pode iniciar a roleta';
  end if;

  if p_corretor_ids is null or cardinality(p_corretor_ids) = 0 then
    raise exception 'Selecione pelo menos um corretor';
  end if;

  select organization_id into v_org
  from public.profiles
  where id = auth.uid();

  if v_org is null then
    raise exception 'Usuário sem organização configurada';
  end if;

  -- Apenas corretores da mesma organização podem participar.
  if exists (
    select 1
    from unnest(p_corretor_ids) ids(id)
    left join public.profiles p on p.id = ids.id
    where p.id is null
       or p.role <> 'corretor'
       or p.organization_id is distinct from v_org
  ) then
    raise exception 'A lista contém um corretor inválido ou de outra organização';
  end if;

  -- Evita duas roletas simultâneas disputando os mesmos leads.
  perform pg_advisory_xact_lock(hashtext('crm-cadena-lead-roulette'));

  insert into public.lead_distribution_batches (
    created_by,
    strategy,
    total_leads,
    notes
  ) values (
    auth.uid(),
    'round_robin',
    0,
    'Roleta manual de leads pendentes'
  )
  returning id into v_batch;

  for v_lead in
    select l.id, l.nome
    from public.leads l
    where l.organization_id = v_org
      and l.responsavel_id is null
      and l.deleted_at is null
    order by l.created_at asc, l.id
    for update skip locked
  loop
    v_corretor := p_corretor_ids[(v_index % cardinality(p_corretor_ids)) + 1];

    insert into public.lead_distribution_items (
      lead_id,
      from_user_id,
      to_user_id,
      batch_id
    ) values (
      v_lead.id,
      null,
      v_corretor,
      v_batch
    );

    update public.leads
    set responsavel_id = v_corretor,
        updated_at = now()
    where id = v_lead.id;

    insert into public.lead_notifications (
      organization_id,
      user_id,
      lead_id,
      title,
      message
    ) values (
      v_org,
      v_corretor,
      v_lead.id,
      'Novo lead na sua carteira',
      'O lead ' || v_lead.nome || ' entrou na sua base.'
    );

    insert into public.activities (
      lead_id,
      user_id,
      tipo,
      descricao
    ) values (
      v_lead.id,
      auth.uid(),
      'observacao',
      'Lead distribuído pela roleta para um corretor.'
    );

    v_index := v_index + 1;
    v_total := v_total + 1;
  end loop;

  update public.lead_distribution_batches
  set total_leads = v_total
  where id = v_batch;

  return v_total;
end;
$$;

revoke all on function public.distribute_pending_leads(uuid[]) from public;
revoke all on function public.distribute_pending_leads(uuid[]) from anon;
grant execute on function public.distribute_pending_leads(uuid[]) to authenticated;

create or replace function public.mark_lead_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.lead_notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null;
$$;

revoke all on function public.mark_lead_notifications_read() from public;
revoke all on function public.mark_lead_notifications_read() from anon;
grant execute on function public.mark_lead_notifications_read() to authenticated;
