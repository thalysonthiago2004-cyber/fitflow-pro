-- Phase 3: exercise library, workout plans and workout logging.
--
-- Ownership model
-- - Exercises are either global (workspace_id is null, read-only catalog) or
--   owned by a workspace (editable by its staff).
-- - A workout plan belongs to one workspace and is assigned to one student of
--   that workspace (composite FK to students). Students never see drafts.
-- - Child rows carry workspace_id and use composite FKs so a row can never
--   point at a parent in another workspace.
-- - Only the student records workout logs. Staff can read them but cannot
--   create, edit or delete them: completed workouts are never fabricated.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.muscle_group as enum (
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'core',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'full_body', 'cardio'
);

create type public.equipment as enum (
  'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'other'
);

create type public.plan_status as enum ('draft', 'active', 'archived');

-- ---------------------------------------------------------------------------
-- Exercises
-- ---------------------------------------------------------------------------

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  muscle_group public.muscle_group not null,
  equipment public.equipment not null,
  instructions text check (char_length(instructions) <= 2000),
  video_url text check (video_url ~ '^https://' and char_length(video_url) <= 500),
  archived boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index exercises_workspace_idx on public.exercises (workspace_id, name);
create unique index exercises_unique_name_per_workspace
  on public.exercises (workspace_id, lower(name))
  where workspace_id is not null and not archived;

-- ---------------------------------------------------------------------------
-- Plans, sessions and prescribed exercises
-- ---------------------------------------------------------------------------

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  student_id uuid not null,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  notes text check (char_length(notes) <= 2000),
  status public.plan_status not null default 'draft',
  starts_on date,
  ends_on date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  foreign key (workspace_id, student_id)
    references public.students (workspace_id, user_id) on delete cascade
);

create index workout_plans_student_idx on public.workout_plans (student_id, status);
create index workout_plans_workspace_idx on public.workout_plans (workspace_id, created_at desc);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  plan_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  weekdays smallint[] not null default '{}'
    check (weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (plan_id, workspace_id)
    references public.workout_plans (id, workspace_id) on delete cascade
);

create index workout_sessions_plan_idx on public.workout_sessions (plan_id, position);

create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  session_id uuid not null,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position integer not null default 0,
  sets smallint not null check (sets between 1 and 20),
  reps_min smallint not null check (reps_min between 1 and 100),
  reps_max smallint check (reps_max between 1 and 100),
  load_kg numeric(6, 2) check (load_kg between 0 and 1000),
  rest_seconds smallint check (rest_seconds between 0 and 900),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reps_max is null or reps_max >= reps_min),
  foreign key (session_id, workspace_id)
    references public.workout_sessions (id, workspace_id) on delete cascade
);

create index session_exercises_session_idx on public.session_exercises (session_id, position);
create index session_exercises_exercise_idx on public.session_exercises (exercise_id);

-- ---------------------------------------------------------------------------
-- Logs recorded by the student
-- ---------------------------------------------------------------------------

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  student_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid not null,
  session_id uuid not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_at is null or completed_at >= started_at),
  foreign key (plan_id, workspace_id)
    references public.workout_plans (id, workspace_id) on delete cascade,
  foreign key (session_id, workspace_id)
    references public.workout_sessions (id, workspace_id) on delete cascade
);

create index workout_logs_student_idx on public.workout_logs (student_id, started_at desc);
create index workout_logs_workspace_idx on public.workout_logs (workspace_id, started_at desc);
create index workout_logs_session_idx on public.workout_logs (session_id);
-- At most one workout in progress per student.
create unique index workout_logs_one_open_per_student
  on public.workout_logs (student_id)
  where completed_at is null;

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.workout_logs (id) on delete cascade,
  session_exercise_id uuid not null references public.session_exercises (id) on delete cascade,
  set_number smallint not null check (set_number between 1 and 20),
  reps smallint check (reps between 0 and 200),
  load_kg numeric(6, 2) check (load_kg between 0 and 1000),
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (log_id, session_exercise_id, set_number)
);

create index set_logs_session_exercise_idx on public.set_logs (session_exercise_id);

create trigger exercises_set_updated_at before update on public.exercises
  for each row execute function private.set_updated_at();
