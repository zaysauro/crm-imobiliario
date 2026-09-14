-- CRM Cadena — SLA de atendimento e rotação automática de leads
--
-- Regras:
-- 1. Todo lead atribuído recebe um relógio de primeiro contato.
-- 2. Se nenhum contato real (ligação, WhatsApp ou visita) ocorrer dentro da carência,
--    o lead é enviado ao próximo corretor da fila alfabética.
-- 3. Depois do primeiro contato, o relógio de inatividade volta a contar a cada contato.
-- 4. O limite de inatividade e o limite máximo de follow-up são configuráveis por gestão.

create table if not exists public.lead_sla_settings (
  id boolean primary key default true check (id),
  initial_contact_grace_minutes integer not null default 60 check (initial_contact_grace_minutes >= 0),
  max_inactivity_days numeric(10,2) not null default 3 check (max_inactivity_days > 0),
  max_followup_days numeric(10,2) not null default 3 check (max_followup_days > 0),
  enabled boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.lead_sla_settings (id) values (true) on conflict (id) do nothing;

alter table public.lead_sla_settings enable row level security;
drop policy if exists "lead sla: authenticated read" on public.lead_sla_settings;
create policy "lead sla: authenticated read" on public.lead_sla_settings for select to authenticated using (true);
drop policy if exists "lead sla: managers write" on public.lead_sla_settings;
create policy "lead sla: managers write" on public.lead_sla_settings for all to authenticated using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());

alter table public.leads
  add column if not exists assigned_at timestamptz,
  add column if not exists first_contact_at timestamptz,
  add column if not exists last_contact_at timestamptz,
  add column if not exists last_activity_at timestamptz,
  add column if not exists sla_last_reassigned_at timestamptz;

update public.leads
set assigned_at = coalesce(assigned_at, created_at),
    last_activity_at = coalesce(last_activity_at, updated_at)
where assigned_at is null or last_activity_at is null;

create index if not exists leads_assigned_at_idx on public.leads(assigned_at);
create index if not exists leads_last_contact_idx on public.leads(last_contact_at);
create index if not exists leads_last_activity_idx on public.leads(last_activity_at);

create or replace function public.prepare_lead_assignment_sla()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.responsavel_id is not null then new.assigned_at = coalesce(new.assigned_at, now()); end if;
  elsif old.responsavel_id is distinct from new.responsavel_id then
    new.assigned_at = now();
    new.first_contact_at = null;
    new.last_contact_at = null;
    new.sla_last_reassigned_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_prepare_assignment_sla on public.leads;
create trigger leads_prepare_assignment_sla before insert or update of responsavel_id on public.leads for each row execute function public.prepare_lead_assignment_sla();

create or replace function public.register_lead_contact_sla()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo in ('ligacao', 'whatsapp', 'visita') then
    update public.leads
    set first_contact_at = coalesce(first_contact_at, new.created_at),
        last_contact_at = new.created_at,
        last_activity_at = new.created_at
    where id = new.lead_id;
  else
    update public.leads set last_activity_at = new.created_at where id = new.lead_id;
  end if;
  return new;
end;
$$;

drop trigger if exists activities_register_lead_contact_sla on public.activities;
create trigger activities_register_lead_contact_sla after insert on public.activities for each row execute function public.register_lead_contact_sla();

create or replace function public.enforce_lead_followup_sla()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_days numeric;
  v_role text;
begin
  select max_followup_days into v_days from public.lead_sla_settings where id = true;
  v_role := public.current_user_role();
  if v_days is not null and new.due_at > now() + (v_days * interval '1 day') and v_role not in ('admin', 'gerente') then
    raise exception 'Este follow-up ultrapassa o prazo máximo configurado de % dias.', v_days;
  end if;
  return new;
end;
$$;

drop trigger if exists lead_followups_enforce_sla on public.lead_followups;
create trigger lead_followups_enforce_sla before insert or update of due_at on public.lead_followups for each row execute function public.enforce_lead_followup_sla();

create or replace function public.process_lead_sla()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_enabled boolean;
  v_grace integer;
  v_inactivity numeric;
  v_lead record;
  v_next uuid;
  v_current_name text;
  v_moved integer := 0;
begin
  -- Esta função não é chamada pelo navegador. Ela é executada pelo Supabase Cron
  -- ou pelo endpoint de servidor usando service_role.
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Rotina automática de SLA deve ser executada pelo servidor';
  end if;

  select enabled, initial_contact_grace_minutes, max_inactivity_days into v_enabled, v_grace, v_inactivity
  from public.lead_sla_settings where id = true;
  if coalesce(v_enabled, true) = false then return 0; end if;

  for v_lead in
    select l.id, l.nome, l.responsavel_id, l.assigned_at, l.first_contact_at, l.last_contact_at, p.nome as responsavel_nome
    from public.leads l
    left join public.profiles p on p.id = l.responsavel_id
    where l.deleted_at is null
      and l.responsavel_id is not null
      and l.status not in ('ganho', 'perdido')
      and (
        (l.first_contact_at is null and now() >= coalesce(l.assigned_at, l.created_at) + (v_grace * interval '1 minute'))
        or
        (l.first_contact_at is not null and now() >= coalesce(l.last_contact_at, l.first_contact_at) + (v_inactivity * interval '1 day'))
      )
    order by coalesce(l.assigned_at, l.created_at)
    for update of l skip locked
  loop
    select p2.id into v_next
    from public.profiles p2
    where p2.role = 'corretor'
      and p2.id <> v_lead.responsavel_id
      and (
        lower(p2.nome) > lower(coalesce(v_lead.responsavel_nome, ''))
        or not exists (
          select 1 from public.profiles p3
          where p3.role = 'corretor'
            and p3.id <> v_lead.responsavel_id
            and lower(p3.nome) > lower(coalesce(v_lead.responsavel_nome, ''))
        )
      )
    order by case when lower(p2.nome) > lower(coalesce(v_lead.responsavel_nome, '')) then 0 else 1 end, lower(p2.nome), p2.id
    limit 1;

    if v_next is null then continue; end if;
    select nome into v_current_name from public.profiles where id = v_lead.responsavel_id;

    update public.leads set responsavel_id = v_next, sla_last_reassigned_at = now() where id = v_lead.id;

    insert into public.lead_audit_log (lead_id, actor_id, action, field_name, old_value, new_value, metadata)
    values (
      v_lead.id, null, 'sla_reatribuido', 'responsavel_id', v_lead.responsavel_id::text, v_next::text,
      jsonb_build_object('motivo', case when v_lead.first_contact_at is null then 'primeiro_contato_expirado' else 'inatividade_expirada' end, 'corretor_anterior', v_current_name, 'executado_em', now())
    );

    insert into public.activities (lead_id, user_id, tipo, descricao)
    values (v_lead.id, null, 'observacao', 'Lead reatribuído automaticamente pelo SLA de atendimento.');

    v_moved := v_moved + 1;
  end loop;
  return v_moved;
end;
$$;

revoke all on function public.process_lead_sla() from public;
revoke all on function public.process_lead_sla() from authenticated;
revoke all on function public.process_lead_sla() from anon;
grant execute on function public.process_lead_sla() to service_role;
