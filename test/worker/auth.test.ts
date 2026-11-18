import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWTVerifyGetKey } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { authenticate, getAccessToken, parseEmailList, verifyAccessToken } from "../../worker/auth";
import { call } from "./helpers";

const TEAM = "donburi.cloudflareaccess.com";
const AUD = "test-aud-tag";
const ADMIN = "admin@example.com";
const accessEnv = { DEV_AUTH_BYPASS: undefined, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ADMIN_EMAILS: ADMIN };

let privateKey: CryptoKey;
let otherPrivateKey: CryptoKey;
let jwks: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  const other = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  otherPrivateKey = other.privateKey;
  const publicJwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  jwks = createLocalJWKSet({ keys: [publicJwk] });
});

function sign(
  overrides: { iss?: string; aud?: string; exp?: string | number; key?: CryptoKey; email?: string | null } = {},
): Promise<string> {
  const email = overrides.email === undefined ? ADMIN : overrides.email;
  return new SignJWT(email === null ? {} : { email })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(overrides.iss ?? `https://${TEAM}`)
    .setAudience(overrides.aud ?? AUD)
    .setIssuedAt()
    .setExpirationTime(overrides.exp ?? "1h")
    .sign(overrides.key ?? privateKey);
}

describe("verifyAccessToken", () => {
  const config = { teamDomain: TEAM, aud: AUD };

  it("accepts a valid Access token", async () => {
    expect(await verifyAccessToken(await sign(), config, jwks)).toEqual({ ok: true, email: "admin@example.com" });
  });

  it("accepts the team domain with an https:// prefix", async () => {
    const result = await verifyAccessToken(await sign(), { teamDomain: `https://${TEAM}/`, aud: AUD }, jwks);
    expect(result.ok).toBe(true);
  });

  it.each([
    ["wrong audience", { aud: "other-app" }],
    ["wrong issuer", { iss: "https://evil.cloudflareaccess.com" }],
    ["expired", { exp: Math.floor(Date.now() / 1000) - 60 }],
  ])("rejects a token with %s", async (_label, overrides) => {
    expect(await verifyAccessToken(await sign(overrides), config, jwks)).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects a token signed with another key", async () => {
    const token = await sign({ key: otherPrivateKey });
    expect((await verifyAccessToken(token, config, jwks)).ok).toBe(false);
  });

  it("rejects garbage", async () => {
    expect((await verifyAccessToken("not-a-jwt", config, jwks)).ok).toBe(false);
  });
});

describe("getAccessToken", () => {
  it("reads the Cf-Access-Jwt-Assertion header", () => {
    const request = new Request("https://x", { headers: { "Cf-Access-Jwt-Assertion": "abc" } });
    expect(getAccessToken(request)).toBe("abc");
  });

  it("falls back to the CF_Authorization cookie", () => {
    const request = new Request("https://x", { headers: { Cookie: "foo=1; CF_Authorization=a.b=c; bar=2" } });
    expect(getAccessToken(request)).toBe("a.b=c");
  });

  it("returns null without a token", () => {
    expect(getAccessToken(new Request("https://x"))).toBeNull();
  });
});

