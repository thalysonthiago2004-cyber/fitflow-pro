-- Phase 4: hydration goals, water intake logging and reminder preferences.
--
-- - Goals are configurable targets set by staff for a student, not medical
--   prescriptions. One current goal per student; changes are kept in history.
-- - Only the student logs water. The timestamp is always set by the database
--   (no backdating) and the calendar day is derived in America/Sao_Paulo.
-- - Reminder preferences belong to the student.

create table public.hydration_goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  student_id uuid not null,
  daily_target_ml integer not null check (daily_target_ml between 500 and 10000),
  set_by uuid references public.profiles (id) on delete set null,
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (workspace_id, student_id)
    references public.students (workspace_id, user_id) on delete cascade
);

create index hydration_goals_student_idx on public.hydration_goals (student_id, effective_from desc);

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  student_id uuid not null,
  amount_ml integer not null check (amount_ml between 10 and 5000),
  logged_at timestamptz not null default now(),
  local_date date not null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, student_id)
    references public.students (workspace_id, user_id) on delete cascade
);

create index water_logs_student_date_idx on public.water_logs (student_id, local_date desc);

create table public.hydration_reminders (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  enabled boolean not null default false,
  start_time time not null default '08:00',
  end_time time not null default '21:00',
  interval_minutes smallint not null default 90 check (interval_minutes between 30 and 240),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create trigger hydration_reminders_set_updated_at before update on public.hydration_reminders
  for each row execute function private.set_updated_at();

-- The database owns the timestamp and the São Paulo calendar day.
create function private.water_log_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.logged_at := now();
  new.local_date := (now() at time zone 'America/Sao_Paulo')::date;
  return new;
end;
$$;

create trigger water_logs_defaults before insert on public.water_logs
  for each row execute function private.water_log_defaults();

alter table public.hydration_goals enable row level security;
alter table public.water_logs enable row level security;
alter table public.hydration_reminders enable row level security;

revoke all on public.hydration_goals, public.water_logs, public.hydration_reminders from anon, authenticated;
grant select on public.hydration_goals, public.water_logs, public.hydration_reminders to authenticated;
grant insert (workspace_id, student_id, daily_target_ml, set_by) on public.hydration_goals to authenticated;
grant insert (workspace_id, student_id, amount_ml) on public.water_logs to authenticated;
grant delete on public.water_logs to authenticated;
grant insert (student_id, enabled, start_time, end_time, interval_minutes) on public.hydration_reminders to authenticated;
grant update (enabled, start_time, end_time, interval_minutes) on public.hydration_reminders to authenticated;

create policy "hydration_goals: staff and the student read"
  on public.hydration_goals for select to authenticated
  using (student_id = (select auth.uid()) or (select private.is_workspace_staff(workspace_id)));

create policy "hydration_goals: staff set goals"
  on public.hydration_goals for insert to authenticated
  with check ((select private.is_workspace_staff(workspace_id)) and set_by = (select auth.uid()));

create policy "water_logs: staff and the student read"
  on public.water_logs for select to authenticated
  using (student_id = (select auth.uid()) or (select private.is_workspace_staff(workspace_id)));

create policy "water_logs: the student logs own intake"
  on public.water_logs for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and (select private.is_workspace_member(workspace_id))
  );

-- Undo for recent mistakes: only today's entries can be removed.
create policy "water_logs: the student removes today's entries"
  on public.water_logs for delete to authenticated
  using (
    student_id = (select auth.uid())
    and local_date = ((select now()) at time zone 'America/Sao_Paulo')::date
  );

create policy "hydration_reminders: the student manages own"
  on public.hydration_reminders for all to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));
