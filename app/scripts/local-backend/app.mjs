// Builds and serves the app against the local backend, reachable from other
// devices on the same network (e.g. a phone on the same Wi-Fi).
//
//   npm run local:app            (with `npm run local:backend` running)
import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";

const PORT = 3000;
const lanIp =
  Object.values(networkInterfaces())
    .flat()
    .find((i) => i && i.family === "IPv4" && !i.internal)?.address ?? "localhost";

// NEXT_PUBLIC_* values are inlined at build time, so build with them set.
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-publishable-key",
  NEXT_PUBLIC_SITE_URL: `http://${lanIp}:${PORT}`,
};

const run = (args) =>
  new Promise((resolve, reject) =>
    spawn("npx", args, { env, stdio: "inherit" }).on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${args.join(" ")} failed`)))),
  );

await run(["next", "build"]);
console.log(`\nFitFlow Pro (local):\n  neste computador: http://localhost:${PORT}\n  na mesma rede:    http://${lanIp}:${PORT}\n`);
await run(["next", "start", "-H", "0.0.0.0", "-p", String(PORT)]);
