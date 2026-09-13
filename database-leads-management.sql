-- CRM Cadena — evolução do banco para gestão completa de leads
-- PRÉ-REQUISITO: o supabase/schema.sql original já deve ter sido executado.
-- Execute este arquivo UMA VEZ no SQL Editor do Supabase.

-- 1) Novos campos do lead: autoria, exclusão lógica e normalização para deduplicação.
alter table public.leads
  add column if not exists criado_por uuid references public.profiles(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists deletion_reason text,
  add column if not exists telefone_normalizado text,
  add column if not exists importado_em uuid;

update public.leads
set telefone_normalizado = regexp_replace(coalesce(telefone, ''), '\\D', '', 'g')
where telefone_normalizado is null;

create index if not exists leads_telefone_normalizado_idx
  on public.leads(telefone_normalizado)
  where deleted_at is null and telefone_normalizado <> '';

create index if not exists leads_deleted_at_idx
  on public.leads(deleted_at)
  where deleted_at is not null;

-- Mantém a coluna normalizada atualizada quando telefone mudar.
create or replace function public.normalize_lead_phone()
returns trigger
language plpgsql
as $$
begin
  new.telefone_normalizado = regexp_replace(coalesce(new.telefone, ''), '\\D', '', 'g');
  return new;
end;
$$;

drop trigger if exists leads_normalize_phone on public.leads;
create trigger leads_normalize_phone
  before insert or update of telefone on public.leads
  for each row execute procedure public.normalize_lead_phone();

-- 2) Histórico de transferências/distribuições.
create table if not exists public.lead_assignments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  from_user_id uuid references public.profiles(id) on delete set null,
  to_user_id uuid references public.profiles(id) on delete set null,
  changed_by uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists lead_assignments_lead_idx
  on public.lead_assignments(lead_id, created_at desc);
create index if not exists lead_assignments_to_user_idx
  on public.lead_assignments(to_user_id, created_at desc);

-- 3) Auditoria completa de ações relevantes sobre leads.
create table if not exists public.lead_audit_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  field_name text,
  old_value text,
  new_value text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lead_audit_lead_idx
  on public.lead_audit_log(lead_id, created_at desc);
create index if not exists lead_audit_actor_idx
  on public.lead_audit_log(actor_id, created_at desc);

-- 4) Follow-ups e lembretes.
create table if not exists public.lead_followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  notes text,
  due_at timestamptz not null,
  status text not null default 'pendente' check (status in ('pendente', 'concluido', 'cancelado')),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_followups_due_idx
  on public.lead_followups(due_at)
  where status = 'pendente';
create index if not exists lead_followups_assigned_idx
  on public.lead_followups(assigned_to, due_at)
  where status = 'pendente';
create index if not exists lead_followups_lead_idx
  on public.lead_followups(lead_id, due_at desc);

drop trigger if exists lead_followups_set_updated_at on public.lead_followups;
create trigger lead_followups_set_updated_at
  before update on public.lead_followups
  for each row execute procedure public.set_updated_at();

