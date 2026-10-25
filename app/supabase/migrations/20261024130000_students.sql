-- Phase 2: student invitations, enrollment and student profiles.
--
-- Invitation flow
-- - Staff create an invitation through create_student_invitation(). A random
--   token is returned once; only its SHA-256 hash is stored.
-- - The trainer shares the link (/invite/<token>). The student signs up with
--   the invite token in user metadata, or accepts while signed in.
-- - Enrollment always happens inside security definer functions that check
--   the token, its expiry and that the e-mail matches. Clients never insert
--   memberships or pick their own role.
-- - A student belongs to at most one workspace at a time.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.invitation_status as enum ('pending', 'accepted', 'revoked');
create type public.student_status as enum ('active', 'archived');
create type public.experience_level as enum ('beginner', 'intermediate', 'advanced');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (
    email = lower(btrim(email))
    and char_length(email) between 3 and 254
    and position('@' in email) > 1
  ),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  token_hash text not null unique,
  status public.invitation_status not null default 'pending',
  invited_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index invitations_one_pending_per_email
  on public.invitations (workspace_id, email)
  where status = 'pending';
create index invitations_workspace_created_idx on public.invitations (workspace_id, created_at desc);

-- One student membership per user.
create unique index workspace_members_one_student_workspace
  on public.workspace_members (user_id)
  where role = 'student';

create table public.students (
  workspace_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254),
  status public.student_status not null default 'active',
  goal text check (char_length(goal) <= 500),
  experience_level public.experience_level,
  birth_date date check (birth_date >= date '1900-01-01'),
  height_cm numeric(4, 1) check (height_cm between 50 and 260),
  limitations text check (char_length(limitations) <= 1000),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  foreign key (workspace_id, user_id)
    references public.workspace_members (workspace_id, user_id) on delete cascade
);

create index students_workspace_status_idx on public.students (workspace_id, status);

create trigger invitations_set_updated_at
  before update on public.invitations
  for each row execute function private.set_updated_at();

create trigger students_set_updated_at
  before update on public.students
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function private.hash_token(token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(token, 'UTF8')), 'hex');
$$;

-- Enrolls p_user as a student using an invitation token. Locks the invitation
-- row so concurrent accepts cannot both succeed.
create function private.enroll_student(p_user uuid, p_email text, p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.invitations%rowtype;
begin
  select * into invitation
  from public.invitations
  where token_hash = private.hash_token(coalesce(p_token, ''))
  for update;

  if not found or invitation.status <> 'pending' or invitation.expires_at <= now() then
    raise exception 'invitation_invalid' using errcode = 'P0001';
  end if;

  if lower(btrim(coalesce(p_email, ''))) <> invitation.email then
    raise exception 'invitation_email_mismatch' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.workspace_members
    where user_id = p_user and role = 'student'
  ) then
    raise exception 'already_enrolled' using errcode = 'P0001';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (invitation.workspace_id, p_user, 'student');

  insert into public.students (workspace_id, user_id, email)
  values (invitation.workspace_id, p_user, invitation.email);

  update public.invitations
  set status = 'accepted', accepted_by = p_user, accepted_at = now()
  where id = invitation.id;

  return invitation.workspace_id;
end;
$$;

revoke all on function private.hash_token(text) from public;
revoke all on function private.enroll_student(uuid, text, text) from public;

-- ---------------------------------------------------------------------------
-- Sign-up: users who arrive with an invite token become students of that
-- workspace; everyone else becomes a trainer with their own workspace.
-- An invalid token aborts the sign-up instead of silently creating a trainer.
-- ---------------------------------------------------------------------------

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  invite_token text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'invite_token', '')), '');
  new_workspace_id uuid;
