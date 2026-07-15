import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// KI-Adapter (Claude). Schlüssel/Modell kommen aus der Mandanten-Konfiguration
// (Einstellungen) und fallen sonst auf die Umgebungsvariablen zurück. Ohne
// Schlüssel liefern die Aufrufer eine regelbasierte Antwort — App läuft voll.

export interface AiConfig {
  apiKey?: string | null;
  model?: string | null;
}

function resolveKey(cfg?: AiConfig): string | undefined {
  return cfg?.apiKey || process.env.ANTHROPIC_API_KEY || undefined;
}
function resolveModel(cfg?: AiConfig): string {
  return cfg?.model || process.env.AI_MODEL || "claude-opus-4-8";
}

export function isAiConfigured(cfg?: AiConfig): boolean {
  return !!resolveKey(cfg);
}

const SYSTEM = `Du bist der Assistent einer deutschen Hausverwaltungssoftware (HaVeWa).
Beantworte Fragen zum verwalteten Immobilienbestand knapp, sachlich und auf Deutsch.
Stütze dich ausschließlich auf die im Kontext gelieferten Daten; erfinde keine Zahlen.
Wenn die Daten für eine Antwort nicht ausreichen, sage das offen.`;

/** Stellt eine Frage an Claude, angereichert mit einem Bestands-Kontext. */
export async function askAssistant(context: string, question: string, cfg?: AiConfig): Promise<string> {
  const apiKey = resolveKey(cfg);
  if (!apiKey) throw new Error("Kein API-Schlüssel konfiguriert");
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: resolveModel(cfg),
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: SYSTEM,
    messages: [{ role: "user", content: `Bestands-Kontext (JSON):\n${context}\n\nFrage: ${question}` }],
  });
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/** Test-Aufruf für die Einstellungen: kurze Anfrage, wirft bei Fehler. */
export async function pingAi(cfg: AiConfig): Promise<string> {
  const apiKey = resolveKey(cfg);
  if (!apiKey) throw new Error("Kein API-Schlüssel konfiguriert");
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: resolveModel(cfg),
    max_tokens: 16,
    messages: [{ role: "user", content: "Antworte nur mit: OK" }],
  });
  return res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text?.trim() || "";
}