create trigger workout_plans_set_updated_at before update on public.workout_plans
  for each row execute function private.set_updated_at();
create trigger workout_sessions_set_updated_at before update on public.workout_sessions
  for each row execute function private.set_updated_at();
create trigger session_exercises_set_updated_at before update on public.session_exercises
  for each row execute function private.set_updated_at();
create trigger workout_logs_set_updated_at before update on public.workout_logs
  for each row execute function private.set_updated_at();
create trigger set_logs_set_updated_at before update on public.set_logs
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Staff of the plan's workspace, or the assigned student once the plan is
-- published (active or archived). Drafts stay private to staff.
create function private.can_view_plan(target_plan uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workout_plans p
    where p.id = target_plan
      and (
        private.is_workspace_staff(p.workspace_id)
        or (p.student_id = (select auth.uid()) and p.status in ('active', 'archived'))
      )
  );
$$;

create function private.can_view_session(target_session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workout_sessions s
    where s.id = target_session and private.can_view_plan(s.plan_id)
  );
$$;

-- True when the current user is the student of an active plan containing the session.
create function private.can_log_session(target_session uuid, target_plan uuid, target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workout_sessions s
    join public.workout_plans p on p.id = s.plan_id
    where s.id = target_session
      and p.id = target_plan
      and p.workspace_id = target_workspace
      and p.student_id = (select auth.uid())
      and p.status = 'active'
  );
$$;

-- The set belongs to a log owned by the current user, and the prescribed
-- exercise belongs to that log's session.
create function private.owns_set_log(target_log uuid, target_session_exercise uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workout_logs l
    join public.session_exercises se on se.session_id = l.session_id
    where l.id = target_log
      and se.id = target_session_exercise
      and l.student_id = (select auth.uid())
  );
$$;

create function private.can_view_log(target_log uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workout_logs l
    where l.id = target_log
      and (l.student_id = (select auth.uid()) or private.is_workspace_staff(l.workspace_id))
  );
$$;

-- Exercises usable in a workspace: global ones and the workspace's own.
create function private.exercise_usable_in(target_exercise uuid, target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.exercises e
    where e.id = target_exercise
      and (e.workspace_id is null or e.workspace_id = target_workspace)
  );
$$;

