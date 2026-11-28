import { describe, it, expect } from "vitest";
import { oidcConfigFromEnv, passwordLoginEnabled, ssoAutoLogin } from "./sso";

describe("oidcConfigFromEnv", () => {
  it("null ohne vollständige Env (SSO deaktiviert)", () => {
    expect(oidcConfigFromEnv({} as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(oidcConfigFromEnv({ OIDC_ISSUER: "https://id.example" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });

  it("liefert Config bei vollständiger Env", () => {
    const cfg = oidcConfigFromEnv({
      OIDC_ISSUER: "https://id.example",
      OIDC_CLIENT_ID: "abc",
      OIDC_CLIENT_SECRET: "sec",
      OIDC_NAME: "Authentik",
    } as unknown as NodeJS.ProcessEnv);
    expect(cfg).toMatchObject({ id: "oidc", type: "oidc", issuer: "https://id.example", clientId: "abc", name: "Authentik" });
  });

  it("Standardname SSO", () => {
    const cfg = oidcConfigFromEnv({
      OIDC_ISSUER: "https://id.example",
      OIDC_CLIENT_ID: "abc",
      OIDC_CLIENT_SECRET: "sec",
    } as unknown as NodeJS.ProcessEnv);
    expect(cfg?.name).toBe("SSO");
  });
});

describe("Passwort-Login und Auto-Login (#101)", () => {
  const sso = { OIDC_ISSUER: "https://id.example", OIDC_CLIENT_ID: "abc", OIDC_CLIENT_SECRET: "sec" };
  const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;

  it("Passwort-Login standardmäßig an", () => {
    expect(passwordLoginEnabled(env({}))).toBe(true);
    expect(passwordLoginEnabled(env(sso))).toBe(true);
  });
  it("AUTH_PASSWORD_LOGIN=false schaltet ab, aber nur mit SSO", () => {
    expect(passwordLoginEnabled(env({ ...sso, AUTH_PASSWORD_LOGIN: "false" }))).toBe(false);
    expect(passwordLoginEnabled(env({ AUTH_PASSWORD_LOGIN: "false" }))).toBe(true); // sonst ausgesperrt
  });
  it("Auto-Login nur mit SSO und OIDC_AUTO_LOGIN=true", () => {
    expect(ssoAutoLogin(env({ ...sso, OIDC_AUTO_LOGIN: "true" }))).toBe(true);
    expect(ssoAutoLogin(env({ OIDC_AUTO_LOGIN: "true" }))).toBe(false);
    expect(ssoAutoLogin(env(sso))).toBe(false);
  });
});
