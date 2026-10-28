-- Agenda: sessions a trainer books with a student of their workspace.
-- A trainer can never be double-booked: overlapping sessions that are not
-- cancelled are refused by an exclusion constraint (error 23P01), across all
-- of the trainer's workspaces. Students read their own sessions only.

create extension if not exists btree_gist with schema extensions;

create type public.appointment_status as enum ('scheduled', 'completed', 'cancelled', 'no_show');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  trainer_id uuid not null,
  student_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  location text check (char_length(location) <= 120),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_duration check (ends_at > starts_at and ends_at <= starts_at + interval '8 hours'),
  foreign key (workspace_id, trainer_id) references public.workspace_members (workspace_id, user_id) on delete cascade,
  foreign key (workspace_id, student_id) references public.students (workspace_id, user_id) on delete cascade,
  constraint appointments_no_overlap exclude using gist (
    trainer_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status <> 'cancelled')
);

create index appointments_workspace_starts_idx on public.appointments (workspace_id, starts_at);
create index appointments_student_starts_idx on public.appointments (student_id, starts_at);

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function private.set_updated_at();

alter table public.appointments enable row level security;
revoke all on public.appointments from anon, authenticated;
grant select, delete on public.appointments to authenticated;
grant insert (workspace_id, trainer_id, student_id, starts_at, ends_at, location, notes) on public.appointments to authenticated;
-- The trainer and workspace of a session never change; reassign by rebooking.
grant update (student_id, starts_at, ends_at, status, location, notes) on public.appointments to authenticated;

create policy "appointments: the student and staff read"
  on public.appointments for select to authenticated
  using (student_id = (select auth.uid()) or (select private.is_workspace_staff(workspace_id)));

create policy "appointments: staff book their own sessions"
  on public.appointments for insert to authenticated
  with check (trainer_id = (select auth.uid()) and (select private.is_workspace_staff(workspace_id)));

create policy "appointments: staff update"
  on public.appointments for update to authenticated
  using ((select private.is_workspace_staff(workspace_id)))
  with check ((select private.is_workspace_staff(workspace_id)));

create policy "appointments: staff delete"
  on public.appointments for delete to authenticated
  using ((select private.is_workspace_staff(workspace_id)));
