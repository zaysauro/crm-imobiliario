-- Auditoria e gestão administrativa de leads
-- Permite que gerente/admin restaurem um lead diretamente para a carteira de um corretor
-- e garante que operações administrativas sejam registradas no histórico.

create or replace function public.admin_restore_lead(
  p_lead_id uuid,
  p_to_user_id uuid,
  p_reason text default 'Lead reativado pela gestão'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_responsavel uuid;
  v_role text;
begin
  v_role := public.current_user_role();
  if v_role not in ('admin', 'gerente') then
    raise exception 'Apenas gerente ou administrador pode reativar leads';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_to_user_id and role = 'corretor'
  ) then
    raise exception 'O responsável selecionado precisa ser um corretor';
  end if;

  select responsavel_id into v_old_responsavel
  from public.leads
  where id = p_lead_id and deleted_at is not null
  for update;

  if not found then
    raise exception 'Lead não encontrado na lixeira';
  end if;

  update public.leads
  set deleted_at = null,
      deletion_reason = null,
      responsavel_id = p_to_user_id,
      updated_at = now()
  where id = p_lead_id;

  insert into public.lead_audit_log (
    lead_id, actor_id, action, field_name, old_value, new_value
  ) values (
    p_lead_id,
    auth.uid(),
    'restaurado',
    'responsavel_id',
    coalesce(v_old_responsavel::text, 'sem responsável'),
    p_to_user_id::text
  );

  insert into public.lead_audit_log (
    lead_id, actor_id, action, field_name, old_value, new_value
  ) values (
    p_lead_id,
    auth.uid(),
    'responsavel_alterado',
    'responsavel_id',
    coalesce(v_old_responsavel::text, 'sem responsável'),
    p_to_user_id::text
  );

  insert into public.activities (lead_id, user_id, tipo, descricao)
  values (
    p_lead_id,
    auth.uid(),
    'observacao',
    coalesce(p_reason, 'Lead reativado pela gestão')
  );
end;
$$;

grant execute on function public.admin_restore_lead(uuid, uuid, text) to authenticated;

-- A gestão pode consultar todos os leads, inclusive os que estão na lixeira.
drop policy if exists "leads: managers read all" on public.leads;
create policy "leads: managers read all"
  on public.leads for select to authenticated
  using (public.is_manager_or_admin());

-- A gestão pode atualizar a carteira diretamente quando necessário.
drop policy if exists "leads: managers update all" on public.leads;
create policy "leads: managers update all"
  on public.leads for update to authenticated
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());
