-- Closed-beta sign-up gate, LGPD consents, account deletion and student
-- self-service for body data.
--
-- - While a beta code is configured (private.settings 'beta_code_sha256'),
--   trainer sign-ups must carry it in their metadata. Students still need a
--   valid invitation. The check lives in the sign-up trigger, so calling the
--   Auth API directly cannot skip it.
-- - Accepted documents (terms, privacy, health data) are recorded per
--   version from the sign-up metadata.
-- - delete_my_account() removes the caller's auth user; everything they own
--   cascades. A trainer's workspace goes with them; their students keep
--   their accounts without a trainer.

-- ---------------------------------------------------------------------------
-- Settings (not exposed through the API)
-- ---------------------------------------------------------------------------

create table private.settings (
  key text primary key,
  value text not null
);

revoke all on private.settings from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Consents
-- ---------------------------------------------------------------------------

create table public.consents (
  user_id uuid not null references public.profiles (id) on delete cascade,
  document text not null check (document in ('terms', 'privacy', 'health_data')),
  version text not null check (version ~ '^\d{4}-\d{2}-\d{2}$'),
  accepted_at timestamptz not null default now(),
  primary key (user_id, document, version)
);

alter table public.consents enable row level security;
revoke all on public.consents from anon, authenticated;
grant select on public.consents to authenticated;
grant insert (user_id, document, version) on public.consents to authenticated;

create policy "consents: users read their own"
  on public.consents for select to authenticated
  using (user_id = (select auth.uid()));

-- New versions of a document are accepted again from inside the app.
create policy "consents: users record their own"
  on public.consents for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Sign-up
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
  beta_code text := btrim(coalesce(new.raw_user_meta_data ->> 'beta_code', ''));
  consent_version text := new.raw_user_meta_data ->> 'consent_version';
  required_hash text;
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
  else
    select s.value into required_hash from private.settings s where s.key = 'beta_code_sha256';
    if required_hash is not null and private.hash_token(upper(beta_code)) <> required_hash then
      raise exception 'beta_code_invalid' using errcode = 'P0001';
    end if;

    insert into public.profiles (id, full_name, role)
    values (new.id, display_name, 'trainer');

    insert into public.workspaces (name, owner_id)
    values (left('Equipe de ' || display_name, 80), new.id)
    returning id into new_workspace_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (new_workspace_id, new.id, 'owner');
  end if;

  if consent_version ~ '^\d{4}-\d{2}-\d{2}$' then
    insert into public.consents (user_id, document, version)
    select new.id, d, consent_version
    from unnest(case when invite_token is null then array['terms', 'privacy'] else array['terms', 'privacy', 'health_data'] end) as d;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Account deletion
-- ---------------------------------------------------------------------------

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- A workspace owner closing their account may remove their students'
-- progress photos (the rows go with the workspace anyway).
create policy "progress-photos: the workspace owner deletes on closing"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'progress-photos'
    and exists (
      select 1 from public.workspaces w
      where w.id = (private.progress_photo_folder(name)).workspace_id
        and w.owner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Students edit their own body data
-- ---------------------------------------------------------------------------

create function public.update_my_body_profile(p_sex public.sex, p_height_cm numeric, p_birth_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_height_cm is not null and (p_height_cm < 50 or p_height_cm > 260) then
    raise exception 'height_out_of_range' using errcode = 'P0001';
  end if;
  if p_birth_date is not null and (p_birth_date < date '1900-01-01' or p_birth_date > (now() at time zone 'America/Sao_Paulo')::date) then
    raise exception 'birth_date_out_of_range' using errcode = 'P0001';
  end if;
  update public.students
  set sex = p_sex, height_cm = round(p_height_cm, 1), birth_date = p_birth_date
  where user_id = (select auth.uid());
end;
$$;

revoke all on function public.update_my_body_profile(public.sex, numeric, date) from public, anon;
grant execute on function public.update_my_body_profile(public.sex, numeric, date) to authenticated;
