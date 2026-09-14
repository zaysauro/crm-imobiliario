create table if not exists public.mcmv_books (
  id uuid primary key default gen_random_uuid(),
  nome_empreendimento text not null,
  localizacao text,
  tipo text,
  faixa_mcmv text,
  metragem text,
  data_lancamento date,
  resumo text,
  file_path text not null,
  file_name text not null,
  file_size bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mcmv_books enable row level security;

insert into storage.buckets (id, name, public)
values ('mcmv-books', 'mcmv-books', false)
on conflict (id) do nothing;

create policy "mcmv books: authenticated read"
  on public.mcmv_books for select to authenticated using (true);

create policy "mcmv books: managers insert"
  on public.mcmv_books for insert to authenticated
  with check (public.is_manager_or_admin());

create policy "mcmv books: managers update"
  on public.mcmv_books for update to authenticated
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());

create policy "mcmv books: managers delete"
  on public.mcmv_books for delete to authenticated
  using (public.is_manager_or_admin());

create policy "mcmv book files: authenticated read"
  on storage.objects for select to authenticated
  using (bucket_id = 'mcmv-books');

create policy "mcmv book files: managers upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'mcmv-books' and public.is_manager_or_admin());

create policy "mcmv book files: managers update"
  on storage.objects for update to authenticated
  using (bucket_id = 'mcmv-books' and public.is_manager_or_admin())
  with check (bucket_id = 'mcmv-books' and public.is_manager_or_admin());

create policy "mcmv book files: managers delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'mcmv-books' and public.is_manager_or_admin());
