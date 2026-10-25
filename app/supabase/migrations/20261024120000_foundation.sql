-- Phase 1 foundation: profiles, trainer workspaces and workspace membership.
--
-- Authorization model
-- - Every auth user has exactly one profile (created by trigger, never by the client).
-- - Self sign-up always creates a trainer. Students join through invitations
--   (Phase 2), which will add memberships through a security definer function.
-- - A workspace is owned by one trainer. Membership rows link users to workspaces
--   with a role; client roles are never trusted, only rows in workspace_members.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('trainer', 'student');
create type public.workspace_role as enum ('owner', 'trainer', 'student');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  role public.user_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workspaces_owner_id_idx on public.workspaces (owner_id);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.workspace_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_id_idx on public.workspace_members (user_id);

-- ---------------------------------------------------------------------------
-- Helpers (security definer so policies can check membership without
-- recursing into workspace_members RLS). They only ever answer for auth.uid().
-- ---------------------------------------------------------------------------

create function private.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
  );
$$;

create function private.is_workspace_staff(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'trainer')
  );
$$;

-- True when the current user may see target_user's profile: themselves, a
-- member of a workspace they staff, or a staff member of a workspace they
-- belong to (a student sees their trainer, never other students).
create function private.can_view_profile(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user = (select auth.uid())
    or exists (
      select 1
      from public.workspace_members viewer
      join public.workspace_members target
        on target.workspace_id = viewer.workspace_id
      where viewer.user_id = (select auth.uid())
        and target.user_id = target_user
        and (viewer.role in ('owner', 'trainer') or target.role in ('owner', 'trainer'))
    );
$$;

revoke all on function private.is_workspace_member(uuid) from public;
revoke all on function private.is_workspace_staff(uuid) from public;
revoke all on function private.can_view_profile(uuid) from public;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.is_workspace_staff(uuid) to authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function private.set_updated_at();

-- Creates the profile, workspace and owner membership for a new auth user.
-- Only full_name is read from user metadata; the role is fixed server-side.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  new_workspace_id uuid;
begin
  if char_length(display_name) < 2 then
    display_name := split_part(coalesce(new.email, 'Personal'), '@', 1);
  end if;
  if char_length(display_name) < 2 then
    display_name := 'Personal';
  end if;
  display_name := left(display_name, 120);

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

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- Table privileges: anon gets nothing. Authenticated users can read, and can
-- only update the specific columns listed below. Inserts and deletes happen
-- through triggers and (later) security definer functions.
revoke all on public.profiles, public.workspaces, public.workspace_members from anon, authenticated;
grant select on public.profiles, public.workspaces, public.workspace_members to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant update (name) on public.workspaces to authenticated;

create policy "profiles: visible to self and related workspace members"
  on public.profiles for select
  to authenticated
  using ((select private.can_view_profile(id)));

create policy "profiles: users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "workspaces: visible to members"
  on public.workspaces for select
  to authenticated
  using ((select private.is_workspace_member(id)));

create policy "workspaces: owner updates workspace"
  on public.workspaces for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "workspace_members: own rows and rows of staffed workspaces"
  on public.workspace_members for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_workspace_staff(workspace_id))
  );
