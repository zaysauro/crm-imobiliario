-- Segurança complementar do CRM Cadena.
-- Execute depois do schema principal e da migration de leads.

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

drop policy if exists "profiles: users update themselves" on public.profiles;
drop policy if exists "profiles: users update own profile" on public.profiles;
drop policy if exists "profiles: managers manage roles" on public.profiles;

create policy "profiles: users update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_user_role());

create policy "profiles: managers manage roles"
  on public.profiles for update
  to authenticated
  using (public.is_manager_or_admin())
  with check (
    (public.current_user_role() = 'admin')
    or (public.current_user_role() = 'gerente' and role <> 'admin')
  );
