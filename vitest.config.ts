import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        // Worker API + D1, running inside the Workers runtime (workerd).
        plugins: [
          cloudflareTest(async () => ({
            wrangler: { configPath: "./wrangler.jsonc" },
            miniflare: {
              bindings: {
                TEST_MIGRATIONS: await readD1Migrations("./migrations"),
                DEV_AUTH_BYPASS: "true",
              },
            },
          })),
        ],
        test: {
          name: "worker",
          include: ["test/worker/**/*.test.ts"],
          setupFiles: ["test/worker/setup.ts"],
        },
      },
      {
        // React components in jsdom with a mocked fetch.
        plugins: [react()],
        test: {
          name: "client",
          environment: "jsdom",
          include: ["test/client/**/*.test.tsx"],
          setupFiles: ["test/client/setup.ts"],
        },
      },
      {
        // Selenium integration tests (requirements.md, "Plan de pruebas") against a local dev server.
        test: {
          name: "e2e",
          include: ["test/e2e/**/*.test.ts"],
          globalSetup: ["test/e2e/global-setup.ts"],
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