describe("authenticate", () => {
  it("allows everything when DEV_AUTH_BYPASS is true", async () => {
    expect(await authenticate(new Request("https://x"), { DEV_AUTH_BYPASS: "true" })).toEqual({ ok: true });
  });

  it("fails closed when Access is not configured", async () => {
    expect(await authenticate(new Request("https://x"), {})).toEqual({ ok: false, reason: "not_configured" });
  });

  it("verifies the header token against the configured team and audience", async () => {
    const request = new Request("https://x", { headers: { "Cf-Access-Jwt-Assertion": await sign() } });
    expect(await authenticate(request, accessEnv, jwks)).toEqual({ ok: true, email: ADMIN });
  });

  const withToken = async (overrides: Parameters<typeof sign>[0]) =>
    new Request("https://x", { headers: { "Cf-Access-Jwt-Assertion": await sign(overrides) } });

  it("rejects a valid Access token for an email that is not in ADMIN_EMAILS (second barrier)", async () => {
    // The Access policy let this user in (the token is genuine), but the Worker still says no.
    const result = await authenticate(await withToken({ email: "intruder@gmail.com" }), accessEnv, jwks);
    expect(result).toEqual({ ok: false, reason: "forbidden_email" });
  });

  it("compares emails case-insensitively and accepts a comma-separated list", async () => {
    const env = { ...accessEnv, ADMIN_EMAILS: " Other@Example.com ,  ADMIN@example.COM " };
    expect((await authenticate(await withToken({ email: "Admin@Example.com" }), env, jwks)).ok).toBe(true);
    expect((await authenticate(await withToken({ email: "other@example.com" }), env, jwks)).ok).toBe(true);
  });

  it("rejects tokens without an email (e.g. service tokens)", async () => {
    expect(await authenticate(await withToken({ email: null }), accessEnv, jwks)).toEqual({
      ok: false,
      reason: "forbidden_email",
    });
  });

  it.each([undefined, "", " , "])("fails closed when ADMIN_EMAILS is %j", async (ADMIN_EMAILS) => {
    const result = await authenticate(await withToken({}), { ...accessEnv, ADMIN_EMAILS }, jwks);
    expect(result).toEqual({ ok: false, reason: "not_configured" });
  });
});

describe("parseEmailList", () => {
  it("trims, lower-cases and drops blanks", () => {
    expect([...parseEmailList(" A@x.com,, b@Y.com ,")]).toEqual(["a@x.com", "b@y.com"]);
    expect(parseEmailList(undefined).size).toBe(0);
  });
});

describe("Worker routes behind Access (AD1.2)", () => {
  it("keeps GET /api/menu public", async () => {
    expect((await call("GET", "/api/menu", undefined, { envOverrides: accessEnv })).status).toBe(200);
  });

  it.each([
    ["POST", "/api/section", { title: "Ramen" }],
    ["PUT", "/api/section/1", { title: "Ramen" }],
    ["DELETE", "/api/section/1", undefined],
    ["POST", "/api/dish", { sectionId: 1, name: "Shoyu", price: 1, spiciness: 0 }],
    ["PUT", "/api/dish/1", { name: "Shoyu", price: 1, spiciness: 0 }],
    ["DELETE", "/api/dish/1", undefined],
    ["PUT", "/api/section/order", { sectionIds: [] }],
  ])("rejects %s %s without a token", async (method, path, body) => {
    const response = await call(method, path, body, { envOverrides: accessEnv });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "UNAUTHORIZED" });
  });

  it("rejects an invalid token", async () => {
    const response = await call("POST", "/api/section", { title: "Ramen" }, {
      envOverrides: accessEnv,
      headers: { "Cf-Access-Jwt-Assertion": "not-a-jwt" },
    });
    expect(response.status).toBe(401);
  });

  it("returns 500 when the ADMIN_EMAILS secret is missing, even with Access configured", async () => {
    const response = await call("POST", "/api/section", { title: "Ramen" }, {
      envOverrides: { ...accessEnv, ADMIN_EMAILS: undefined },
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "AUTH_NOT_CONFIGURED" });
  });

  it("returns 500 for write requests when Access is not configured", async () => {
    const response = await call("POST", "/api/section", { title: "Ramen" }, {
      envOverrides: { DEV_AUTH_BYPASS: undefined, ACCESS_TEAM_DOMAIN: "", ACCESS_AUD: "" },
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "AUTH_NOT_CONFIGURED" });
  });

  it.each(["/admin", "/admin/"])("protects the admin page %s", async (path) => {
    expect((await call("GET", path, undefined, { envOverrides: accessEnv })).status).toBe(401);
  });
});
