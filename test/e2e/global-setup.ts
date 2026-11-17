import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import type { TestProject } from "vitest/node";

const root = path.resolve(import.meta.dirname, "../..");
const PORT = Number(process.env.E2E_PORT ?? 5317);
const PERSIST_DIR = ".wrangler/e2e-state";

declare module "vitest" {
  export interface ProvidedContext {
    baseUrl: string;
  }
}

async function waitForServer(url: string, server: ChildProcess, timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Dev server exited with code ${server.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Dev server did not respond at ${url} within ${timeoutMs} ms`);
}

/**
 * Starts the app (Vite + Worker in workerd) against a fresh local D1 database
 * with the migrations applied. Auth is bypassed: Cloudflare Access only exists
 * in front of the deployed Worker.
 */
export default async function setup(project: TestProject) {
  rmSync(path.join(root, PERSIST_DIR), { recursive: true, force: true });
  execFileSync("npx", ["wrangler", "d1", "migrations", "apply", "donburi-db", "--local", "--persist-to", PERSIST_DIR], {
    cwd: root,
    stdio: "pipe",
    env: { ...process.env, CI: "true" },
  });

  const server = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    env: {
      ...process.env,
      E2E_PERSIST_DIR: PERSIST_DIR,
      CLOUDFLARE_INCLUDE_PROCESS_ENV: "true",
      DEV_AUTH_BYPASS: "true",
    },
  });
  let output = "";
  server.stdout?.on("data", (chunk) => (output += chunk));
  server.stderr?.on("data", (chunk) => (output += chunk));

  const baseUrl = `http://localhost:${PORT}`;
  try {
    await waitForServer(`${baseUrl}/api/menu`, server);
  } catch (error) {
    stop(server);
    throw new Error(`${(error as Error).message}\n${output}`);
  }
  project.provide("baseUrl", baseUrl);

  return () => stop(server);
}

function stop(server: ChildProcess) {
  if (server.pid && server.exitCode === null) {
    try {
      process.kill(-server.pid, "SIGTERM"); // whole process group (npx → vite → workerd)
    } catch {
      server.kill("SIGTERM");
    }
  }
}
