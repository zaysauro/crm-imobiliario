-- Dados estruturados do contrato padrão Cadena para permitir reabertura e edição no CRM.
alter table public.contract_documents
  add column if not exists form_data jsonb not null default '{}'::jsonb;

create index if not exists contract_documents_lead_idx
  on public.contract_documents(lead_id);
