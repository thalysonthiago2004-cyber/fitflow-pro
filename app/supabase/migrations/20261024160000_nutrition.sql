-- Phase 5: foods, meal plans, meals and meal items.
--
-- - Foods are owned by a workspace. Nutrient values are entered by staff per
--   100 g (or 100 ml) together with a mandatory source, so every estimate can
--   be traced. No nutrition values are shipped with the app.
-- - Meal plans follow the workout plan model: one student per plan, drafts are
--   private to staff, composite FKs keep every row inside its workspace.
-- - Totals are calculated by the application and presented as estimates.

create type public.food_basis as enum ('g', 'ml');
create type public.meal_item_unit as enum ('g', 'ml', 'unit');

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  basis public.food_basis not null default 'g',
  kcal_per_100 numeric(6, 1) not null check (kcal_per_100 between 0 and 900),
  protein_g_per_100 numeric(5, 1) not null check (protein_g_per_100 between 0 and 100),
  carbs_g_per_100 numeric(5, 1) not null check (carbs_g_per_100 between 0 and 100),
  fat_g_per_100 numeric(5, 1) not null check (fat_g_per_100 between 0 and 100),
  fiber_g_per_100 numeric(5, 1) check (fiber_g_per_100 between 0 and 100),
  unit_label text check (char_length(btrim(unit_label)) between 1 and 40),
  unit_amount numeric(7, 1) check (unit_amount > 0 and unit_amount <= 5000),
  source text not null check (char_length(btrim(source)) between 2 and 200),
  archived boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  -- A household measure needs both its label and its weight/volume.
  check ((unit_label is null) = (unit_amount is null)),
  check (protein_g_per_100 + carbs_g_per_100 + fat_g_per_100 <= 100)
);

create index foods_workspace_idx on public.foods (workspace_id, name);
create unique index foods_unique_name_per_workspace
  on public.foods (workspace_id, lower(name))
  where not archived;

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  student_id uuid not null,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  notes text check (char_length(notes) <= 2000),
  status public.plan_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (workspace_id, student_id)
    references public.students (workspace_id, user_id) on delete cascade
);

create index meal_plans_student_idx on public.meal_plans (student_id, status);
create index meal_plans_workspace_idx on public.meal_plans (workspace_id, updated_at desc);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  plan_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  time_of_day time,
  position integer not null default 0,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (plan_id, workspace_id)
    references public.meal_plans (id, workspace_id) on delete cascade
);

create index meals_plan_idx on public.meals (plan_id, position);

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  meal_id uuid not null,
  food_id uuid not null,
  quantity numeric(7, 2) not null check (quantity > 0 and quantity <= 5000),
  unit public.meal_item_unit not null,
  position integer not null default 0,
  notes text check (char_length(notes) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (meal_id, workspace_id)
    references public.meals (id, workspace_id) on delete cascade,
  foreign key (food_id, workspace_id)
    references public.foods (id, workspace_id) on delete restrict
);

create index meal_items_meal_idx on public.meal_items (meal_id, position);
create index meal_items_food_idx on public.meal_items (food_id);

create trigger foods_set_updated_at before update on public.foods
  for each row execute function private.set_updated_at();
create trigger meal_plans_set_updated_at before update on public.meal_plans
  for each row execute function private.set_updated_at();
create trigger meals_set_updated_at before update on public.meals
  for each row execute function private.set_updated_at();
create trigger meal_items_set_updated_at before update on public.meal_items
  for each row execute function private.set_updated_at();

-- A meal item's unit must make sense for the food: grams for solids, ml for
-- liquids, and "unit" only when the food has a household measure.
create function private.check_meal_item_unit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  food public.foods%rowtype;
begin
  select * into food from public.foods where id = new.food_id;
  if new.unit = 'unit' and food.unit_amount is null then
    raise exception 'unit_not_available' using errcode = 'P0001';
  end if;
  if new.unit in ('g', 'ml') and new.unit::text <> food.basis::text then
    raise exception 'unit_mismatch' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger meal_items_check_unit before insert or update on public.meal_items
  for each row execute function private.check_meal_item_unit();

-- Helpers -------------------------------------------------------------------

