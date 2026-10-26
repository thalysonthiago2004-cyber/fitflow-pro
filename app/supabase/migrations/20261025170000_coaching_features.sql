-- Plan templates and duplication, health questionnaires (PAR-Q), workout
-- comments and Web Push subscriptions.

-- ---------------------------------------------------------------------------
-- Templates: a plan with no student. Never visible to students (their policy
-- matches on student_id) and never published.
-- ---------------------------------------------------------------------------

alter table public.workout_plans
  add column is_template boolean not null default false,
  alter column student_id drop not null;

alter table public.workout_plans add constraint workout_plans_template_shape check (
  (is_template and student_id is null and status = 'draft') or (not is_template and student_id is not null)
);

grant insert (is_template) on public.workout_plans to authenticated;

-- Copies a plan (or template) with its sessions and items into a new draft,
-- for a student or as a template. Runs with the caller's rights, so RLS
-- decides what can be read and written. Superset groups get fresh ids derived
-- from (old group, new plan), so items of one group stay together.
create function public.duplicate_workout_plan(p_plan uuid, p_student uuid, p_name text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  source public.workout_plans;
  new_plan uuid;
  session_row public.workout_sessions;
  new_session uuid;
begin
  select * into source from public.workout_plans where id = p_plan;
  if source.id is null or not private.is_workspace_staff(source.workspace_id) then
    raise exception 'plan_not_found' using errcode = 'P0001';
  end if;

  insert into public.workout_plans (workspace_id, student_id, name, notes, status, is_template, created_by)
  values (
    source.workspace_id,
    p_student,
    left(coalesce(nullif(btrim(p_name), ''), source.name), 120),
    source.notes,
    'draft',
    p_student is null,
    (select auth.uid())
  )
  returning id into new_plan;

  for session_row in select * from public.workout_sessions where plan_id = p_plan order by position, created_at loop
    insert into public.workout_sessions (workspace_id, plan_id, name, weekdays, position)
    values (source.workspace_id, new_plan, session_row.name, session_row.weekdays, session_row.position)
    returning id into new_session;

    insert into public.session_exercises (
      workspace_id, session_id, exercise_id, position, sets, reps_min, reps_max, reps_per_set, superset_group,
      load_kg, rest_seconds, notes, cardio_mode, duration_minutes, distance_km, intensity, hr_min, hr_max,
      speed_kmh, incline_pct, rounds, work_seconds
    )
    select
      source.workspace_id, new_session, se.exercise_id, se.position, se.sets, se.reps_min, se.reps_max, se.reps_per_set,
      case when se.superset_group is null then null else md5(se.superset_group::text || new_plan::text)::uuid end,
      se.load_kg, se.rest_seconds, se.notes, se.cardio_mode, se.duration_minutes, se.distance_km, se.intensity, se.hr_min, se.hr_max,
      se.speed_kmh, se.incline_pct, se.rounds, se.work_seconds
    from public.session_exercises se
    where se.session_id = session_row.id
    order by se.position, se.created_at;
  end loop;

  return new_plan;
end;
$$;

revoke all on function public.duplicate_workout_plan(uuid, uuid, text) from public, anon;
grant execute on function public.duplicate_workout_plan(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Health questionnaire (PAR-Q+ screening plus free-text context). Each
-- submission is kept; the latest one is current.
-- ---------------------------------------------------------------------------

create table public.health_questionnaires (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  student_id uuid not null,
  answers jsonb not null check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 8192),
  -- Any "yes" in the screening questions: medical clearance is recommended.
  needs_clearance boolean not null,
  submitted_at timestamptz not null default now(),
  foreign key (workspace_id, student_id) references public.students (workspace_id, user_id) on delete cascade
);

create index health_questionnaires_student_idx on public.health_questionnaires (student_id, submitted_at desc);

alter table public.health_questionnaires enable row level security;
revoke all on public.health_questionnaires from anon, authenticated;
grant select on public.health_questionnaires to authenticated;
grant insert (workspace_id, student_id, answers, needs_clearance) on public.health_questionnaires to authenticated;

create policy "health_questionnaires: the student and staff read"
  on public.health_questionnaires for select to authenticated
  using (student_id = (select auth.uid()) or (select private.is_workspace_staff(workspace_id)));

create policy "health_questionnaires: the student answers"
  on public.health_questionnaires for insert to authenticated
  with check (student_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)));

-- ---------------------------------------------------------------------------
-- Comments on recorded workouts (student and trainer)
-- ---------------------------------------------------------------------------