begin
  if char_length(display_name) < 2 then
    display_name := split_part(coalesce(new.email, 'Personal'), '@', 1);
  end if;
  if char_length(display_name) < 2 then
    display_name := case when invite_token is null then 'Personal' else 'Aluno' end;
  end if;
  display_name := left(display_name, 120);

  if invite_token is not null then
    insert into public.profiles (id, full_name, role)
    values (new.id, display_name, 'student');
    perform private.enroll_student(new.id, new.email, invite_token);
    return new;
  end if;

  insert into public.profiles (id, full_name, role)
  values (new.id, display_name, 'trainer');

  insert into public.workspaces (name, owner_id)
  values (left('Equipe de ' || display_name, 80), new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Creates (or refreshes) a pending invitation and returns the plain token once.
create function public.create_student_invitation(
  p_workspace_id uuid,
  p_email text,
  p_full_name text
)
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  plain_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  new_expiry timestamptz := now() + interval '7 days';
  result_id uuid;
begin
  if not private.is_workspace_staff(p_workspace_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.students
    where workspace_id = p_workspace_id and email = normalized_email
  ) then
    raise exception 'already_student' using errcode = 'P0001';
  end if;

  update public.invitations i
  set token_hash = private.hash_token(plain_token),
      full_name = btrim(p_full_name),
      invited_by = (select auth.uid()),
      expires_at = new_expiry
  where i.workspace_id = p_workspace_id
    and i.email = normalized_email
    and i.status = 'pending'
  returning i.id into result_id;

  if result_id is null then
    insert into public.invitations (workspace_id, email, full_name, token_hash, invited_by, expires_at)
    values (
      p_workspace_id,
      normalized_email,
      btrim(p_full_name),
      private.hash_token(plain_token),
      (select auth.uid()),
      new_expiry
    )
    returning id into result_id;
  end if;

  return query select result_id, plain_token, new_expiry;
end;
$$;

-- Issues a fresh token for an existing pending invitation.
create function public.refresh_student_invitation(p_invitation_id uuid)
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  plain_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  new_expiry timestamptz := now() + interval '7 days';
  target_workspace uuid;
begin
  select i.workspace_id into target_workspace
  from public.invitations i
  where i.id = p_invitation_id and i.status = 'pending';

  if target_workspace is null or not private.is_workspace_staff(target_workspace) then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;

  update public.invitations
  set token_hash = private.hash_token(plain_token), expires_at = new_expiry
  where id = p_invitation_id;

  return query select p_invitation_id, plain_token, new_expiry;
end;
$$;

create function public.revoke_student_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.invitations
  set status = 'revoked'
  where id = p_invitation_id
    and status = 'pending'
    and private.is_workspace_staff(workspace_id);

  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- Public preview of a valid invitation. Knowing the token is the credential.
create function public.get_invitation(p_token text)
returns table (email text, full_name text, workspace_name text, trainer_name text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.email, i.full_name, w.name, p.full_name, i.expires_at
  from public.invitations i
  join public.workspaces w on w.id = i.workspace_id
  join public.profiles p on p.id = w.owner_id
  where i.token_hash = private.hash_token(coalesce(p_token, ''))
    and i.status = 'pending'
    and i.expires_at > now();
$$;

-- Accept an invitation with an existing student account.
create function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  caller_email text;
  caller_role public.user_role;
begin
  if caller is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select role into caller_role from public.profiles where id = caller;
  if caller_role is distinct from 'student' then
    raise exception 'trainer_account' using errcode = 'P0001';
  end if;

  select email into caller_email from auth.users where id = caller;
  return private.enroll_student(caller, caller_email, p_token);
end;
$$;

-- Ends the relationship: removes the membership (and the student row by cascade).
-- The student keeps their account and can accept another trainer's invitation.
create function public.remove_student(p_workspace_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_workspace_staff(p_workspace_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  delete from public.workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id and role = 'student';

  if not found then
    raise exception 'student_not_found' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.create_student_invitation(uuid, text, text) from public, anon;
revoke all on function public.refresh_student_invitation(uuid) from public, anon;
revoke all on function public.revoke_student_invitation(uuid) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
revoke all on function public.remove_student(uuid, uuid) from public, anon;
revoke all on function public.get_invitation(text) from public;
grant execute on function public.create_student_invitation(uuid, text, text) to authenticated;
grant execute on function public.refresh_student_invitation(uuid) to authenticated;
grant execute on function public.revoke_student_invitation(uuid) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.remove_student(uuid, uuid) to authenticated;
grant execute on function public.get_invitation(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.invitations enable row level security;
alter table public.students enable row level security;

revoke all on public.invitations, public.students from anon, authenticated;
-- token_hash is deliberately not readable by clients.
grant select (id, workspace_id, email, full_name, status, invited_by, expires_at, accepted_by, accepted_at, created_at, updated_at)
  on public.invitations to authenticated;
grant select on public.students to authenticated;
grant update (status, goal, experience_level, birth_date, height_cm, limitations)
  on public.students to authenticated;

create policy "invitations: staff read their workspace invitations"
  on public.invitations for select
  to authenticated
  using ((select private.is_workspace_staff(workspace_id)));

create policy "students: staff and the student read"
  on public.students for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_workspace_staff(workspace_id))
  );

create policy "students: staff update"
  on public.students for update
  to authenticated
  using ((select private.is_workspace_staff(workspace_id)))
  with check ((select private.is_workspace_staff(workspace_id)));
