import { vi } from "vitest";
import type { Menu } from "../../shared/types";

type Handler = (body: unknown) => { status: number; body?: unknown };

/**
 * Stubs global fetch with a router keyed by "METHOD /path".
 * Unmatched requests fail the test loudly.
 */
export function mockFetch(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const key = `${method} ${String(input)}`;
    const handler = routes[key];
    if (!handler) throw new Error(`Unexpected fetch: ${key}`);
    const { status, body } = handler(init?.body ? JSON.parse(String(init.body)) : undefined);
    return body === undefined
      ? new Response(null, { status })
      : new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Returns each menu in turn on successive GET /api/menu calls, repeating the last one. */
export function menuSequence(...menus: Menu[]): Handler {
  let index = 0;
  return () => ({ status: 200, body: menus[Math.min(index++, menus.length - 1)] });
}

export function callsTo(fetchMock: ReturnType<typeof mockFetch>, method: string, path: string) {
  return fetchMock.mock.calls
    .filter(([input, init]) => String(input) === path && (init?.method ?? "GET") === method)
    .map(([, init]) => (init?.body ? JSON.parse(String(init.body)) : undefined));
}
