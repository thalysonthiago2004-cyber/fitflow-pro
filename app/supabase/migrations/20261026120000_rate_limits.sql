-- Per-user rate limits for actions that can be abused (invitations,
-- comments, uploads, exports). Counts live in a private table; the check is
-- one atomic statement, so concurrent requests cannot slip past the limit.

create table private.rate_limits (
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (user_id, action, window_start)
);

revoke all on private.rate_limits from public, anon, authenticated;

-- Records one hit for the caller and returns false when the limit for the
-- current fixed window is exceeded. Old windows are pruned opportunistically.
create function public.check_rate_limit(p_action text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  started timestamptz;
  current_hits integer;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_action !~ '^[a-z_]{2,40}$' or p_max not between 1 and 10000 or p_window_seconds not between 1 and 86400 then
    raise exception 'invalid_rate_limit' using errcode = 'P0001';
  end if;

  started := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into private.rate_limits as r (user_id, action, window_start, hits)
  values (uid, p_action, started, 1)
  on conflict (user_id, action, window_start) do update set hits = r.hits + 1
  returning hits into current_hits;

  if random() < 0.01 then
    delete from private.rate_limits where window_start < now() - interval '2 days';
  end if;

  return current_hits <= p_max;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;
