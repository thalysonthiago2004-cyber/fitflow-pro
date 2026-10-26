-- Optional WhatsApp number on the profile (trainers), stored as Brazilian
-- E.164 digits without "+": 55 + area code + number. Visibility follows
-- profiles: the user, their workspace staff and, for trainers, their students.
alter table public.profiles add column whatsapp text check (whatsapp ~ '^55[1-9][0-9]9?[0-9]{8}$');
grant update (whatsapp) on public.profiles to authenticated;
