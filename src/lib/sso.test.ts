import { describe, it, expect } from "vitest";
import { oidcConfigFromEnv } from "./sso";

describe("oidcConfigFromEnv", () => {
  it("null ohne vollständige Env (SSO deaktiviert)", () => {
    expect(oidcConfigFromEnv({} as NodeJS.ProcessEnv)).toBeNull();
    expect(oidcConfigFromEnv({ OIDC_ISSUER: "https://id.example" } as NodeJS.ProcessEnv)).toBeNull();
  });

  it("liefert Config bei vollständiger Env", () => {
    const cfg = oidcConfigFromEnv({
      OIDC_ISSUER: "https://id.example",
      OIDC_CLIENT_ID: "abc",
      OIDC_CLIENT_SECRET: "sec",
      OIDC_NAME: "Authentik",
    } as NodeJS.ProcessEnv);
    expect(cfg).toMatchObject({ id: "oidc", type: "oidc", issuer: "https://id.example", clientId: "abc", name: "Authentik" });
  });

  it("Standardname SSO", () => {
    const cfg = oidcConfigFromEnv({
      OIDC_ISSUER: "https://id.example",
      OIDC_CLIENT_ID: "abc",
      OIDC_CLIENT_SECRET: "sec",
    } as NodeJS.ProcessEnv);
    expect(cfg?.name).toBe("SSO");
  });
});
