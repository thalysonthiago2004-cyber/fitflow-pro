-- Supersets, per-set repetitions and exercise videos.
--
-- - Consecutive strength items sharing a superset_group form a bi-set,
--   tri-set or circuit: performed back to back, with the group's rest after
--   the last exercise of each round.
-- - reps_per_set prescribes repetitions for each set (e.g. 12/10/8). When
--   set, reps_min/reps_max hold its range so older readers keep working.
-- - Videos can be uploaded to the private `exercise-videos` bucket under
--   `<workspace id>/`. Workspace members watch them through signed URLs.
-- - Staff can customize a global exercise (instructions and video) for their
--   workspace without touching the shared catalog.

-- ---------------------------------------------------------------------------
-- Prescriptions
-- ---------------------------------------------------------------------------

alter table public.session_exercises
  add column superset_group uuid,
  add column reps_per_set smallint[];

alter table public.session_exercises add constraint session_exercises_superset_strength
  check (superset_group is null or kind = 'strength');

alter table public.session_exercises add constraint session_exercises_reps_per_set check (
  reps_per_set is null or (
    kind = 'strength'
    and array_length(reps_per_set, 1) = sets
    and 1 <= all (reps_per_set)
    and 100 >= all (reps_per_set)
  )
);

create index session_exercises_superset_idx on public.session_exercises (superset_group) where superset_group is not null;

grant insert (superset_group, reps_per_set) on public.session_exercises to authenticated;
grant update (superset_group, reps_per_set) on public.session_exercises to authenticated;

-- ---------------------------------------------------------------------------
-- Exercise videos
-- ---------------------------------------------------------------------------

alter table public.exercises add column video_path text;
alter table public.exercises add constraint exercises_video_in_workspace check (
  video_path is null or (
    workspace_id is not null
    and video_path ~ ('^' || workspace_id::text || '/[0-9a-f-]{36}\.(mp4|webm|mov)$')
  )
);
grant insert (video_path) on public.exercises to authenticated;
grant update (video_path) on public.exercises to authenticated;

create function private.is_global_exercise(target_exercise uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.exercises e where e.id = target_exercise and e.workspace_id is null);
$$;

revoke all on function private.is_global_exercise(uuid) from public;
grant execute on function private.is_global_exercise(uuid) to authenticated;

create table public.exercise_customizations (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  instructions text check (char_length(instructions) <= 2000),
  video_url text check (video_url ~ '^https://' and char_length(video_url) <= 500),
  video_path text,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, exercise_id),
  check (video_path is null or video_path ~ ('^' || workspace_id::text || '/[0-9a-f-]{36}\.(mp4|webm|mov)$'))
);

create trigger exercise_customizations_set_updated_at before update on public.exercise_customizations
  for each row execute function private.set_updated_at();

alter table public.exercise_customizations enable row level security;

revoke all on public.exercise_customizations from anon, authenticated;
grant select, delete on public.exercise_customizations to authenticated;
grant insert (workspace_id, exercise_id, instructions, video_url, video_path, updated_by) on public.exercise_customizations to authenticated;
grant update (instructions, video_url, video_path, updated_by) on public.exercise_customizations to authenticated;

create policy "exercise_customizations: workspace members read"
  on public.exercise_customizations for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy "exercise_customizations: staff customize global exercises"
  on public.exercise_customizations for insert to authenticated
  with check (
    (select private.is_workspace_staff(workspace_id))
    and (select private.is_global_exercise(exercise_id))
    and updated_by = (select auth.uid())
  );

create policy "exercise_customizations: staff update"
  on public.exercise_customizations for update to authenticated
  using ((select private.is_workspace_staff(workspace_id)))
  with check ((select private.is_workspace_staff(workspace_id)) and updated_by = (select auth.uid()));

create policy "exercise_customizations: staff delete"
  on public.exercise_customizations for delete to authenticated
  using ((select private.is_workspace_staff(workspace_id)));

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-videos', 'exercise-videos', false, 52428800, array['video/mp4', 'video/webm', 'video/quicktime']);

-- `<workspace id>/<file>` → workspace id, or null for malformed names.
create function private.workspace_folder(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  parts text[] := string_to_array(object_name, '/');
begin
  if array_length(parts, 1) = 2 and parts[1] ~ '^[0-9a-f-]{36}$' then
    return parts[1]::uuid;
  end if;
  return null;
end;
$$;

revoke all on function private.workspace_folder(text) from public;
grant execute on function private.workspace_folder(text) to authenticated;

create policy "exercise-videos: workspace members watch"
  on storage.objects for select to authenticated
  using (bucket_id = 'exercise-videos' and private.is_workspace_member(private.workspace_folder(name)));

create policy "exercise-videos: staff upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'exercise-videos' and private.is_workspace_staff(private.workspace_folder(name)));

create policy "exercise-videos: staff delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'exercise-videos' and private.is_workspace_staff(private.workspace_folder(name)));
