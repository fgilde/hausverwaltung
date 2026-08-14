import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import createNextIntlPlugin from "next-intl/plugin";
import pkg from "./package.json";

const withNextIntl = createNextIntlPlugin();

// Version fürs UI. semver aus package.json; Build-Nummer + SHA werden im CI per
// Build-Arg gesetzt (im Docker-Image ist .git nicht verfügbar). Lokal fallen wir
// auf git zurück (Commit-Anzahl als Build-Nummer, steigt mit jedem Commit).
function git(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}
const build = process.env.APP_BUILD || git("git rev-list --count HEAD") || "dev";
const sha = (process.env.APP_SHA || git("git rev-parse --short HEAD") || "").slice(0, 7);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_APP_BUILD: build,
    NEXT_PUBLIC_APP_SHA: sha,
  },
};

export default withNextIntl(nextConfig);