-- 5) Controle das importações de Excel/CSV.
create table if not exists public.lead_imports (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references public.profiles(id) on delete set null,
  file_name text not null,
  file_type text not null check (file_type in ('csv', 'xlsx', 'xls')),
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  invalid_rows integer not null default 0,
  status text not null default 'processando' check (status in ('processando', 'concluido', 'concluido_com_erros', 'falhou')),
  notes text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists lead_imports_created_idx
  on public.lead_imports(created_at desc);

create table if not exists public.lead_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.lead_imports(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null default '{}'::jsonb,
  row_status text not null default 'pendente' check (row_status in ('pendente', 'importado', 'duplicado', 'invalido', 'erro')),
  lead_id uuid references public.leads(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  unique(import_id, row_number)
);

create index if not exists lead_import_rows_import_idx
  on public.lead_import_rows(import_id, row_number);
create index if not exists lead_import_rows_lead_idx
  on public.lead_import_rows(lead_id);

-- 6) Registro de distribuição em massa.
create table if not exists public.lead_distribution_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  strategy text not null check (strategy in ('manual', 'round_robin', 'quantidade', 'aleatoria')),
  total_leads integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_distribution_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.lead_distribution_batches(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  from_user_id uuid references public.profiles(id) on delete set null,
  to_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists lead_distribution_items_batch_idx
  on public.lead_distribution_items(batch_id);
create index if not exists lead_distribution_items_lead_idx
  on public.lead_distribution_items(lead_id);

-- 7) Auditoria automática de alterações importantes nos leads.
create or replace function public.audit_lead_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.lead_audit_log(lead_id, actor_id, action, metadata)
    values (new.id, auth.uid(), 'criado', jsonb_build_object('origem', new.origem));
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.responsavel_id is distinct from new.responsavel_id then
      insert into public.lead_audit_log(lead_id, actor_id, action, old_value, new_value)
      values (new.id, auth.uid(), 'responsavel_alterado', old.responsavel_id::text, new.responsavel_id::text);

      insert into public.lead_assignments(lead_id, from_user_id, to_user_id, changed_by, reason)
      values (new.id, old.responsavel_id, new.responsavel_id, auth.uid(), 'Alteração de responsável');
    end if;

    if old.status is distinct from new.status then
      insert into public.lead_audit_log(lead_id, actor_id, action, field_name, old_value, new_value)
      values (new.id, auth.uid(), 'status_alterado', 'status', old.status::text, new.status::text);
    end if;

    if old.telefone is distinct from new.telefone then
      insert into public.lead_audit_log(lead_id, actor_id, action, field_name, old_value, new_value)
      values (new.id, auth.uid(), 'campo_alterado', 'telefone', old.telefone, new.telefone);
    end if;

    if old.nome is distinct from new.nome then
      insert into public.lead_audit_log(lead_id, actor_id, action, field_name, old_value, new_value)
      values (new.id, auth.uid(), 'campo_alterado', 'nome', old.nome, new.nome);
    end if;

    if old.deleted_at is null and new.deleted_at is not null then
      insert into public.lead_audit_log(lead_id, actor_id, action, new_value, metadata)
      values (new.id, auth.uid(), 'excluido', new.deletion_reason, jsonb_build_object('deleted_at', new.deleted_at));
    end if;

    if old.deleted_at is not null and new.deleted_at is null then
      insert into public.lead_audit_log(lead_id, actor_id, action)
      values (new.id, auth.uid(), 'restaurado');
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.lead_audit_log(lead_id, actor_id, action, metadata)
    values (old.id, auth.uid(), 'exclusao_fisica', jsonb_build_object('nome', old.nome));
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists leads_audit_changes on public.leads;
create trigger leads_audit_changes
after insert or update or delete on public.leads
for each row execute procedure public.audit_lead_changes();

-- 8) Funções seguras para transferir, excluir logicamente e restaurar.
create or replace function public.transfer_lead(p_lead_id uuid, p_to_user_id uuid, p_reason text default null)
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads;
begin
  if not public.is_manager_or_admin() then
    raise exception 'Apenas admin ou gerente pode transferir leads';
  end if;

  if not exists (select 1 from public.profiles where id = p_to_user_id and role = 'corretor') then
    raise exception 'O responsável de destino precisa ser um corretor ativo';
  end if;

  update public.leads
  set responsavel_id = p_to_user_id
  where id = p_lead_id and deleted_at is null
  returning * into v_lead;

  if v_lead.id is null then
    raise exception 'Lead não encontrado ou excluído';
  end if;

  update public.lead_assignments
  set reason = coalesce(p_reason, reason)
  where id = (
    select id from public.lead_assignments
    where lead_id = p_lead_id
    order by created_at desc
    limit 1
  );

  return v_lead;
end;
$$;

grant execute on function public.transfer_lead(uuid, uuid, text) to authenticated;

create or replace function public.soft_delete_lead(p_lead_id uuid, p_reason text default null)
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads;
begin
  if not public.is_manager_or_admin() then
    raise exception 'Apenas admin ou gerente pode excluir leads';
  end if;

  update public.leads
  set deleted_at = now(),
      deleted_by = auth.uid(),
      deletion_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = p_lead_id and deleted_at is null
  returning * into v_lead;

  if v_lead.id is null then
    raise exception 'Lead não encontrado ou já excluído';
  end if;

  return v_lead;
end;
$$;

grant execute on function public.soft_delete_lead(uuid, text) to authenticated;

create or replace function public.restore_lead(p_lead_id uuid)
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads;
begin
  if not public.is_manager_or_admin() then
    raise exception 'Apenas admin ou gerente pode restaurar leads';
  end if;

  update public.leads
  set deleted_at = null,
      deleted_by = null,
      deletion_reason = null
  where id = p_lead_id and deleted_at is not null
  returning * into v_lead;

  if v_lead.id is null then
    raise exception 'Lead excluído não encontrado';
  end if;

  return v_lead;
end;
$$;

grant execute on function public.restore_lead(uuid) to authenticated;

