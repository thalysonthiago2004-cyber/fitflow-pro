-- Keep pg_net out of the public schema (Supabase advisor: extension_in_public).
-- pg_net cannot be relocated, so it is recreated in `extensions`; its
-- functions stay in the `net` schema, which private.trigger_reminders() uses.
do $$
begin
  if exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_net' and n.nspname = 'public') then
    drop extension pg_net;
    create extension pg_net with schema extensions;
  end if;
end;
$$;
