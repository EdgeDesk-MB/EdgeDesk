import { describe, expect, it } from "vitest";
import {
  getOperatorChromeEnv,
  operatorChromeSettingKey,
  operatorChromeUsesNeon,
} from "./operator-chrome-env";

describe("getOperatorChromeEnv", () => {
  it("treats Vercel production as live", () => {
    expect(getOperatorChromeEnv({ VERCEL_ENV: "production" })).toBe("live");
  });

  it("treats Vercel preview as preview", () => {
    expect(getOperatorChromeEnv({ VERCEL_ENV: "preview" })).toBe("preview");
  });

  it("treats localhost and unset as local", () => {
    expect(getOperatorChromeEnv({})).toBe("local");
    expect(getOperatorChromeEnv({ VERCEL_ENV: "development" })).toBe("local");
    expect(getOperatorChromeEnv({ NODE_ENV: "production" })).toBe("local");
  });
});

describe("operatorChromeSettingKey", () => {
  it("keeps the live key unscoped so existing rows still apply", () => {
    expect(operatorChromeSettingKey("maintenance_banner", "live")).toBe(
      "maintenance_banner"
    );
  });

  it("scopes preview and local so they cannot overwrite live", () => {
    expect(operatorChromeSettingKey("maintenance_banner", "local")).toBe(
      "maintenance_banner:local"
    );
    expect(operatorChromeSettingKey("app_update", "preview")).toBe(
      "app_update:preview"
    );
  });
});

describe("operatorChromeUsesNeon", () => {
  it("uses Neon only on hosted Vercel with a database URL", () => {
    expect(
      operatorChromeUsesNeon({
        VERCEL_ENV: "production",
        DATABASE_URL: "postgres://example",
      })
    ).toBe(true);
    expect(
      operatorChromeUsesNeon({
        VERCEL_ENV: "preview",
        DATABASE_URL: "postgres://example",
      })
    ).toBe(true);
  });

  it("keeps local admin on SQLite even when DATABASE_URL is set", () => {
    expect(
      operatorChromeUsesNeon({
        DATABASE_URL: "postgres://example",
      })
    ).toBe(false);
    expect(
      operatorChromeUsesNeon({
        VERCEL_ENV: "development",
        DATABASE_URL: "postgres://example",
      })
    ).toBe(false);
    expect(
      operatorChromeUsesNeon({
        VERCEL_ENV: "production",
      })
    ).toBe(false);
  });
});
