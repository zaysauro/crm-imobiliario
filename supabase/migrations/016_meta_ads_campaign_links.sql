-- Integração Meta Ads: campanhas/formulários vinculados ao motor de distribuição do Cadena.
create table if not exists public.meta_campaign_links (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null,
  campaign_name text not null,
  form_id text,
  form_name text,
  ad_account_id text,
  active boolean not null default true,
  distribution_strategy text not null default 'round_robin'
    check (distribution_strategy in ('round_robin')),
  broker_ids uuid[] not null default '{}',
  last_assigned_index integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, form_id)
);

create table if not exists public.meta_leads (
  id uuid primary key default gen_random_uuid(),
  meta_lead_id text not null unique,
  lead_id uuid references public.leads(id) on delete set null,
  campaign_id text,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_id text,
  ad_name text,
  form_id text,
  form_name text,
  page_id text,
  platform text,
  field_data jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

create index if not exists meta_campaign_links_campaign_idx on public.meta_campaign_links(campaign_id);
create index if not exists meta_leads_campaign_idx on public.meta_leads(campaign_id);
create index if not exists meta_leads_lead_idx on public.meta_leads(lead_id);

create or replace function public.meta_next_broker(p_link_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_cursor integer;
  v_target uuid;
  v_i integer;
  v_count integer;
begin
  select broker_ids, last_assigned_index
    into v_ids, v_cursor
  from public.meta_campaign_links
  where id = p_link_id
  for update;

  if v_ids is null or cardinality(v_ids) = 0 then
    return null;
  end if;

  v_count := cardinality(v_ids);
  for v_i in 0..v_count-1 loop
    v_target := v_ids[((coalesce(v_cursor,0) + v_i) % v_count) + 1];
    if exists (
      select 1 from public.profiles
      where id = v_target and role = 'corretor'
    ) then
      update public.meta_campaign_links
      set last_assigned_index = coalesce(v_cursor,0) + v_i + 1,
          updated_at = now()
      where id = p_link_id;
      return v_target;
    end if;
  end loop;
  return null;
end;
$$;

grant execute on function public.meta_next_broker(uuid) to service_role;

alter table public.meta_campaign_links enable row level security;
alter table public.meta_leads enable row level security;

drop policy if exists "meta campaign links managers read" on public.meta_campaign_links;
create policy "meta campaign links managers read"
on public.meta_campaign_links for select to authenticated
using (public.current_user_role() in ('admin','gerente'));

drop policy if exists "meta campaign links managers insert" on public.meta_campaign_links;
create policy "meta campaign links managers insert"
on public.meta_campaign_links for insert to authenticated
with check (public.current_user_role() in ('admin','gerente'));

drop policy if exists "meta campaign links managers update" on public.meta_campaign_links;
create policy "meta campaign links managers update"
on public.meta_campaign_links for update to authenticated
using (public.current_user_role() in ('admin','gerente'))
with check (public.current_user_role() in ('admin','gerente'));

drop policy if exists "meta campaign links managers delete" on public.meta_campaign_links;
create policy "meta campaign links managers delete"
on public.meta_campaign_links for delete to authenticated
using (public.current_user_role() in ('admin','gerente'));

drop policy if exists "meta leads managers read" on public.meta_leads;
create policy "meta leads managers read"
on public.meta_leads for select to authenticated
using (public.current_user_role() in ('admin','gerente'));

create or replace function public.meta_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists meta_campaign_links_updated_at on public.meta_campaign_links;
create trigger meta_campaign_links_updated_at
before update on public.meta_campaign_links
for each row execute function public.meta_touch_updated_at();
