-- Activity notifications: trainers can switch off pushes about their
-- students' activity (finished workouts, comments, questionnaires).
alter table public.notification_preferences add column activity_alerts boolean not null default true;
grant insert (activity_alerts) on public.notification_preferences to authenticated;
grant update (activity_alerts) on public.notification_preferences to authenticated;
