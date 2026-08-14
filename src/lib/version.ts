// Anzeige-Version der App. Werte werden zur Build-Zeit über next.config injiziert.
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";
export const APP_BUILD = process.env.NEXT_PUBLIC_APP_BUILD || "dev";
export const APP_SHA = process.env.NEXT_PUBLIC_APP_SHA || "";

/** z. B. "v0.1.0 · Build 42" */
export const APP_VERSION_LABEL = `v${APP_VERSION} · Build ${APP_BUILD}`;
/** ausführlich für title/Tooltip, z. B. "v0.1.0 · Build 42 · a1b2c3d" */
export const APP_VERSION_FULL = APP_SHA ? `${APP_VERSION_LABEL} · ${APP_SHA}` : APP_VERSION_LABEL;
