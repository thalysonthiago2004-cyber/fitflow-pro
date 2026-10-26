-- Copies a meal plan (meals and items) into a new draft for a student of the
-- same workspace. Runs with the caller's rights: RLS decides what can be read
-- and written, and the composite keys keep the copy inside the workspace.
create function public.duplicate_meal_plan(p_plan uuid, p_student uuid, p_name text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  source public.meal_plans;
  new_plan uuid;
  meal_row public.meals;
  new_meal uuid;
begin
  select * into source from public.meal_plans where id = p_plan;
  if source.id is null or not private.is_workspace_staff(source.workspace_id) then
    raise exception 'plan_not_found' using errcode = 'P0001';
  end if;

  insert into public.meal_plans (workspace_id, student_id, name, notes, status, created_by)
  values (source.workspace_id, p_student, left(coalesce(nullif(btrim(p_name), ''), source.name), 120), source.notes, 'draft', (select auth.uid()))
  returning id into new_plan;

  for meal_row in select * from public.meals where plan_id = p_plan order by position, created_at loop
    insert into public.meals (workspace_id, plan_id, name, time_of_day, position, notes)
    values (source.workspace_id, new_plan, meal_row.name, meal_row.time_of_day, meal_row.position, meal_row.notes)
    returning id into new_meal;

    insert into public.meal_items (workspace_id, meal_id, food_id, quantity, unit, position, notes)
    select source.workspace_id, new_meal, mi.food_id, mi.quantity, mi.unit, mi.position, mi.notes
    from public.meal_items mi
    where mi.meal_id = meal_row.id
    order by mi.position, mi.created_at;
  end loop;

  return new_plan;
end;
$$;

revoke all on function public.duplicate_meal_plan(uuid, uuid, text) from public, anon;
grant execute on function public.duplicate_meal_plan(uuid, uuid, text) to authenticated;
