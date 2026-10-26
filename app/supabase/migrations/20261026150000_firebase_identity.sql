-- Firebase Authentication is the identity provider (passwords, e-mail
-- verification, password reset). Each Supabase user is linked to exactly one
-- Firebase account; the server verifies the Firebase ID token and then opens
-- the Supabase session, so RLS keeps working on auth.uid() unchanged.
--
-- Only the server (service role) writes the link: clients have no grant on
-- the column, so nobody can point their profile at another identity.

alter table public.profiles add column firebase_uid text unique check (firebase_uid ~ '^[A-Za-z0-9]{1,128}$');

-- Looks up a user by e-mail for linking existing accounts the first time they
-- sign in through Firebase (only after Firebase verified that e-mail).
create function public.find_auth_user_by_email(p_email text)
returns table (user_id uuid, firebase_uid text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, p.firebase_uid
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(u.email) = lower(p_email)
  limit 1;
$$;

revoke all on function public.find_auth_user_by_email(text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.find_auth_user_by_email(text) to service_role';
  end if;
end;
$$;
