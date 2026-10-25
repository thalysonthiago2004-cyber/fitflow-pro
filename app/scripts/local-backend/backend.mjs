// Local stand-in for a Supabase project, for development and manual testing
// only: real Postgres (embedded) + real PostgREST + a minimal GoTrue emulator.
//
//   npm run local:backend          start (keeps data between runs)
//   npm run local:backend -- --reset   wipe all local data first
//
// It is NOT a security boundary: passwords are hashed with plain SHA-256,
// e-mails are auto-confirmed and no e-mail is ever sent. Never expose it.
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { createServer } from "node:http";
import { arch, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { SignJWT, jwtVerify } from "jose";

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const HOME = join(APP_DIR, ".local-backend");
const DATA = join(HOME, "pgdata");
const BIN = join(HOME, "bin");
const MIGRATIONS = join(APP_DIR, "supabase", "migrations");

export const PORTS = { api: 54321, postgres: 54329, postgrest: 54330 };
const POSTGREST_VERSION = "v16.5";
const JWT_SECRET = "local-only-jwt-secret-with-at-least-32-characters";
const key = new TextEncoder().encode(JWT_SECRET);

if (process.argv.includes("--reset")) rmSync(DATA, { recursive: true, force: true });
mkdirSync(HOME, { recursive: true });

// --- Postgres ---------------------------------------------------------------

const fresh = !existsSync(join(DATA, "PG_VERSION"));
const db = new EmbeddedPostgres({ databaseDir: DATA, user: "postgres", password: "postgres", port: PORTS.postgres, persistent: true });
if (fresh) await db.initialise();
await db.start();
if (fresh) await db.createDatabase("app");
const client = db.getPgClient("app");
await client.connect();

if (fresh) {
  // Minimal stand-in for the parts of Supabase's auth schema the migrations use.
  await client.query(`
    create role anon nologin noinherit;
    create role authenticated nologin noinherit;
    create role authenticator login password 'authpass' noinherit;
    grant anon, authenticated to authenticator;
    grant usage on schema public to anon, authenticated;
    create schema auth;
    grant usage on schema auth to anon, authenticated;
    create table auth.users (
      id uuid primary key,
      email text unique,
      encrypted_password text,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create function auth.uid() returns uuid language sql stable as $$
      select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
      )::uuid
    $$;
    grant execute on function auth.uid() to anon, authenticated;
    create schema local_meta;
    create table local_meta.migrations (name text primary key, applied_at timestamptz not null default now());
  `);
}

// Storage stand-in: enough for the migrations' buckets and policies. There is
// no storage API locally, so uploads only work against a Supabase project.
await client.query(`
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
`);

const { rows: applied } = await client.query("select name from local_meta.migrations");
const done = new Set(applied.map((r) => r.name));
for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(file)) continue;
  await client.query("begin");
  try {
    await client.query(readFileSync(join(MIGRATIONS, file), "utf8"));
    await client.query("insert into local_meta.migrations (name) values ($1)", [file]);
    await client.query("commit");
    console.log("applied", file);
  } catch (error) {
    await client.query("rollback");
    console.error(`migration ${file} failed:`, error.message);
    process.exit(1);
  }
}
// Let PostgREST pick up schema changes.
await client.query("notify pgrst, 'reload schema'");

// --- PostgREST --------------------------------------------------------------

function postgrestAsset() {
  const os = platform();
  const cpu = arch() === "arm64" ? "aarch64" : "x86-64";
  if (os === "darwin") return `postgrest-${POSTGREST_VERSION}-macos-${cpu}.tar.xz`;
  if (os === "linux") return `postgrest-${POSTGREST_VERSION}-linux-static-${cpu}.tar.xz`;
  throw new Error(`Unsupported platform for the local backend: ${os}`);
}

const postgrestBin = join(BIN, "postgrest");
if (!existsSync(postgrestBin)) {
  mkdirSync(BIN, { recursive: true });
  const asset = postgrestAsset();
  console.log("downloading", asset);
  const response = await fetch(`https://github.com/PostgREST/postgrest/releases/download/${POSTGREST_VERSION}/${asset}`);
  if (!response.ok) throw new Error(`PostgREST download failed: ${response.status}`);
  const archive = join(BIN, asset);
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  await new Promise((resolve, reject) =>
    spawn("tar", ["-xf", archive, "-C", BIN], { stdio: "inherit" }).on("exit", (code) => (code === 0 ? resolve() : reject(new Error("tar failed")))),
  );
  chmodSync(postgrestBin, 0o755);
  rmSync(archive);
}

// The macOS build links libpq dynamically; the embedded Postgres package ships it.
const libpqDir = join(APP_DIR, "node_modules", "@embedded-postgres", `${platform()}-${arch()}`, "native", "lib");
const postgrest = spawn(postgrestBin, [], {
  env: {
    ...process.env,
    DYLD_LIBRARY_PATH: libpqDir,
    LD_LIBRARY_PATH: libpqDir,
    PGRST_DB_URI: `postgres://authenticator:authpass@localhost:${PORTS.postgres}/app`,
    PGRST_DB_SCHEMAS: "public",
    PGRST_DB_ANON_ROLE: "anon",
    PGRST_JWT_SECRET: JWT_SECRET,
    PGRST_SERVER_PORT: String(PORTS.postgrest),
    PGRST_LOG_LEVEL: "error",
  },
  stdio: "inherit",
});

