import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface AccessConfig {
  /** Team domain, with or without scheme, e.g. "myteam.cloudflareaccess.com". */
  teamDomain: string;
  /** Application Audience (AUD) tag. */
  aud: string;
}

export type AuthResult =
  | { ok: true; email?: string }
  | { ok: false; reason: "missing_token" | "invalid_token" | "not_configured" };

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
  /** Local development only (set in .dev.vars). Never set in production. */
  DEV_AUTH_BYPASS?: string;
}

export async function authenticate(
  request: Request,
  env: AuthEnv,
  getKey?: JWTVerifyGetKey,
): Promise<AuthResult> {
  if (env.DEV_AUTH_BYPASS === "true") return { ok: true };
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return { ok: false, reason: "not_configured" };
  const token = getAccessToken(request);
  if (!token) return { ok: false, reason: "missing_token" };
  return verifyAccessToken(token, { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD }, getKey);
}