-- 9) Regras RLS: leads ativos aparecem normalmente; lixeira/auditoria/importações só para gestão.
drop policy if exists "leads: managers read all" on public.leads;
drop policy if exists "leads: assigned users read" on public.leads;
drop policy if exists "leads: managers delete" on public.leads;

create policy "leads: managers read active"
  on public.leads for select
  to authenticated
  using (public.is_manager_or_admin() and deleted_at is null);

create policy "leads: assigned users read active"
  on public.leads for select
  to authenticated
  using (responsavel_id = auth.uid() and deleted_at is null);

-- Impede exclusão física via API. A exclusão oficial é soft_delete_lead().
create policy "leads: no physical delete"
  on public.leads for delete
  to authenticated
  using (false);

create table if not exists public.crm_import_permissions_dummy (id integer primary key);
drop table public.crm_import_permissions_dummy;

alter table public.lead_assignments enable row level security;
alter table public.lead_audit_log enable row level security;
alter table public.lead_followups enable row level security;
alter table public.lead_imports enable row level security;
alter table public.lead_import_rows enable row level security;
alter table public.lead_distribution_batches enable row level security;
alter table public.lead_distribution_items enable row level security;

-- Histórico de transferências: gestão vê tudo; corretor vê somente movimentos envolvendo seus leads.
create policy "lead_assignments: management read"
  on public.lead_assignments for select to authenticated
  using (public.is_manager_or_admin());
create policy "lead_assignments: assigned users read"
  on public.lead_assignments for select to authenticated
  using (from_user_id = auth.uid() or to_user_id = auth.uid());
create policy "lead_assignments: management insert"
  on public.lead_assignments for insert to authenticated
  with check (public.is_manager_or_admin());

create policy "lead_audit: management read"
  on public.lead_audit_log for select to authenticated
  using (public.is_manager_or_admin());
create policy "lead_audit: assigned users read"
  on public.lead_audit_log for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id and l.responsavel_id = auth.uid()));

-- O trigger grava auditoria; usuários não inserem auditoria manualmente.
create policy "lead_audit: no direct insert"
  on public.lead_audit_log for insert to authenticated
  with check (false);

create policy "followups: management read"
  on public.lead_followups for select to authenticated
  using (public.is_manager_or_admin());
create policy "followups: assigned read"
  on public.lead_followups for select to authenticated
  using (assigned_to = auth.uid());
create policy "followups: management insert"
  on public.lead_followups for insert to authenticated
  with check (public.is_manager_or_admin());
create policy "followups: assigned insert"
  on public.lead_followups for insert to authenticated
  with check (created_by = auth.uid() and assigned_to = auth.uid());
create policy "followups: management update"
  on public.lead_followups for update to authenticated
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy "followups: assigned update"
  on public.lead_followups for update to authenticated
  using (assigned_to = auth.uid()) with check (assigned_to = auth.uid());

create policy "imports: management read"
  on public.lead_imports for select to authenticated
  using (public.is_manager_or_admin());
create policy "imports: management insert"
  on public.lead_imports for insert to authenticated
  with check (public.is_manager_or_admin());
create policy "imports: management update"
  on public.lead_imports for update to authenticated
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());

create policy "import rows: management read"
  on public.lead_import_rows for select to authenticated
  using (public.is_manager_or_admin());
create policy "import rows: management insert"
  on public.lead_import_rows for insert to authenticated
  with check (public.is_manager_or_admin());
create policy "import rows: management update"
  on public.lead_import_rows for update to authenticated
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());

create policy "distribution batches: management read"
  on public.lead_distribution_batches for select to authenticated
  using (public.is_manager_or_admin());
create policy "distribution batches: management insert"
  on public.lead_distribution_batches for insert to authenticated
  with check (public.is_manager_or_admin());
create policy "distribution items: management read"
  on public.lead_distribution_items for select to authenticated
  using (public.is_manager_or_admin());
create policy "distribution items: management insert"
  on public.lead_distribution_items for insert to authenticated
  with check (public.is_manager_or_admin());

-- 10) Atividades passam a ignorar leads excluídos para o acesso normal.
drop policy if exists "activities: users read own lead activity" on public.activities;
create policy "activities: users read active own lead"
  on public.activities for select to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_id and l.responsavel_id = auth.uid() and l.deleted_at is null
    )
  );

-- 11) O histórico de auditoria de exclusão permanece disponível mesmo após a retirada do lead da base.
-- O lead_audit_log referencia o lead com ON DELETE SET NULL para preservar o histórico.
