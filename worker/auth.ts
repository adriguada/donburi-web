import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface AccessConfig {
  /** Team domain, with or without scheme, e.g. "myteam.cloudflareaccess.com". */
  teamDomain: string;
  /** Application Audience (AUD) tag. */
  aud: string;
}

export type AuthResult =
  | { ok: true; email?: string }
  | { ok: false; reason: "missing_token" | "invalid_token" | "not_configured" | "forbidden_email" };

const remoteKeySets = new Map<string, JWTVerifyGetKey>();

function issuerFor(teamDomain: string): string {
  const host = teamDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://${host}`;
}

function remoteKeySet(issuer: string): JWTVerifyGetKey {
  let keys = remoteKeySets.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    remoteKeySets.set(issuer, keys);
  }
  return keys;
}

/**
 * Reads the Cloudflare Access JWT from the request. Access adds the
 * `Cf-Access-Jwt-Assertion` header when proxying; the `CF_Authorization`
 * cookie is used as a fallback.
 */
export function getAccessToken(request: Request): string | null {
  const header = request.headers.get("Cf-Access-Jwt-Assertion");
  if (header) return header;
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "CF_Authorization" && rest.length > 0) return rest.join("=");
  }
  return null;
}

/**
 * Verifies a Cloudflare Access JWT: signature (against the team's public
 * keys), issuer and audience. `getKey` can be injected for tests.
 */
export async function verifyAccessToken(
  token: string,
  config: AccessConfig,
  getKey?: JWTVerifyGetKey,
): Promise<AuthResult> {
  const issuer = issuerFor(config.teamDomain);
  try {
    const { payload } = await jwtVerify(token, getKey ?? remoteKeySet(issuer), {
      issuer,
      audience: config.aud,
    });
    return { ok: true, email: typeof payload.email === "string" ? payload.email : undefined };
  } catch {
    return { ok: false, reason: "invalid_token" };
  }
}

export interface AuthEnv {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  /**
   * Comma-separated emails allowed to administer the menu (a Cloudflare secret,
   * not in wrangler.jsonc). Second barrier on top of the Access policy: even if
   * the policy is loosened by mistake, other accounts are rejected here.
   */
  ADMIN_EMAILS?: string;
  /** Local development only (set in .dev.vars). Never set in production. */
  DEV_AUTH_BYPASS?: string;
}

export async function authenticate(
  request: Request,
  env: AuthEnv,
  getKey?: JWTVerifyGetKey,
): Promise<AuthResult> {
  if (env.DEV_AUTH_BYPASS === "true") return { ok: true };
  const allowed = parseEmailList(env.ADMIN_EMAILS);
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || allowed.size === 0) {
    return { ok: false, reason: "not_configured" };
  }
  const token = getAccessToken(request);
  if (!token) return { ok: false, reason: "missing_token" };
  const result = await verifyAccessToken(token, { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD }, getKey);
  if (!result.ok) return result;
  // Tokens without an email (e.g. service tokens) are never admins.
  if (!result.email || !allowed.has(result.email.toLowerCase())) return { ok: false, reason: "forbidden_email" };
  return result;
}

/** "a@x.com, B@y.com" → {"a@x.com", "b@y.com"} (trimmed, lower-cased, blanks dropped). */
export function parseEmailList(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}
