import type { ApiError, ApiErrorCode } from "../shared/types";
import { authenticate, type AuthEnv } from "./auth";
import * as db from "./db";
import {
  parseDishInput,
  parseId,
  parseNewDishInput,
  parseSectionInput,
  parseSectionOrder,
  type Parsed,
} from "./validation";

export type AppEnv = Env & AuthEnv;

const MESSAGES = {
  sectionExists: "Ya existe una sección con ese nombre en la carta.",
  dishExists: "Ya existe un plato con ese nombre en esta sección.",
  orderConflict: "La carta ha cambiado mientras la ordenabas. Recarga la página e inténtalo de nuevo.",
  sectionNotFound: "La sección no existe.",
  dishNotFound: "El plato no existe.",
  invalidJson: "El cuerpo de la petición no es JSON válido.",
  unauthorized: "Acceso no autorizado.",
  authNotConfigured: "La autenticación de Cloudflare Access no está configurada.",
  notFound: "Recurso no encontrado.",
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function error(code: ApiErrorCode, message: string, status: number): Response {
  return json({ error: code, message } satisfies ApiError, status);
}

function methodNotAllowed(allowed: string[]): Response {
  return new Response(null, { status: 405, headers: { Allow: allowed.join(", ") } });
}

async function readBody<T>(request: Request, parse: (body: unknown) => Parsed<T>): Promise<Parsed<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, message: MESSAGES.invalidJson };
  }
  return parse(body);
}

/** Returns an error response if the request is not authenticated, or null if it may proceed. */
async function requireAdmin(request: Request, env: AppEnv): Promise<Response | null> {
  const auth = await authenticate(request, env);
  if (auth.ok) return null;
  if (auth.reason === "not_configured") {
    console.error("ACCESS_TEAM_DOMAIN / ACCESS_AUD are not set; rejecting admin request.");
    return error("AUTH_NOT_CONFIGURED", MESSAGES.authNotConfigured, 500);
  }
  return error("UNAUTHORIZED", MESSAGES.unauthorized, 401);
}

async function handleSections(request: Request, env: AppEnv, rawId: string | undefined): Promise<Response> {
  if (rawId === undefined) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    const input = await readBody(request, parseSectionInput);
    if (!input.ok) return error("VALIDATION_ERROR", input.message, 400);
    const result = await db.createSection(env.DB, input.value);
    if (!result.ok) return error("SECTION_EXISTS", MESSAGES.sectionExists, 409);
    return json(result.value, 201);
  }

  const id = parseId(rawId);
  if (id === null) return error("NOT_FOUND", MESSAGES.sectionNotFound, 404);

  switch (request.method) {
    case "PUT": {
      const input = await readBody(request, parseSectionInput);
      if (!input.ok) return error("VALIDATION_ERROR", input.message, 400);
      const result = await db.updateSection(env.DB, id, input.value);
      if (result.ok) return json(result.value);
      return result.reason === "conflict"
        ? error("SECTION_EXISTS", MESSAGES.sectionExists, 409)
        : error("NOT_FOUND", MESSAGES.sectionNotFound, 404);
    }
    case "DELETE":
      return (await db.deleteSection(env.DB, id))
        ? new Response(null, { status: 204 })
        : error("NOT_FOUND", MESSAGES.sectionNotFound, 404);
    default:
      return methodNotAllowed(["PUT", "DELETE"]);
  }
}

async function handleSectionOrder(request: Request, env: AppEnv): Promise<Response> {
  if (request.method !== "PUT") return methodNotAllowed(["PUT"]);
  const input = await readBody(request, parseSectionOrder);
  if (!input.ok) return error("VALIDATION_ERROR", input.message, 400);
  const result = await db.reorderSections(env.DB, input.value.sectionIds);
  if (!result.ok) return error("ORDER_CONFLICT", MESSAGES.orderConflict, 409);
  return json(result.value);
}

async function handleDishes(request: Request, env: AppEnv, rawId: string | undefined): Promise<Response> {
  if (rawId === undefined) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    const input = await readBody(request, parseNewDishInput);
    if (!input.ok) return error("VALIDATION_ERROR", input.message, 400);
    const result = await db.createDish(env.DB, input.value);
    if (result.ok) return json(result.value, 201);
    return result.reason === "conflict"
      ? error("DISH_EXISTS", MESSAGES.dishExists, 409)
      : error("NOT_FOUND", MESSAGES.sectionNotFound, 404);
  }

  const id = parseId(rawId);
  if (id === null) return error("NOT_FOUND", MESSAGES.dishNotFound, 404);

  switch (request.method) {
    case "PUT": {
      const input = await readBody(request, parseDishInput);
      if (!input.ok) return error("VALIDATION_ERROR", input.message, 400);
      const result = await db.updateDish(env.DB, id, input.value);
      if (result.ok) return json(result.value);
      return result.reason === "conflict"
        ? error("DISH_EXISTS", MESSAGES.dishExists, 409)
        : error("NOT_FOUND", MESSAGES.dishNotFound, 404);
    }
    case "DELETE":
      return (await db.deleteDish(env.DB, id))
        ? new Response(null, { status: 204 })
        : error("NOT_FOUND", MESSAGES.dishNotFound, 404);
    default:
      return methodNotAllowed(["PUT", "DELETE"]);
  }
}

async function handleApi(request: Request, env: AppEnv, path: string): Promise<Response> {
  if (path === "/api/menu") {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return json(await db.getMenu(env.DB));
  }

  const match = /^\/api\/(section|dish)(?:\/([^/]+))?\/?$/.exec(path);
  if (!match) return error("NOT_FOUND", MESSAGES.notFound, 404);

  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const [, resource, rawId] = match;
  if (resource === "section" && rawId === "order") return handleSectionOrder(request, env);
  return resource === "section" ? handleSections(request, env, rawId) : handleDishes(request, env, rawId);
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;

    if (path.startsWith("/api/")) return handleApi(request, env, path);

    if (path === "/admin" || path.startsWith("/admin/")) {
      const auth = await authenticate(request, env);
      if (!auth.ok) {
        return auth.reason === "not_configured"
          ? new Response(MESSAGES.authNotConfigured, { status: 500 })
          : new Response(MESSAGES.unauthorized, { status: 401 });
      }
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<AppEnv>;
