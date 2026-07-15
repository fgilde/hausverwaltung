import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// KI-Adapter (Claude). Optional: nur aktiv, wenn ANTHROPIC_API_KEY gesetzt ist.
// Ohne Key liefern die Aufrufer eine regelbasierte Antwort (siehe insights.ts),
// sodass die App auch ohne LLM voll funktioniert.

export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Modell per Env überschreibbar; Default = aktuelles Opus.
const MODEL = process.env.AI_MODEL || "claude-opus-4-8";

const SYSTEM = `Du bist der Assistent einer deutschen Hausverwaltungssoftware (HaVeWa).
Beantworte Fragen zum verwalteten Immobilienbestand knapp, sachlich und auf Deutsch.
Stütze dich ausschließlich auf die im Kontext gelieferten Daten; erfinde keine Zahlen.
Wenn die Daten für eine Antwort nicht ausreichen, sage das offen.`;

/**
 * Stellt eine Frage an Claude, angereichert mit einem Bestands-Kontext.
 * Wirft, wenn kein API-Key gesetzt ist — Aufrufer prüfen `isAiConfigured()`.
 */
export async function askAssistant(context: string, question: string): Promise<string> {
  const client = new Anthropic(); // liest ANTHROPIC_API_KEY aus der Umgebung
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Bestands-Kontext (JSON):\n${context}\n\nFrage: ${question}`,
      },
    ],
  });
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