revoke all on function private.can_view_plan(uuid) from public;
revoke all on function private.can_view_session(uuid) from public;
revoke all on function private.can_log_session(uuid, uuid, uuid) from public;
revoke all on function private.owns_set_log(uuid, uuid) from public;
revoke all on function private.can_view_log(uuid) from public;
revoke all on function private.exercise_usable_in(uuid, uuid) from public;
grant execute on function private.can_view_plan(uuid) to authenticated;
grant execute on function private.can_view_session(uuid) to authenticated;
grant execute on function private.can_log_session(uuid, uuid, uuid) to authenticated;
grant execute on function private.owns_set_log(uuid, uuid) to authenticated;
grant execute on function private.can_view_log(uuid) to authenticated;
grant execute on function private.exercise_usable_in(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.exercises enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.workout_logs enable row level security;
alter table public.set_logs enable row level security;

revoke all on public.exercises, public.workout_plans, public.workout_sessions,
  public.session_exercises, public.workout_logs, public.set_logs from anon, authenticated;

grant select on public.exercises, public.workout_plans, public.workout_sessions,
  public.session_exercises, public.workout_logs, public.set_logs to authenticated;

grant insert (workspace_id, name, muscle_group, equipment, instructions, video_url, created_by)
  on public.exercises to authenticated;
grant update (name, muscle_group, equipment, instructions, video_url, archived)
  on public.exercises to authenticated;

grant insert (workspace_id, student_id, name, notes, status, starts_on, ends_on, created_by)
  on public.workout_plans to authenticated;
grant update (name, notes, status, starts_on, ends_on) on public.workout_plans to authenticated;
grant delete on public.workout_plans to authenticated;

grant insert (workspace_id, plan_id, name, weekdays, position) on public.workout_sessions to authenticated;
grant update (name, weekdays, position) on public.workout_sessions to authenticated;
grant delete on public.workout_sessions to authenticated;

grant insert (workspace_id, session_id, exercise_id, position, sets, reps_min, reps_max, load_kg, rest_seconds, notes)
  on public.session_exercises to authenticated;
grant update (exercise_id, position, sets, reps_min, reps_max, load_kg, rest_seconds, notes)
  on public.session_exercises to authenticated;
grant delete on public.session_exercises to authenticated;

grant insert (workspace_id, student_id, plan_id, session_id, notes) on public.workout_logs to authenticated;
grant update (completed_at, notes) on public.workout_logs to authenticated;
grant delete on public.workout_logs to authenticated;

grant insert (log_id, session_exercise_id, set_number, reps, load_kg, completed) on public.set_logs to authenticated;
grant update (reps, load_kg, completed) on public.set_logs to authenticated;
grant delete on public.set_logs to authenticated;

-- exercises
create policy "exercises: global catalog and own workspace"
  on public.exercises for select to authenticated
  using (workspace_id is null or (select private.is_workspace_member(workspace_id)));

create policy "exercises: staff create in their workspace"
  on public.exercises for insert to authenticated
  with check (
    workspace_id is not null
    and (select private.is_workspace_staff(workspace_id))
    and created_by = (select auth.uid())
  );

create policy "exercises: staff update their workspace exercises"
  on public.exercises for update to authenticated
  using (workspace_id is not null and (select private.is_workspace_staff(workspace_id)))
  with check (workspace_id is not null and (select private.is_workspace_staff(workspace_id)));

-- workout_plans
create policy "workout_plans: staff and assigned student read"
  on public.workout_plans for select to authenticated
  using (
    (select private.is_workspace_staff(workspace_id))
    or (student_id = (select auth.uid()) and status in ('active', 'archived'))
  );

create policy "workout_plans: staff insert"
  on public.workout_plans for insert to authenticated
  with check ((select private.is_workspace_staff(workspace_id)) and created_by = (select auth.uid()));

create policy "workout_plans: staff update"
  on public.workout_plans for update to authenticated
  using ((select private.is_workspace_staff(workspace_id)))
  with check ((select private.is_workspace_staff(workspace_id)));

create policy "workout_plans: staff delete"
  on public.workout_plans for delete to authenticated
  using ((select private.is_workspace_staff(workspace_id)));

-- workout_sessions
create policy "workout_sessions: visible with the plan"
  on public.workout_sessions for select to authenticated
  using ((select private.can_view_plan(plan_id)));

create policy "workout_sessions: staff insert"
  on public.workout_sessions for insert to authenticated
  with check ((select private.is_workspace_staff(workspace_id)));

create policy "workout_sessions: staff update"
  on public.workout_sessions for update to authenticated
  using ((select private.is_workspace_staff(workspace_id)))
  with check ((select private.is_workspace_staff(workspace_id)));

create policy "workout_sessions: staff delete"
  on public.workout_sessions for delete to authenticated
  using ((select private.is_workspace_staff(workspace_id)));

-- session_exercises
create policy "session_exercises: visible with the session"
  on public.session_exercises for select to authenticated
  using ((select private.can_view_session(session_id)));

create policy "session_exercises: staff insert usable exercises"
  on public.session_exercises for insert to authenticated
  with check (
    (select private.is_workspace_staff(workspace_id))
    and (select private.exercise_usable_in(exercise_id, workspace_id))
  );

create policy "session_exercises: staff update"
  on public.session_exercises for update to authenticated
  using ((select private.is_workspace_staff(workspace_id)))
  with check (
    (select private.is_workspace_staff(workspace_id))
    and (select private.exercise_usable_in(exercise_id, workspace_id))
  );

create policy "session_exercises: staff delete"
  on public.session_exercises for delete to authenticated
  using ((select private.is_workspace_staff(workspace_id)));

-- workout_logs: the student writes, staff read
create policy "workout_logs: student and staff read"
  on public.workout_logs for select to authenticated
  using (
    student_id = (select auth.uid())
    or (select private.is_workspace_staff(workspace_id))
  );

create policy "workout_logs: student starts a workout of an active plan"
  on public.workout_logs for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and (select private.can_log_session(session_id, plan_id, workspace_id))
  );

create policy "workout_logs: student updates own logs"
  on public.workout_logs for update to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

