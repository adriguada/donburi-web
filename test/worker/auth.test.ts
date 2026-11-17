import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWTVerifyGetKey } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { authenticate, getAccessToken, verifyAccessToken } from "../../worker/auth";
import { call } from "./helpers";

const TEAM = "donburi.cloudflareaccess.com";
const AUD = "test-aud-tag";
const accessEnv = { DEV_AUTH_BYPASS: undefined, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };

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
  overrides: { iss?: string; aud?: string; exp?: string | number; key?: CryptoKey } = {},
): Promise<string> {
  return new SignJWT({ email: "admin@example.com" })
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
    expect((await authenticate(request, accessEnv, jwks)).ok).toBe(true);
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
    ["POST", "/api/dish", { sectionId: 1, name: "Shoyu", price: 1, isSpicy: false }],
    ["PUT", "/api/dish/1", { name: "Shoyu", price: 1, isSpicy: false }],
    ["DELETE", "/api/dish/1", undefined],
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
