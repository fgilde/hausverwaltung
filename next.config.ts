import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import createNextIntlPlugin from "next-intl/plugin";
import pkg from "./package.json";
import { MAX_UPLOAD_MB } from "./src/lib/upload-limit";

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
  // pdfkit liest Schrift-/ICC-Daten zur Laufzeit aus node_modules (Briefe als PDF/A, #58);
  // gebündelt zeigen die Pfade ins Leere.
  serverExternalPackages: ["pdfkit"],
  // Kommunikationsbereich hieß früher /email (#68); alte Links/Lesezeichen weiterleiten.
  async redirects() {
    return [
      { source: "/:locale(de|en|pt-BR)/email/:path*", destination: "/:locale/communication/:path*", permanent: true },
      { source: "/email/:path*", destination: "/communication/:path*", permanent: true },
    ];
  },
  // Body-Limits über das App-Upload-Limit heben (Reserve für Multipart-Overhead). Server Actions
  // haben 1 MB Default (#7), der Proxy (src/middleware.ts) kappt bei 10 MB (#85).
  experimental: {
    serverActions: { bodySizeLimit: `${MAX_UPLOAD_MB + 10}mb` },
    proxyClientMaxBodySize: `${MAX_UPLOAD_MB + 10}mb`,
  },
};

export default withNextIntl(nextConfig);
