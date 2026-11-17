import { applyD1Migrations, env } from "cloudflare:test";
import { beforeEach } from "vitest";

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
      DEV_AUTH_BYPASS?: string;
    }
  }
}

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

beforeEach(async () => {
  await env.DB.batch([env.DB.prepare("DELETE FROM dishes"), env.DB.prepare("DELETE FROM sections")]);
});
