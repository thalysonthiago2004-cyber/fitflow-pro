-- Trainer photos, body composition inputs and before/after progress photos.
--
-- - Avatars live in the public `avatars` bucket under `<user id>/`. Only the
--   owner writes their folder; the path is stored on the profile.
-- - Progress photos live in the private `progress-photos` bucket under
--   `<workspace id>/<student id>/`. Only the student uploads or deletes their
--   own; the student and their workspace staff read them (signed URLs).
-- - Body composition: neck circumference feeds the tape-measure estimate,
--   which the app calculates and never stores. Values read from a
--   bioimpedance scale are stored as entered, tagged with their source.

-- ---------------------------------------------------------------------------
-- Students and measurements
-- ---------------------------------------------------------------------------

create type public.sex as enum ('female', 'male');
create type public.measurement_source as enum ('manual', 'bioimpedance');

alter table public.students add column sex public.sex;
grant update (sex) on public.students to authenticated;

alter table public.body_measurements
  add column neck_cm numeric(4, 1) check (neck_cm between 20 and 80),
  add column muscle_mass_kg numeric(5, 2) check (muscle_mass_kg between 5 and 200),
  add column body_water_pct numeric(4, 1) check (body_water_pct between 20 and 80),
  add column visceral_fat smallint check (visceral_fat between 1 and 59),
  add column bmr_kcal smallint check (bmr_kcal between 500 and 5000),
  add column source public.measurement_source not null default 'manual';

-- Replace the "at least one value" rule so the new columns count.
do $$
declare
  constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  where c.conrelid = 'public.body_measurements'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%num_nonnulls%';
  execute format('alter table public.body_measurements drop constraint %I', constraint_name);
end;
$$;

alter table public.body_measurements add constraint body_measurements_has_value check (
  num_nonnulls(weight_kg, body_fat_pct, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm,
    neck_cm, muscle_mass_kg, body_water_pct, visceral_fat, bmr_kcal) > 0
);

grant insert (neck_cm, muscle_mass_kg, body_water_pct, visceral_fat, bmr_kcal, source)
  on public.body_measurements to authenticated;
grant update (neck_cm, muscle_mass_kg, body_water_pct, visceral_fat, bmr_kcal, source)
  on public.body_measurements to authenticated;

-- ---------------------------------------------------------------------------
-- Avatars
-- ---------------------------------------------------------------------------

alter table public.profiles add column avatar_path text check (
  avatar_path ~ '^[0-9a-f-]{36}/[0-9a-z-]{1,64}\.(jpg|webp)$'
);
grant update (avatar_path) on public.profiles to authenticated;

-- The avatar must sit in the owner's folder.
alter table public.profiles add constraint profiles_avatar_in_own_folder
  check (avatar_path is null or split_part(avatar_path, '/', 1) = id::text);

-- ---------------------------------------------------------------------------
-- Progress photos
-- ---------------------------------------------------------------------------

create type public.photo_pose as enum ('front', 'side', 'back');

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  student_id uuid not null,
  taken_on date not null check (taken_on >= date '2000-01-01'),
  pose public.photo_pose not null,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  -- The file must sit in this student's folder of this workspace.
  check (storage_path ~ ('^' || workspace_id::text || '/' || student_id::text || '/[0-9a-f-]{36}\.(jpg|webp)$')),
  foreign key (workspace_id, student_id)
    references public.students (workspace_id, user_id) on delete cascade
);

create index progress_photos_student_idx on public.progress_photos (student_id, taken_on desc);

create function private.check_taken_on()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.taken_on > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'future_date' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger progress_photos_check_date before insert or update on public.progress_photos
  for each row execute function private.check_taken_on();

alter table public.progress_photos enable row level security;

revoke all on public.progress_photos from anon, authenticated;
grant select, delete on public.progress_photos to authenticated;
grant insert (workspace_id, student_id, taken_on, pose, storage_path) on public.progress_photos to authenticated;

create policy "progress_photos: the student and staff read"
  on public.progress_photos for select to authenticated
  using (student_id = (select auth.uid()) or (select private.is_workspace_staff(workspace_id)));

create policy "progress_photos: the student adds their own"
  on public.progress_photos for insert to authenticated
  with check (student_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)));

create policy "progress_photos: the student deletes their own"
  on public.progress_photos for delete to authenticated
  using (student_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/webp']),
  ('progress-photos', 'progress-photos', false, 5242880, array['image/jpeg', 'image/webp']);

-- Parses `<workspace>/<student>/<file>` without failing on malformed names.
create function private.progress_photo_folder(object_name text, out workspace_id uuid, out student_id uuid)
language plpgsql
immutable
set search_path = ''
as $$
declare
  parts text[] := string_to_array(object_name, '/');
begin
  if array_length(parts, 1) = 3
    and parts[1] ~ '^[0-9a-f-]{36}$'
    and parts[2] ~ '^[0-9a-f-]{36}$' then
    workspace_id := parts[1]::uuid;
    student_id := parts[2]::uuid;
  end if;
end;
$$;

revoke all on function private.progress_photo_folder(text) from public;
grant execute on function private.progress_photo_folder(text) to authenticated;

create policy "avatars: owners write their folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy "avatars: owners replace their files"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy "avatars: owners delete their files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy "progress-photos: the student uploads into their folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'progress-photos'
    and (private.progress_photo_folder(name)).student_id = (select auth.uid())
    and private.is_workspace_member((private.progress_photo_folder(name)).workspace_id)
  );

create policy "progress-photos: the student and staff read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and (
      (private.progress_photo_folder(name)).student_id = (select auth.uid())
      or private.is_workspace_staff((private.progress_photo_folder(name)).workspace_id)
    )
  );

create policy "progress-photos: the student deletes their files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'progress-photos'
    and (private.progress_photo_folder(name)).student_id = (select auth.uid())
  );
