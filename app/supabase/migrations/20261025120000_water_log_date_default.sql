-- local_date is always set by the private.water_log_defaults() trigger. The default only
-- makes the column optional on insert, so generated types match the trigger.
alter table public.water_logs
  alter column local_date set default ((now() at time zone 'America/Sao_Paulo')::date);
