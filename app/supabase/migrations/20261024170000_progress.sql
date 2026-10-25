-- Phase 6: body measurements.
--
-- - Measurements are entered by the student or by staff (e.g. an assessment).
--   recorded_by keeps the origin visible; only the recorder may edit or delete.
-- - Dates may be in the past (when the measurement was taken) but never in the
--   future (São Paulo calendar).
-- - Personal records and calorie estimates are derived in the application
--   from logged sets and measurements; nothing derived is stored here.

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  student_id uuid not null,
  measured_on date not null,
  weight_kg numeric(5, 2) check (weight_kg between 20 and 400),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 2 and 70),
  waist_cm numeric(5, 1) check (waist_cm between 30 and 250),
  hip_cm numeric(5, 1) check (hip_cm between 30 and 250),
  chest_cm numeric(5, 1) check (chest_cm between 30 and 250),
  arm_cm numeric(5, 1) check (arm_cm between 10 and 100),
  thigh_cm numeric(5, 1) check (thigh_cm between 20 and 150),
  notes text check (char_length(notes) <= 500),
  recorded_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (measured_on >= date '2000-01-01'),
  -- At least one value must be present.
  check (num_nonnulls(weight_kg, body_fat_pct, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm) > 0),
  foreign key (workspace_id, student_id)
    references public.students (workspace_id, user_id) on delete cascade
);

create index body_measurements_student_idx on public.body_measurements (student_id, measured_on desc);

create trigger body_measurements_set_updated_at before update on public.body_measurements
  for each row execute function private.set_updated_at();

-- Rejects future dates using the São Paulo calendar day.
create function private.check_measured_on()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.measured_on > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'future_date' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger body_measurements_check_date before insert or update on public.body_measurements
  for each row execute function private.check_measured_on();

alter table public.body_measurements enable row level security;

revoke all on public.body_measurements from anon, authenticated;
grant select, delete on public.body_measurements to authenticated;
grant insert (workspace_id, student_id, measured_on, weight_kg, body_fat_pct, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm, notes, recorded_by)
  on public.body_measurements to authenticated;
grant update (measured_on, weight_kg, body_fat_pct, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm, notes)
  on public.body_measurements to authenticated;

create policy "body_measurements: the student and staff read"
  on public.body_measurements for select to authenticated
  using (student_id = (select auth.uid()) or (select private.is_workspace_staff(workspace_id)));

-- The student records their own; staff record for students of their workspace.
create policy "body_measurements: student or staff insert"
  on public.body_measurements for insert to authenticated
  with check (
    recorded_by = (select auth.uid())
    and (
      (student_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)))
      or (select private.is_workspace_staff(workspace_id))
    )
  );

create policy "body_measurements: the recorder updates"
  on public.body_measurements for update to authenticated
  using (recorded_by = (select auth.uid()) and (student_id = (select auth.uid()) or (select private.is_workspace_staff(workspace_id))))
  with check (recorded_by = (select auth.uid()));

create policy "body_measurements: the recorder deletes"
  on public.body_measurements for delete to authenticated
  using (recorded_by = (select auth.uid()) and (student_id = (select auth.uid()) or (select private.is_workspace_staff(workspace_id))));
