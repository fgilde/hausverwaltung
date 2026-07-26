import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// KI-Adapter. Unterstützt Anthropic (Claude) und beliebige OpenAI-kompatible
// Anbieter (OpenAI, OpenRouter → Hermes/Llama/…, Groq, Ollama, LM Studio …)
// über Basis-URL. Config kommt aus der Mandanten-Konfiguration, fällt sonst auf
// Umgebungsvariablen zurück. Ohne Schlüssel liefern die Aufrufer eine
// regelbasierte Antwort — die App läuft voll.

export type AiProvider = "anthropic" | "openai";

export interface AiConfig {
  provider?: string | null;
  baseUrl?: string | null;
  apiKey?: string | null;
  model?: string | null;
}

function resolveProvider(cfg?: AiConfig): AiProvider {
  if (cfg?.provider === "openai" || cfg?.provider === "anthropic") return cfg.provider;
  if (cfg?.baseUrl) return "openai";
  return "anthropic";
}
function resolveKey(cfg?: AiConfig): string | undefined {
  return cfg?.apiKey || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || undefined;
}
function resolveModel(cfg?: AiConfig): string {
  if (cfg?.model) return cfg.model;
  if (process.env.AI_MODEL) return process.env.AI_MODEL;
  return resolveProvider(cfg) === "openai" ? "gpt-4o-mini" : "claude-opus-4-8";
}

export function isAiConfigured(cfg?: AiConfig): boolean {
  return !!resolveKey(cfg);
}

const SYSTEM = `Du bist der Assistent einer deutschen Hausverwaltungssoftware (HaVeWa).
Beantworte Fragen zum verwalteten Immobilienbestand knapp, sachlich und auf Deutsch.
Stütze dich ausschließlich auf die im Kontext gelieferten Daten; erfinde keine Zahlen.
Wenn die Daten für eine Antwort nicht ausreichen, sage das offen.`;

async function anthropicChat(cfg: AiConfig, apiKey: string, user: string, maxTokens: number): Promise<string> {
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: resolveModel(cfg),
    max_tokens: maxTokens,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

async function openaiChat(cfg: AiConfig, apiKey: string, user: string, maxTokens: number): Promise<string> {
  const client = new OpenAI({ apiKey, baseURL: cfg.baseUrl || undefined });
  const res = await client.chat.completions.create({
    model: resolveModel(cfg),
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

/** Frage an die KI, angereichert mit einem Bestands-Kontext. */
export async function askAssistant(context: string, question: string, cfg?: AiConfig): Promise<string> {
  const apiKey = resolveKey(cfg);
  if (!apiKey) throw new Error("Kein API-Schlüssel konfiguriert");
  const user = `Bestands-Kontext (JSON):\n${context}\n\nFrage: ${question}`;
  return resolveProvider(cfg) === "openai"
    ? openaiChat(cfg!, apiKey, user, 1024)
    : anthropicChat(cfg ?? {}, apiKey, user, 1024);
}

/** Test-Aufruf für die Einstellungen: kurze Anfrage, wirft bei Fehler. */
export async function pingAi(cfg: AiConfig): Promise<string> {
  const apiKey = resolveKey(cfg);
  if (!apiKey) throw new Error("Kein API-Schlüssel konfiguriert");
  return resolveProvider(cfg) === "openai"
    ? openaiChat(cfg, apiKey, "Antworte nur mit: OK", 16)
    : anthropicChat(cfg, apiKey, "Antworte nur mit: OK", 16);
}
