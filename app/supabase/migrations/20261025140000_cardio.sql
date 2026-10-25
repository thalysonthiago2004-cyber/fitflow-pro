-- Cardio prescriptions and logs.
--
-- - A prescribed item is either strength (sets × reps) or cardio. The kind is
--   derived from the exercise's muscle group by a trigger, never sent by the
--   client, and each kind has its own required fields.
-- - Cardio is continuous (duration and/or distance) or intervals (rounds of
--   work and rest). Intensity, heart-rate range, speed and incline are
--   optional targets.
-- - Only the student records cardio_logs, mirroring set_logs.

create type public.exercise_kind as enum ('strength', 'cardio');
create type public.cardio_mode as enum ('continuous', 'intervals');
create type public.cardio_intensity as enum ('light', 'moderate', 'vigorous');

alter table public.session_exercises
  add column kind public.exercise_kind not null default 'strength',
  add column cardio_mode public.cardio_mode,
  add column duration_minutes smallint check (duration_minutes between 1 and 300),
  add column distance_km numeric(5, 2) check (distance_km between 0.1 and 200),
  add column intensity public.cardio_intensity,
  add column hr_min smallint check (hr_min between 40 and 220),
  add column hr_max smallint check (hr_max between 40 and 220),
  add column speed_kmh numeric(4, 1) check (speed_kmh between 0.5 and 40),
  add column incline_pct numeric(3, 1) check (incline_pct between 0 and 40),
  add column rounds smallint check (rounds between 1 and 50),
  add column work_seconds smallint check (work_seconds between 5 and 1800),
  alter column sets drop not null,
  alter column reps_min drop not null;

alter table public.session_exercises add constraint session_exercises_kind_fields check (
  case kind
    when 'strength' then
      sets is not null and reps_min is not null and cardio_mode is null
      and num_nonnulls(duration_minutes, distance_km, intensity, hr_min, hr_max, speed_kmh, incline_pct, rounds, work_seconds) = 0
    when 'cardio' then
      sets is null and reps_min is null and reps_max is null and load_kg is null
      and case cardio_mode
        when 'continuous' then (duration_minutes is not null or distance_km is not null) and rounds is null and work_seconds is null
        when 'intervals' then rounds is not null and work_seconds is not null
        else false
      end
  end
);

alter table public.session_exercises add constraint session_exercises_hr_range
  check (hr_min is null or hr_max is null or hr_max >= hr_min);

-- The kind follows the exercise. Security definer so the lookup does not
-- depend on what the caller can read; usability is still checked by RLS.
create function private.session_exercise_kind()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select case when e.muscle_group = 'cardio' then 'cardio'::public.exercise_kind else 'strength'::public.exercise_kind end
    into new.kind
  from public.exercises e
  where e.id = new.exercise_id;
  return new;
end;
$$;

create trigger session_exercises_set_kind before insert or update of exercise_id on public.session_exercises
  for each row execute function private.session_exercise_kind();

grant insert (cardio_mode, duration_minutes, distance_km, intensity, hr_min, hr_max, speed_kmh, incline_pct, rounds, work_seconds)
  on public.session_exercises to authenticated;
grant update (cardio_mode, duration_minutes, distance_km, intensity, hr_min, hr_max, speed_kmh, incline_pct, rounds, work_seconds)
  on public.session_exercises to authenticated;

-- ---------------------------------------------------------------------------
-- Logs
-- ---------------------------------------------------------------------------

create table public.cardio_logs (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.workout_logs (id) on delete cascade,
  session_exercise_id uuid not null references public.session_exercises (id) on delete cascade,
  duration_minutes numeric(5, 1) check (duration_minutes between 0 and 600),
  distance_km numeric(5, 2) check (distance_km between 0 and 200),
  avg_hr smallint check (avg_hr between 30 and 230),
  -- Borg CR10 perceived exertion.
  rpe smallint check (rpe between 1 and 10),
  rounds_done smallint check (rounds_done between 0 and 50),
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (log_id, session_exercise_id)
);

create index cardio_logs_session_exercise_idx on public.cardio_logs (session_exercise_id);

create trigger cardio_logs_set_updated_at before update on public.cardio_logs
  for each row execute function private.set_updated_at();

alter table public.cardio_logs enable row level security;

revoke all on public.cardio_logs from anon, authenticated;
grant select on public.cardio_logs to authenticated;
grant insert (log_id, session_exercise_id, duration_minutes, distance_km, avg_hr, rpe, rounds_done, completed)
  on public.cardio_logs to authenticated;
grant update (duration_minutes, distance_km, avg_hr, rpe, rounds_done, completed) on public.cardio_logs to authenticated;
grant delete on public.cardio_logs to authenticated;

create policy "cardio_logs: visible with the log"
  on public.cardio_logs for select to authenticated
  using ((select private.can_view_log(log_id)));

create policy "cardio_logs: student inserts own cardio"
  on public.cardio_logs for insert to authenticated
  with check ((select private.owns_set_log(log_id, session_exercise_id)));

create policy "cardio_logs: student updates own cardio"
  on public.cardio_logs for update to authenticated
  using ((select private.owns_set_log(log_id, session_exercise_id)))
  with check ((select private.owns_set_log(log_id, session_exercise_id)));

create policy "cardio_logs: student deletes own cardio"
  on public.cardio_logs for delete to authenticated
  using ((select private.owns_set_log(log_id, session_exercise_id)));

-- ---------------------------------------------------------------------------
-- More cardio in the global catalog
-- ---------------------------------------------------------------------------

insert into public.exercises (workspace_id, name, muscle_group, equipment, instructions) values
  (null, 'Remo ergômetro', 'cardio', 'machine', 'Empurre com as pernas, depois puxe com o tronco e os braços; volte na ordem inversa, no ritmo prescrito.'),
  (null, 'Simulador de escada', 'cardio', 'machine', 'Suba com o tronco ereto, sem apoiar o peso nos braços, na velocidade prescrita.'),
  (null, 'Bicicleta de spinning', 'cardio', 'machine', 'Ajuste banco e guidão; alterne sentado e em pé conforme a carga e a cadência prescritas.'),
  (null, 'Corrida ao ar livre', 'cardio', 'other', 'Corrida no ritmo ou na zona de frequência cardíaca prescrita, com aquecimento leve antes.'),
  (null, 'Caminhada ao ar livre', 'cardio', 'other', 'Caminhada em passo firme, na duração e intensidade prescritas.'),
  (null, 'Natação', 'cardio', 'other', 'Nado contínuo ou em séries, no estilo e na intensidade prescritos.'),
  (null, 'Air bike', 'cardio', 'machine', 'Pedale empurrando e puxando os braços ao mesmo tempo, no esforço prescrito.');