create table public.workout_comments (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.workout_logs (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index workout_comments_log_idx on public.workout_comments (log_id, created_at);

alter table public.workout_comments enable row level security;
revoke all on public.workout_comments from anon, authenticated;
grant select, delete on public.workout_comments to authenticated;
grant insert (log_id, author_id, body) on public.workout_comments to authenticated;

create policy "workout_comments: visible with the log"
  on public.workout_comments for select to authenticated
  using ((select private.can_view_log(log_id)));

create policy "workout_comments: people who see the log comment"
  on public.workout_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and (select private.can_view_log(log_id)));

create policy "workout_comments: authors delete their own"
  on public.workout_comments for delete to authenticated
  using (author_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Web Push
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant insert (user_id, endpoint, p256dh, auth) on public.push_subscriptions to authenticated;

create policy "push_subscriptions: users manage their own"
  on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Daily "workout today" reminder time (São Paulo). Null = off.
create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  workout_reminder_time time,
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at before update on public.notification_preferences
  for each row execute function private.set_updated_at();

alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon, authenticated;
grant select on public.notification_preferences to authenticated;
grant insert (user_id, workout_reminder_time) on public.notification_preferences to authenticated;
grant update (workout_reminder_time) on public.notification_preferences to authenticated;

create policy "notification_preferences: users manage their own"
  on public.notification_preferences for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- What the scheduler already sent, so each reminder goes out once. Written
-- only by the server's privileged key; never exposed to clients.
create table private.push_deliveries (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  slot timestamptz not null,
  primary key (user_id, kind, slot)
);

revoke all on private.push_deliveries from public, anon, authenticated;

-- Returns the reminders due at p_now and records them as delivered, so a
-- reminder is claimed exactly once even if the scheduler overlaps. Only the
-- server's service role may call it.
--   water:   inside the student's window, on an interval boundary, while today's goal is not met.
--   workout: at the chosen time (within 2 h), on a day with a session and no completed workout yet.
create function public.claim_due_reminders(p_now timestamptz default now())
returns table (user_id uuid, kind text, title text, body text, endpoint text, p256dh text, auth text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  local_now timestamp := p_now at time zone 'America/Sao_Paulo';
  today date := (p_now at time zone 'America/Sao_Paulo')::date;
  weekday smallint := extract(dow from (p_now at time zone 'America/Sao_Paulo'))::smallint;
begin
  return query
  with water as (
    select r.student_id as uid, 'water'::text as kind,
      (today + r.start_time + make_interval(mins => r.interval_minutes * floor(extract(epoch from (local_now - (today + r.start_time))) / 60 / r.interval_minutes)::int))
        at time zone 'America/Sao_Paulo' as slot
    from public.hydration_reminders r
    -- The goal in effect now (goals are kept as history).
    join lateral (
      select g.daily_target_ml from public.hydration_goals g
      where g.student_id = r.student_id and g.effective_from <= p_now
      order by g.effective_from desc limit 1
    ) goal on true
    where r.enabled
      and local_now::time between r.start_time and r.end_time
      and coalesce((select sum(w.amount_ml) from public.water_logs w where w.student_id = r.student_id and w.local_date = today), 0) < goal.daily_target_ml
  ),
  workout as (
    select p.user_id as uid, 'workout'::text as kind, (today + p.workout_reminder_time) at time zone 'America/Sao_Paulo' as slot
    from public.notification_preferences p
    where p.workout_reminder_time is not null
      and local_now >= today + p.workout_reminder_time
      and local_now < today + p.workout_reminder_time + interval '2 hours'
      and exists (
        select 1 from public.workout_plans wp
        join public.workout_sessions s on s.plan_id = wp.id
        where wp.student_id = p.user_id and wp.status = 'active'
          and (cardinality(s.weekdays) = 0 or weekday = any (s.weekdays))
      )
      and not exists (
        select 1 from public.workout_logs l
        where l.student_id = p.user_id and l.completed_at is not null
          and (l.completed_at at time zone 'America/Sao_Paulo')::date = today
      )
  ),
  claimed as (
    insert into private.push_deliveries (user_id, kind, slot)
    select d.uid, d.kind, d.slot from (select * from water union all select * from workout) d
    where exists (select 1 from public.push_subscriptions ps where ps.user_id = d.uid)
    on conflict do nothing
    returning push_deliveries.user_id, push_deliveries.kind
  )
  select c.user_id, c.kind,
    'FitFlow Pro'::text,
    case c.kind when 'water' then 'Hora de beber água. Registre para acompanhar sua meta.' else 'Seu treino de hoje está esperando por você.' end,
    ps.endpoint, ps.p256dh, ps.auth
  from claimed c
  join public.push_subscriptions ps on ps.user_id = c.user_id;
end;
$$;

revoke all on function public.claim_due_reminders(timestamptz) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.claim_due_reminders(timestamptz) to service_role';
  end if;
end;
$$;