// --- GoTrue emulator (only the endpoints the app uses) ----------------------

const hash = (password) => createHash("sha256").update(password).digest("hex");

function userJson(row) {
  return {
    id: row.id,
    aud: "authenticated",
    role: "authenticated",
    email: row.email,
    email_confirmed_at: row.created_at,
    user_metadata: row.raw_user_meta_data,
    app_metadata: { provider: "email", providers: ["email"] },
    identities: [{ id: row.id, user_id: row.id, provider: "email", identity_data: { email: row.email, sub: row.id } }],
    created_at: row.created_at,
  };
}

async function session(row) {
  const now = Math.floor(Date.now() / 1000);
  const access_token = await new SignJWT({ email: row.email, role: "authenticated", aud: "authenticated", session_id: randomUUID() })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(row.id)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  return { access_token, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: `rt-${row.id}-${randomUUID()}`, user: userJson(row) };
}

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const fail = (res, status, error_code, msg) => json(res, status, { code: status, error_code, msg });

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function userFromAuth(req) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /i, "");
  try {
    const { payload } = await jwtVerify(token, key);
    const { rows } = await client.query("select * from auth.users where id = $1", [payload.sub]);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function auth(req, res, path, url) {
  const body = req.method === "GET" ? {} : JSON.parse((await readBody(req)).toString() || "{}");
  if (path === "/signup" && req.method === "POST") {
    const email = String(body.email ?? "").toLowerCase();
    if ((await client.query("select 1 from auth.users where email = $1", [email])).rowCount) {
      return fail(res, 422, "user_already_exists", "User already registered");
    }
    try {
      const { rows } = await client.query(
        "insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values ($1, $2, $3, $4) returning *",
        [randomUUID(), email, hash(body.password ?? ""), body.data ?? {}],
      );
      return json(res, 200, await session(rows[0]));
    } catch (error) {
      console.error("signup rejected by the database:", error.message);
      return fail(res, 500, "unexpected_failure", "Database error saving new user");
    }
  }
  if (path === "/token" && req.method === "POST") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      const { rows } = await client.query("select * from auth.users where email = $1 and encrypted_password = $2", [
        String(body.email ?? "").toLowerCase(),
        hash(body.password ?? ""),
      ]);
      if (!rows[0]) return fail(res, 400, "invalid_credentials", "Invalid login credentials");
      return json(res, 200, await session(rows[0]));
    }
    if (grant === "refresh_token") {
      const id = String(body.refresh_token ?? "").slice(3, 39);
      const { rows } = await client.query("select * from auth.users where id::text = $1", [id]);
      if (!rows[0]) return fail(res, 400, "refresh_token_not_found", "Invalid Refresh Token");
      return json(res, 200, await session(rows[0]));
    }
  }
  if (path === "/user") {
    const user = await userFromAuth(req);
    if (!user) return fail(res, 403, "bad_jwt", "invalid JWT");
    if (req.method === "PUT" && body.password) {
      await client.query("update auth.users set encrypted_password = $2 where id = $1", [user.id, hash(body.password)]);
    }
    return json(res, 200, userJson(user));
  }
  if (path === "/logout") return json(res, 204);
  // No e-mail is sent locally; recovery links must be tested on a real project.
  if (path === "/recover") return json(res, 200, {});
  if (path === "/.well-known/jwks.json") return json(res, 200, { keys: [] });
  return fail(res, 404, "not_found", `No local emulation for ${req.method} ${path}`);
}

async function rest(req, res, path, url) {
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : await readBody(req);
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (["host", "connection", "content-length", "accept-encoding"].includes(k)) continue;
    headers[k] = Array.isArray(v) ? v.join(",") : v;
  }
  // The publishable key is not a JWT: such calls are anonymous.
  if (!/^Bearer ey/.test(headers.authorization ?? "")) delete headers.authorization;
  const upstream = await fetch(`http://localhost:${PORTS.postgrest}${path}${url.search}`, { method: req.method, headers, body });
  const out = {};
  upstream.headers.forEach((v, k) => {
    if (!["content-encoding", "transfer-encoding", "connection"].includes(k)) out[k] = v;
  });
  res.writeHead(upstream.status, out);
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/auth/v1")) return await auth(req, res, url.pathname.slice(8), url);
    if (url.pathname.startsWith("/rest/v1")) return await rest(req, res, url.pathname.slice(8), url);
    json(res, 404, { message: "not found" });
  } catch (error) {
    console.error(error);
    json(res, 500, { message: "local backend error" });
  }
});
// Bound to localhost only: the Next.js server is the only client.
server.listen(PORTS.api, "127.0.0.1", () => console.log(`Local backend ready on http://localhost:${PORTS.api}`));

const stop = async () => {
  server.close();
  postgrest.kill();
  await client.end().catch(() => {});
  await db.stop();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
