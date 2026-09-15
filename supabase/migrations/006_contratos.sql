-- CRM Cadena — contratos padrão e documentos preenchidos
create table if not exists public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'Compra e venda',
  descricao text,
  file_path text not null,
  file_name text not null,
  file_size bigint,
  extracted_text text not null default '',
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contract_documents (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  template_id uuid references public.contract_templates(id) on delete set null,
  nome text not null,
  tipo text not null default 'Compra e venda',
  content_html text not null default '',
  file_path text,
  file_name text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contract_templates enable row level security;
alter table public.contract_documents enable row level security;

create policy "contract templates: authenticated read" on public.contract_templates
  for select to authenticated using (true);
create policy "contract templates: managers insert" on public.contract_templates
  for insert to authenticated with check (public.is_manager_or_admin());
create policy "contract templates: managers update" on public.contract_templates
  for update to authenticated using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy "contract templates: managers delete" on public.contract_templates
  for delete to authenticated using (public.is_manager_or_admin());

create policy "contract documents: authenticated read" on public.contract_documents
  for select to authenticated using (
    public.is_manager_or_admin() or exists (
      select 1 from public.leads l where l.id = lead_id and l.responsavel_id = auth.uid()
    )
  );
create policy "contract documents: broker insert own lead" on public.contract_documents
  for insert to authenticated with check (
    exists (select 1 from public.leads l where l.id = lead_id and l.responsavel_id = auth.uid())
    and created_by = auth.uid()
  );
create policy "contract documents: managers insert" on public.contract_documents
  for insert to authenticated with check (public.is_manager_or_admin());
create policy "contract documents: owner update" on public.contract_documents
  for update to authenticated using (
    public.is_manager_or_admin() or exists (
      select 1 from public.leads l where l.id = lead_id and l.responsavel_id = auth.uid()
    )
  ) with check (
    public.is_manager_or_admin() or exists (
      select 1 from public.leads l where l.id = lead_id and l.responsavel_id = auth.uid()
    )
  );
create policy "contract documents: managers delete" on public.contract_documents
  for delete to authenticated using (public.is_manager_or_admin());
create policy "contract documents: owner delete" on public.contract_documents
  for delete to authenticated using (exists (
    select 1 from public.leads l where l.id = lead_id and l.responsavel_id = auth.uid()
  ));

insert into storage.buckets (id, name, public)
values ('contract-templates', 'contract-templates', false)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
values ('contract-documents', 'contract-documents', false)
on conflict (id) do nothing;

create policy "contract templates files: authenticated read" on storage.objects
  for select to authenticated using (bucket_id = 'contract-templates');
create policy "contract templates files: managers upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'contract-templates' and public.is_manager_or_admin());
create policy "contract templates files: managers update" on storage.objects
  for update to authenticated using (bucket_id = 'contract-templates' and public.is_manager_or_admin())
  with check (bucket_id = 'contract-templates' and public.is_manager_or_admin());
create policy "contract templates files: managers delete" on storage.objects
  for delete to authenticated using (bucket_id = 'contract-templates' and public.is_manager_or_admin());

create policy "contract documents files: authenticated read" on storage.objects
  for select to authenticated using (bucket_id = 'contract-documents');
create policy "contract documents files: authenticated upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'contract-documents');
create policy "contract documents files: authenticated update" on storage.objects
  for update to authenticated using (bucket_id = 'contract-documents') with check (bucket_id = 'contract-documents');
create policy "contract documents files: authenticated delete" on storage.objects
  for delete to authenticated using (bucket_id = 'contract-documents');

create trigger contract_templates_updated_at before update on public.contract_templates
for each row execute function public.set_updated_at();
create trigger contract_documents_updated_at before update on public.contract_documents
for each row execute function public.set_updated_at();
