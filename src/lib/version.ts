// Anzeige-Version der App. Werte werden zur Build-Zeit über next.config injiziert.
// Eine Quelle für alles: package.json (major.minor.patch) + Build-Nummer aus dem CI-Lauf.
// Das Docker-Image trägt dieselbe Version als Tag (z. B. ghcr.io/fgilde/hausverwaltung:0.4.0.92).
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";
export const APP_BUILD = process.env.NEXT_PUBLIC_APP_BUILD || "dev";
export const APP_SHA = process.env.NEXT_PUBLIC_APP_SHA || "";

/** Volle Version wie im Image-Tag, z. B. "0.4.0.92" (lokal ohne Zahl: "0.4.0-dev"). */
export const APP_VERSION_FULL_NUMBER = fullVersion(APP_VERSION, APP_BUILD);
/** z. B. "v0.4.0.92" */
export const APP_VERSION_LABEL = `v${APP_VERSION_FULL_NUMBER}`;
/** ausführlich für title/Tooltip, z. B. "v0.4.0.92 · a1b2c3d" */
export const APP_VERSION_FULL = APP_SHA ? `${APP_VERSION_LABEL} · ${APP_SHA}` : APP_VERSION_LABEL;

export function fullVersion(version: string, build: string): string {
  return /^\d+$/.test(build) ? `${version}.${build}` : `${version}-${build}`;
}
