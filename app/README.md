# FitFlow Pro — app

SaaS for personal trainers and their students. Product, engineering and design rules live in [CLAUDE.md](CLAUDE.md).

Stack: Next.js 16 (App Router, Cache Components, Partial Prefetching), React 19, TypeScript (strict), Tailwind CSS 4, shadcn/ui (Base UI), Supabase (Postgres, Auth, RLS), Zod, Recharts, Vitest, Playwright.

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Auth (sign-up, login, logout, recovery), profiles, roles, trainer workspaces, protected routes | Done |
| 2 | Student invitations (shareable link), enrollment, student profiles, archive/remove | Done |
| 3 | Exercise library (global catalog + own), workout plans, sessions, prescriptions, student logging with rest timer | Done |
| 4 | Hydration goals (set by staff), water logging, 7-day history, in-app reminders | Done |
| 5 | Foods with mandatory source, meal plans, meals and items, nutrient estimates | Done |
| 6 | Body measurements, weight chart, weekly workouts, personal records, workout calorie estimate | Done |
| 6+ | Trainer photo (shown to students), quick body assessment (tape-measure estimates + bioimpedance-scale entry), private before/after photos | Done |
| 6+ | Cardio blocks (continuous/intervals) in workouts; supersets (bi-set, tri-set, circuit); per-set repetitions; uploaded exercise videos and per-workspace customization of catalog exercises | Done |
| 6++ | LGPD (terms, privacy, consents, export, account deletion), closed-beta gate, plan templates and duplication, trainer attention list, PAR-Q anamnesis, load progression and history, printable report, interval timer, per-activity cardio MET, workout comments, TACO import, PWA and Web Push reminders, CSP, Sentry, CI | Done |
| 7 | Billing, production hardening | Baseline security headers only — billing needs a provider decision |

