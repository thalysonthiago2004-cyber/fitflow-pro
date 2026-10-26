-- Reminder scheduler: every 15 minutes the database calls the app's
-- /api/cron/reminders endpoint, which claims due reminders and sends the
-- Web Push notifications.
--
-- The endpoint URL and its bearer secret live in Supabase Vault
-- ('reminders_url', 'reminders_secret'), set outside migrations so no secret
-- is committed. Until both exist the job does nothing.
--
-- Environments without pg_cron/pg_net (local tests) skip this file's effects.

do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_available_extensions where name = 'pg_net')
     or not exists (select 1 from pg_namespace where nspname = 'vault') then
    raise notice 'pg_cron, pg_net or vault unavailable: reminder scheduler not installed';
    return;
  end if;

  create extension if not exists pg_cron;
  create extension if not exists pg_net;

  execute $fn$
    create or replace function private.trigger_reminders()
    returns void
    language plpgsql
    security definer
    set search_path = ''
    as $body$
    declare
      target text := (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_url');
      secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_secret');
    begin
      if target is null or secret is null then
        return;
      end if;
      perform net.http_post(
        url := target,
        headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
        body := '{}'::jsonb,
        timeout_milliseconds := 10000
      );
    end;
    $body$
  $fn$;

  execute 'revoke all on function private.trigger_reminders() from public, anon, authenticated';

  if exists (select 1 from cron.job where jobname = 'fitflow-reminders') then
    perform cron.unschedule('fitflow-reminders');
  end if;
  perform cron.schedule('fitflow-reminders', '*/15 * * * *', 'select private.trigger_reminders()');
end;
$$;
