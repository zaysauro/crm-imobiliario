-- Segurança complementar do CRM Cadena.
-- Execute depois do schema principal e da migration de leads.

create policy "profiles: managers manage roles"
  on public.profiles for update
  to authenticated
  using (public.is_manager_or_admin())
  with check (
    public.is_manager_or_admin()
    and role <> 'admin' or (role = 'admin' and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  );

-- Evita que um gerente transforme outro usuário em admin. Admin pode administrar qualquer função.
drop policy if exists "profiles: managers manage roles" on public.profiles;
create policy "profiles: managers manage roles"
  on public.profiles for update
  to authenticated
  using (public.is_manager_or_admin())
  with check (
    (public.is_manager_or_admin() and role <> 'admin')
    or (exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin'))
  );

-- Um gerente não pode alterar o próprio perfil para admin pela política acima.
