// Ein Wert für Dokument-Uploads (UI + API) und die Body-Limits in next.config.ts (#7, #85).
// Gescannte Verträge und Protokolle werden schnell 50 MB groß.
export const MAX_UPLOAD_MB = 100;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