All phases were verified against a local Postgres + PostgREST stack and, on 2026-10-25, against the beta Supabase project (`fitflow-pro`, São Paulo): migrations applied, generated types in use, and the full trainer/student E2E journeys passing (see [Testing](#testing)).

**Beta:** the app is currently a free closed beta. Billing (phase 7) is postponed; no feature is gated.

### Known limitations

- **E-mail delivery:** invitations are shared as links (copy or WhatsApp). The project uses Supabase's built-in mailer, which only delivers to members of the Supabase organization and is heavily rate-limited. During the beta, e-mail confirmation is therefore **off** and password recovery only reaches org members. Before opening sign-ups, configure custom SMTP (`[auth.email.smtp]` in `supabase/config.toml`), turn `enable_confirmations` on and enable the branded templates in `supabase/templates/`.
- **Reminders** (water, workout of the day) are sent as Web Push every 15 minutes by a Supabase `pg_cron` job that calls `/api/cron/reminders`; inside the open app they also show as toasts. On iPhone, push requires the app installed on the home screen (iOS 16.4+).
- **Foods** start empty on purpose: nutrient values are entered by staff with a source. Importing an official table (e.g. TACO) is a future task.
- **Body assessment** values (body fat by the U.S. Navy circumference method, BMR by Mifflin–St Jeor) are calculated on the fly and labeled as estimates; they are never stored. Readings typed from a bioimpedance scale are stored as entered, tagged `source = 'bioimpedance'`.
- **Photos** are resized and re-encoded to JPEG in the browser (which also strips EXIF/GPS) before upload. Avatars are public (`avatars` bucket); progress photos are private (`progress-photos` bucket, signed URLs valid for 1 h). The local test backend has no storage API, so uploads only work against a Supabase project.
- **Exercise videos** are uploaded from the browser straight to the private `exercise-videos` bucket through a one-time signed URL (max 50 MB, MP4/MOV/WebM) and played through 1-hour signed URLs. Catalog exercises are never edited; a workspace customization replaces their instructions and video for that workspace only.
- **Calorie estimates** for workouts use one MET value (3.5, resistance training) and require a recorded weight.
- **Content-Security-Policy** is not set yet (needs nonces for Next's inline scripts).
- **Monitoring** (e.g. error tracking) is not configured.

## Security model

- Every table has RLS. Policies are in `supabase/migrations` and covered by boundary tests in `supabase/tests`.
- Roles come from the database (`profiles`, `workspace_members`), never from the client. Sign-up always creates a trainer; students are created only through a valid invitation token.
- Composite foreign keys keep every child row inside its workspace (a plan cannot point at another trainer's student, exercise or food).
- Students' activity (workout logs, water intake) can only be written by the student. Trainers read it but cannot create or edit it.
- The proxy (`src/proxy.ts`) redirects guests from every non-public route; pages and server actions re-check the session (`src/lib/auth/dal.ts`).
- Invitation tokens are stored only as SHA-256 hashes.

## Setup

1. Install dependencies: `npm install`
2. Create a Supabase project and copy the environment file: `cp .env.example .env.local`. Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API) and `NEXT_PUBLIC_SITE_URL`. Never put the service-role key in a `NEXT_PUBLIC_` variable — the app does not need it.
3. Apply the migrations, in order:

   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

4. Auth settings (site URL, redirect URLs, password length, confirmations) are versioned in `supabase/config.toml`. Review the diff, then push: `npx supabase config push`. Free-tier projects can only change e-mail templates once custom SMTP is configured.
5. Regenerate the database types after every migration: `npx supabase gen types typescript --linked --schema public > src/lib/supabase/database.generated.ts`. `database.types.ts` re-exports them with short enum aliases.
6. Run: `npm run dev`

## Local test environment (no Supabase account needed)

For trying the app on this machine (and on phones on the same Wi-Fi), `scripts/local-backend` runs a stand-in for Supabase: embedded Postgres with the real migrations, PostgREST and a minimal auth emulator. Data lives in `.local-backend/` (git-ignored) and survives restarts.

```bash
npm run local:backend            # terminal 1 — add `-- --reset` to wipe local data
npm run local:seed               # once — creates the demo accounts below
npm run local:app                # terminal 2 — builds and serves on port 3000
```

| Account | E-mail | Password |
|---|---|---|
| Trainer | `personal@fitflow.local` | `Demo2026` |
| Student | `aluno@fitflow.local` | `Demo2026` |

The seed creates a published workout plan, a meal plan (foods marked as example values) and a hydration goal. It creates no student activity. Locally, e-mails are auto-confirmed and never sent, so password recovery cannot be tested here. **Not a security boundary**: never expose it to the internet.

## Deployment

Production runs on **Vercel in São Paulo** (`vercel.json` pins the `gru1` region, next to the Supabase project in `sa-east-1`): https://fitflow-pro-xi.vercel.app. `.vercelignore` keeps `.env*` and local state out of uploads. The earlier Netlify site (`netlify.toml`) is no longer updated.

Environment variables (Vercel → Settings → Environment Variables; see `.env.example`):

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` | Required. Add `<site-url>/auth/confirm` to Supabase redirect URLs (`supabase/config.toml`). |
| `BETA_SIGNUP_REQUIRED` | `1` while the beta is closed. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web Push. |
| `CRON_SECRET`, `SUPABASE_SECRET_KEY` | Reminder endpoint only. Sensitive. |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional error monitoring; collection of cookies, headers, bodies and user data is disabled (`src/lib/sentry-options.ts`). |

**Closed beta.** Trainer sign-ups need a code while `private.settings` holds its hash; the sign-up trigger enforces it, so the Auth API cannot be used to skip it. Rotate or remove it with `npx supabase db query --linked`:

```sql
insert into private.settings (key, value) values ('beta_code_sha256', private.hash_token(upper('NEW-CODE')))
  on conflict (key) do update set value = excluded.value;   -- or: delete from private.settings where key = 'beta_code_sha256';
```

**Reminders.** A `pg_cron` job (`fitflow-reminders`, every 15 min) posts to `/api/cron/reminders` via `pg_net`, reading the URL and bearer secret from Vault (`reminders_url`, `reminders_secret`). The database decides what is due and records each delivery once (`claim_due_reminders`); the endpoint sends the pushes and removes dead subscriptions. Set the Vault secrets once per environment:

```sql
select vault.create_secret('https://<site>/api/cron/reminders', 'reminders_url');
select vault.create_secret('<CRON_SECRET>', 'reminders_secret');
```

**Data import.** `src/lib/nutrition/taco.json` is generated from the official TACO 4ª ed. spreadsheet by `scripts/taco/build_taco.py` (see the script for the conversion rules).

## Testing

| Command | What it runs |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | Route type generation + TypeScript |
| `npm test` | Unit tests and RLS boundary tests (PGlite runs the real migrations in-process) |
| `npm run test:e2e` | Playwright against a production build: public pages, guest redirects, validation, theme (mobile + desktop) |
| `E2E_SUPABASE=1 E2E_SUPABASE_URL=… E2E_SUPABASE_KEY=… npm run test:e2e -- e2e/flows.spec.ts --project=desktop` | Full trainer/student journeys. Needs a **test** Supabase project with e-mail confirmation disabled (`fitflow-pro-test`); the config refuses the production project |

The PGlite tests verify policies and grants but do not replace testing against a Supabase project.

## Structure

```
src/
  app/
    (auth)/        login, signup, password recovery, invite acceptance + actions
    (app)/         authenticated area: dashboard, students, workouts, exercises,
                   nutrition, foods, training, meals, hydration, progress, settings
    auth/confirm/  e-mail link handler (PKCE code or token_hash)
  components/      brand, theme, forms, feature components; ui/ = shadcn
  lib/
    auth/          DAL, schemas, errors, redirect guard
    students/ workouts/ hydration/ nutrition/ progress/
                   per-feature schemas, queries and pure calculations
    supabase/      server/proxy clients and database types
supabase/
  config.toml      auth settings pushed with `supabase config push`
  migrations/      versioned SQL (schema, RLS, triggers, functions)
  templates/       branded auth e-mails (enabled once SMTP is set)
  tests/           RLS boundary tests
e2e/               Playwright specs
```
