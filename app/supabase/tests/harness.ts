import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

// In-process Postgres with the real migrations and a minimal stand-in for the
// Supabase auth and storage schemas and API roles. Verifies policies, grants and functions;
// it does not replace testing against a Supabase project.

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

export const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated;

  create schema if not exists storage;
  grant usage on schema storage to anon, authenticated;
  create table if not exists storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table if not exists storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null,
    owner uuid,
    unique (bucket_id, name)
  );
  alter table storage.objects enable row level security;
  grant select, insert, update, delete on storage.objects to authenticated;
`;

export type TestDb = {
  db: PGlite;
  asUser<T>(userId: string | null, fn: () => Promise<T>): Promise<T>;
  createAuthUser(id: string, email: string, metadata?: Record<string, unknown>): Promise<void>;
  workspaceOf(ownerId: string): Promise<string>;
  close(): Promise<void>;
};

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }

  return {
    db,
    async asUser(userId, fn) {
      await db.exec(userId ? "set role authenticated" : "set role anon");
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
      try {
        return await fn();
      } finally {
        await db.exec("reset role");
        await db.query("select set_config('request.jwt.claim.sub', '', false)");
      }
    },
    async createAuthUser(id, email, metadata = {}) {
      await db.query(
        "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)",
        [id, email, JSON.stringify(metadata)],
      );
    },
    async workspaceOf(ownerId) {
      const { rows } = await db.query<{ id: string }>(
        "select id from public.workspaces where owner_id = $1",
        [ownerId],
      );
      return rows[0].id;
    },
    close: () => db.close(),
  };
}

export const uid = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