create function private.can_view_meal_plan(target_plan uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.meal_plans p
    where p.id = target_plan
      and (
        private.is_workspace_staff(p.workspace_id)
        or (p.student_id = (select auth.uid()) and p.status in ('active', 'archived'))
      )
  );
$$;

create function private.can_view_meal(target_meal uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.meals m
    where m.id = target_meal and private.can_view_meal_plan(m.plan_id)
  );
$$;

-- A student may read a food when it appears in one of their published plans.
create function private.food_in_visible_plan(target_food uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.meal_items i
    join public.meals m on m.id = i.meal_id
    join public.meal_plans p on p.id = m.plan_id
    where i.food_id = target_food
      and p.student_id = (select auth.uid())
      and p.status in ('active', 'archived')
  );
$$;

revoke all on function private.can_view_meal_plan(uuid) from public;
revoke all on function private.can_view_meal(uuid) from public;
revoke all on function private.food_in_visible_plan(uuid) from public;
grant execute on function private.can_view_meal_plan(uuid) to authenticated;
grant execute on function private.can_view_meal(uuid) to authenticated;
grant execute on function private.food_in_visible_plan(uuid) to authenticated;

-- RLS -------------------------------------------------------------------------

alter table public.foods enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;

revoke all on public.foods, public.meal_plans, public.meals, public.meal_items from anon, authenticated;
grant select on public.foods, public.meal_plans, public.meals, public.meal_items to authenticated;

grant insert (workspace_id, name, basis, kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100,
  fiber_g_per_100, unit_label, unit_amount, source, created_by) on public.foods to authenticated;
grant update (name, kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100, fiber_g_per_100,
  unit_label, unit_amount, source, archived) on public.foods to authenticated;

grant insert (workspace_id, student_id, name, notes, status, created_by) on public.meal_plans to authenticated;
grant update (name, notes, status) on public.meal_plans to authenticated;
grant delete on public.meal_plans to authenticated;

grant insert (workspace_id, plan_id, name, time_of_day, position, notes) on public.meals to authenticated;
grant update (name, time_of_day, position, notes) on public.meals to authenticated;
grant delete on public.meals to authenticated;

grant insert (workspace_id, meal_id, food_id, quantity, unit, position, notes) on public.meal_items to authenticated;
grant update (quantity, unit, position, notes) on public.meal_items to authenticated;
grant delete on public.meal_items to authenticated;

create policy "foods: staff read; students read foods in their plans"
  on public.foods for select to authenticated
  using ((select private.is_workspace_staff(workspace_id)) or (select private.food_in_visible_plan(id)));

create policy "foods: staff insert"
  on public.foods for insert to authenticated
  with check ((select private.is_workspace_staff(workspace_id)) and created_by = (select auth.uid()));

create policy "foods: staff update"
  on public.foods for update to authenticated
  using ((select private.is_workspace_staff(workspace_id)))
  with check ((select private.is_workspace_staff(workspace_id)));

create policy "meal_plans: staff and assigned student read"
  on public.meal_plans for select to authenticated
  using (
    (select private.is_workspace_staff(workspace_id))
    or (student_id = (select auth.uid()) and status in ('active', 'archived'))
  );

create policy "meal_plans: staff insert"
  on public.meal_plans for insert to authenticated
  with check ((select private.is_workspace_staff(workspace_id)) and created_by = (select auth.uid()));

create policy "meal_plans: staff update"
  on public.meal_plans for update to authenticated
  using ((select private.is_workspace_staff(workspace_id)))
  with check ((select private.is_workspace_staff(workspace_id)));

create policy "meal_plans: staff delete"
  on public.meal_plans for delete to authenticated
  using ((select private.is_workspace_staff(workspace_id)));

create policy "meals: visible with the plan"
  on public.meals for select to authenticated
  using ((select private.can_view_meal_plan(plan_id)));

create policy "meals: staff write"
  on public.meals for all to authenticated
  using ((select private.is_workspace_staff(workspace_id)))
  with check ((select private.is_workspace_staff(workspace_id)));

create policy "meal_items: visible with the meal"
  on public.meal_items for select to authenticated
  using ((select private.can_view_meal(meal_id)));

create policy "meal_items: staff write"
  on public.meal_items for all to authenticated
  using ((select private.is_workspace_staff(workspace_id)))
  with check ((select private.is_workspace_staff(workspace_id)));
