-- CRM Cadena — migration 0001
-- Corrige o legado importado_em, adiciona a FK da importação e garante
-- a função compartilhada usada pelos triggers de updated_at.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- A migration histórica criou importado_em como uuid. O nome correto para
-- uma referência à importação é import_id, que aponta para lead_imports.id.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'importado_em'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'import_id'
  ) then
    alter table public.leads rename column importado_em to import_id;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'import_id'
  ) and exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'lead_imports'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'leads_import_id_fkey'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_import_id_fkey
      foreign key (import_id)
      references public.lead_imports(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists leads_import_id_idx
  on public.leads(import_id)
  where import_id is not null;
