// Next.js-Hook: läuft einmal beim Serverstart. Startet Hintergrund-Jobs, die nur
// im Node-Runtime Sinn ergeben (nicht Edge, nicht beim Build).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.HAVEWA_DISABLE_SCHEDULER === "1") return;
  const { startInboundScheduler } = await import("./lib/inbound-scheduler");
  startInboundScheduler();
}