create policy "workout_logs: student deletes own logs"
  on public.workout_logs for delete to authenticated
  using (student_id = (select auth.uid()));

-- set_logs
create policy "set_logs: visible with the log"
  on public.set_logs for select to authenticated
  using ((select private.can_view_log(log_id)));

create policy "set_logs: student inserts own sets"
  on public.set_logs for insert to authenticated
  with check ((select private.owns_set_log(log_id, session_exercise_id)));

create policy "set_logs: student updates own sets"
  on public.set_logs for update to authenticated
  using ((select private.owns_set_log(log_id, session_exercise_id)))
  with check ((select private.owns_set_log(log_id, session_exercise_id)));

create policy "set_logs: student deletes own sets"
  on public.set_logs for delete to authenticated
  using ((select private.owns_set_log(log_id, session_exercise_id)));

-- ---------------------------------------------------------------------------
-- Global exercise catalog (names in pt-BR, short execution cues).
-- ---------------------------------------------------------------------------

insert into public.exercises (workspace_id, name, muscle_group, equipment, instructions) values
  (null, 'Supino reto com barra', 'chest', 'barbell', 'Deitado no banco, desça a barra até a linha do peito com controle e empurre até estender os cotovelos, mantendo as escápulas retraídas.'),
  (null, 'Supino inclinado com halteres', 'chest', 'dumbbell', 'Com o banco inclinado, desça os halteres ao lado do peito e empurre para cima, aproximando-os no topo.'),
  (null, 'Crucifixo com halteres', 'chest', 'dumbbell', 'Com cotovelos levemente flexionados, abra os braços em arco até sentir alongamento no peito e retorne.'),
  (null, 'Flexão de braço', 'chest', 'bodyweight', 'Mãos na largura dos ombros e corpo alinhado; desça o peito até perto do chão e empurre de volta.'),
  (null, 'Crossover na polia', 'chest', 'cable', 'Com as polias altas, traga as mãos à frente do corpo em arco, contraindo o peito, e volte devagar.'),
  (null, 'Puxada frontal na polia', 'back', 'cable', 'Puxe a barra até a parte alta do peito levando os cotovelos para baixo, sem balançar o tronco.'),
  (null, 'Remada curvada com barra', 'back', 'barbell', 'Tronco inclinado e coluna neutra; puxe a barra em direção ao abdômen e desça com controle.'),
  (null, 'Remada unilateral com halter', 'back', 'dumbbell', 'Apoiado no banco, puxe o halter em direção ao quadril mantendo o tronco estável.'),
  (null, 'Remada baixa na polia', 'back', 'cable', 'Sentado com o tronco firme, puxe o triângulo até o abdômen aproximando as escápulas.'),
  (null, 'Barra fixa', 'back', 'bodyweight', 'Pendurado na barra, puxe o corpo até o queixo passar a barra e desça até estender os braços.'),
  (null, 'Levantamento terra', 'back', 'barbell', 'Barra próxima às canelas e coluna neutra; estenda quadril e joelhos juntos até ficar em pé.'),
  (null, 'Desenvolvimento com halteres', 'shoulders', 'dumbbell', 'Sentado ou em pé, empurre os halteres acima da cabeça a partir da altura dos ombros.'),
  (null, 'Elevação lateral', 'shoulders', 'dumbbell', 'Eleve os halteres lateralmente até a altura dos ombros com cotovelos levemente flexionados.'),
  (null, 'Elevação frontal', 'shoulders', 'dumbbell', 'Eleve o halter à frente do corpo até a altura dos ombros e desça com controle.'),
  (null, 'Crucifixo inverso na máquina', 'shoulders', 'machine', 'De frente para a máquina, abra os braços para trás contraindo a parte posterior dos ombros.'),
  (null, 'Rosca direta com barra', 'biceps', 'barbell', 'Cotovelos junto ao corpo; flexione os braços levando a barra até os ombros sem balançar o tronco.'),
  (null, 'Rosca alternada com halteres', 'biceps', 'dumbbell', 'Flexione um braço de cada vez girando o punho para cima durante a subida.'),
  (null, 'Rosca martelo', 'biceps', 'dumbbell', 'Com as palmas voltadas uma para a outra, flexione os cotovelos mantendo-os fixos.'),
  (null, 'Tríceps na polia', 'triceps', 'cable', 'Cotovelos fixos ao lado do corpo; estenda os braços empurrando a barra para baixo.'),
  (null, 'Tríceps francês com halter', 'triceps', 'dumbbell', 'Com o halter acima da cabeça, flexione os cotovelos levando-o atrás da nuca e estenda.'),
  (null, 'Mergulho no banco', 'triceps', 'bodyweight', 'Mãos apoiadas no banco atrás do corpo; flexione os cotovelos descendo o quadril e empurre de volta.'),
  (null, 'Prancha', 'core', 'bodyweight', 'Apoiado nos antebraços e pontas dos pés, mantenha o corpo alinhado contraindo abdômen e glúteos.'),
  (null, 'Abdominal supra', 'core', 'bodyweight', 'Deitado com joelhos flexionados, eleve o tronco contraindo o abdômen sem puxar o pescoço.'),
  (null, 'Elevação de pernas', 'core', 'bodyweight', 'Deitado ou suspenso, eleve as pernas mantendo a lombar estável e desça devagar.'),
  (null, 'Agachamento livre', 'quadriceps', 'barbell', 'Barra apoiada nas costas; desça flexionando quadril e joelhos com o tronco firme e suba empurrando o chão.'),
  (null, 'Leg press 45°', 'quadriceps', 'machine', 'Pés na plataforma na largura do quadril; desça até um ângulo confortável e empurre sem travar os joelhos.'),
  (null, 'Cadeira extensora', 'quadriceps', 'machine', 'Sentado, estenda os joelhos elevando o apoio e desça com controle.'),
  (null, 'Afundo com halteres', 'quadriceps', 'dumbbell', 'Dê um passo à frente e desça até os dois joelhos formarem cerca de 90°; volte à posição inicial.'),
  (null, 'Agachamento búlgaro', 'quadriceps', 'dumbbell', 'Com o pé de trás apoiado no banco, desça flexionando o joelho da frente e suba.'),
  (null, 'Mesa flexora', 'hamstrings', 'machine', 'Deitado de bruços, flexione os joelhos trazendo o apoio em direção aos glúteos.'),
  (null, 'Stiff com barra', 'hamstrings', 'barbell', 'Joelhos levemente flexionados; desça a barra próxima às pernas inclinando o quadril para trás e retorne.'),
  (null, 'Elevação pélvica', 'glutes', 'barbell', 'Costas apoiadas no banco e barra sobre o quadril; eleve o quadril contraindo os glúteos.'),
  (null, 'Cadeira abdutora', 'glutes', 'machine', 'Sentado, afaste as pernas contra a resistência e retorne devagar.'),
  (null, 'Glúteo na polia', 'glutes', 'cable', 'Com a tornozeleira presa à polia, estenda o quadril levando a perna para trás.'),
  (null, 'Panturrilha em pé', 'calves', 'machine', 'Eleve os calcanhares o máximo possível e desça alongando a panturrilha.'),
  (null, 'Panturrilha sentado', 'calves', 'machine', 'Sentado com os joelhos sob o apoio, eleve os calcanhares e desça com controle.'),
  (null, 'Kettlebell swing', 'full_body', 'kettlebell', 'Com o quadril como motor, balance o kettlebell até a altura do peito e deixe-o descer entre as pernas.'),
  (null, 'Burpee', 'full_body', 'bodyweight', 'Agache, leve os pés para trás em prancha, volte e salte com os braços acima da cabeça.'),
  (null, 'Esteira', 'cardio', 'machine', 'Caminhada ou corrida na intensidade e duração prescritas.'),
  (null, 'Bicicleta ergométrica', 'cardio', 'machine', 'Pedale na cadência e carga prescritas, com o banco ajustado à altura do quadril.'),
  (null, 'Elíptico', 'cardio', 'machine', 'Movimento contínuo de braços e pernas na intensidade prescrita.'),
  (null, 'Pular corda', 'cardio', 'other', 'Saltos curtos na ponta dos pés, girando a corda com os punhos.'),
  (null, 'Remada com elástico', 'back', 'band', 'Com o elástico preso à frente, puxe as pontas em direção ao abdômen aproximando as escápulas.');
