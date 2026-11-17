import { env } from "cloudflare:test";
import worker, { type AppEnv } from "../../worker/index";

export const BASE = "https://donburi.test";

/** Calls the Worker's fetch handler directly. `envOverrides` replaces bindings for this call. */
export async function call(
  method: string,
  path: string,
  body?: unknown,
  options: { envOverrides?: Partial<AppEnv>; headers?: Record<string, string>; rawBody?: string } = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  let payload: string | undefined = options.rawBody;
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    payload = JSON.stringify(body);
  }
  const request = new Request(`${BASE}${path}`, { method, headers, body: payload });
  return worker.fetch(
    request as Request<unknown, IncomingRequestCfProperties>,
    { ...env, ...options.envOverrides } as AppEnv,
  );
}

export async function createSection(title: string): Promise<{ id: number; title: string }> {
  const response = await call("POST", "/api/section", { title });
  if (response.status !== 201) throw new Error(`createSection failed: ${response.status}`);
  return response.json();
}

export async function createDish(
  sectionId: number,
  name: string,
  extra: { description?: string | null; price?: number; spiciness?: number } = {},
): Promise<{ id: number; name: string }> {
  const response = await call("POST", "/api/dish", {
    sectionId,
    name,
    description: extra.description ?? null,
    price: extra.price ?? 10,
    spiciness: extra.spiciness ?? 0,
  });
  if (response.status !== 201) throw new Error(`createDish failed: ${response.status}`);
  return response.json();
}

export async function getMenu() {
  const response = await call("GET", "/api/menu");
  return (await response.json()) as import("../../shared/types").Menu;
}
