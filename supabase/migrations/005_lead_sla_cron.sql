-- Agendamento do SLA no Supabase Cron.
-- Se pg_cron ainda não estiver habilitado, esta migration não falha.
-- Depois de habilitar Database > Extensions > pg_cron, execute novamente:
-- select cron.schedule('crm-lead-sla', '* * * * *', 'select public.process_lead_sla();');

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'crm-lead-sla') then
      perform cron.schedule('crm-lead-sla', '* * * * *', 'select public.process_lead_sla();');
    end if;
  else
    raise notice 'pg_cron não está habilitado. Ative-o no Supabase em Database > Extensions e execute o comando de agendamento indicado nesta migration.';
  end if;
end;
$$;
