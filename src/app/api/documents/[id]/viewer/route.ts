import type { NextRequest } from "next/server";
import { auth } from "@/auth";

// Für HTML/Attribut-Kontext escapen.
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const MUDEX_SCRIPT = "https://www.mudex.org/wc/mudex.js";

/**
 * Liefert eine eigenständige HTML-Seite, die das Mudex File-Display
 * (Blazor-WASM-Webcomponent) hostet. Wird per <iframe src> eingebunden, damit
 * (a) die globalen Mudex-Styles das App-Layout nicht zerlegen und (b) Blazor
 * eine gültige Base-URI hat (srcdoc/about:srcdoc funktioniert mit Blazor nicht).
 * Die eigentliche Datei wird über den zugriffsgeschützten Endpunkt
 * /api/documents/<id>?inline=1 geladen (Rechteprüfung dort).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const mime = sp.get("mime") ?? "";
  const name = sp.get("name") ?? "Dokument";
  const fileUrl = `/api/documents/${encodeURIComponent(id)}?inline=1`;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<base href="/">
<style>html,body{margin:0;height:100%;background:#fff}mudex-file-display{display:block;width:100%;height:100vh}</style>
<script src="${MUDEX_SCRIPT}"></script>
</head>
<body>
<mudex-file-display url="${esc(fileUrl)}" content-type="${esc(mime)}" file-name="${esc(name)}" show-file-name="true"></mudex-file-display>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
