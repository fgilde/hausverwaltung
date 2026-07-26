import { authenticateBearer, type ApiPrincipal } from "@/lib/api-auth";
import * as data from "@/lib/api-data";

// MCP-Server (Model Context Protocol) über Streamable HTTP / JSON-RPC.
// Auth: Bearer-Token (persönlicher API-Token). Der Agent (Claude, ChatGPT,
// beliebiger MCP-Client) kann damit den Bestand lesen, verstehen und bearbeiten.
// Stateless: jede POST-Anfrage ist eigenständig, Antwort als application/json.

const PROTOCOL = "2024-11-05";

type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  run: (p: ApiPrincipal, args: Record<string, unknown>) => Promise<unknown>;
};

const obj = (props: Record<string, object>, required: string[] = []) => ({
  type: "object",
  properties: props,
  required,
});
const str = { type: "string" };

const TOOLS: Tool[] = [
  {
    name: "portfolio_summary",
    description: "Kennzahlen-Überblick: Objekte, Einheiten, Vermietung, Sollmiete/Monat, offene Posten, offene Tickets.",
    inputSchema: obj({}),
    run: (p) => data.portfolioSummary(p.tenantId),
  },
  {
    name: "list_properties",
    description: "Alle Objekte (Liegenschaften) mit Adresse, Verwaltungsart und Einheitenzahl.",
    inputSchema: obj({}),
    run: (p) => data.listProperties(p.tenantId),
  },
  {
    name: "get_property",
    description: "Ein Objekt mit Gebäuden und Einheiten (Details).",
    inputSchema: obj({ id: str }, ["id"]),
    run: (p, a) => data.getProperty(p.tenantId, String(a.id)),
  },
  {
    name: "list_units",
    description: "Alle Einheiten (Wohnungen/Gewerbe/Stellplätze) mit Objekt, Fläche und Zimmern.",
    inputSchema: obj({}),
    run: (p) => data.listUnits(p.tenantId),
  },
  {
    name: "list_persons",
    description: "Alle Personen/Kontakte (Mieter, Eigentümer, Interessenten, Handwerker …).",
    inputSchema: obj({}),
    run: (p) => data.listPersons(p.tenantId),
  },
  {
    name: "list_leases",
    description: "Alle Mietverträge mit Objekt, Einheit, Mieter, Kaltmiete und Laufzeit.",
    inputSchema: obj({}),
    run: (p) => data.listLeases(p.tenantId),
  },
  {
    name: "list_tickets",
    description: "Alle Instandhaltungs-/Schadens-Tickets mit Status, Priorität und Zuständigkeit.",
    inputSchema: obj({}),
    run: (p) => data.listTickets(p.tenantId),
  },
  {
    name: "list_open_items",
    description: "Offene Posten (unbezahlte Sollstellungen) mit Betrag, Fälligkeit und Überfälligkeit.",
    inputSchema: obj({}),
    run: (p) => data.listOpenItems(p.tenantId),
  },
  {
    name: "list_owners",
    description: "Alle Eigentümer-Zuordnungen (Person je Einheit mit Anteil in Tausendstel).",
    inputSchema: obj({}),
    run: (p) => data.listOwners(p.tenantId),
  },
  {
    name: "list_meters",
    description: "Alle Zähler (Strom/Wasser/Wärme …) mit Einheit, Objekt und letztem Zählerstand.",
    inputSchema: obj({}),
    run: (p) => data.listMeters(p.tenantId),
  },
  {
    name: "list_accounts",
    description: "Alle Konten (Bank/Kaution/Rücklage) mit Saldo.",
    inputSchema: obj({}),
    run: (p) => data.listAccounts(p.tenantId),
  },
  {
    name: "list_charges",
    description: "Alle Sollstellungen (Forderungen) mit Betrag, Fälligkeit und bereits gezahltem Betrag.",
    inputSchema: obj({}),
    run: (p) => data.listCharges(p.tenantId),
  },
  {
    name: "list_payments",
    description: "Alle Zahlungen (Ein-/Ausgänge) mit Betrag, Datum, Konto und Verwendungszweck.",
    inputSchema: obj({}),
    run: (p) => data.listPayments(p.tenantId),
  },
  {
    name: "list_documents",
    description: "Alle Dokumente (Verträge, Rechnungen, Protokolle, Abrechnungen) mit Kategorie und E-Rechnungs-Daten.",
    inputSchema: obj({}),
    run: (p) => data.listDocuments(p.tenantId),
  },
  {
    name: "list_meetings",
    description: "Alle Eigentümerversammlungen mit Datum, Status, Ort, Anzahl TOPs und Beschlüsse.",
    inputSchema: obj({}),
    run: (p) => data.listMeetings(p.tenantId),
  },
  {
    name: "list_resolutions",
    description: "Beschlusssammlung (§24 WEG): alle Beschlüsse je Objekt mit Nummer, Text, Ergebnis und Abstimmung.",
    inputSchema: obj({}),
    run: (p) => data.listResolutions(p.tenantId),
  },
  {
    name: "list_economic_plans",
    description: "WEG-Wirtschaftspläne (§28) je Objekt/Jahr mit Gesamtbetrag und monatlichem Hausgeld.",
    inputSchema: obj({}),
    run: (p) => data.listEconomicPlans(p.tenantId),
  },
  {
    name: "list_reserves",
    description: "Erhaltungsrücklagen je Objekt mit aktuellem Saldo.",
    inputSchema: obj({}),
    run: (p) => data.listReserves(p.tenantId),
  },
  {
    name: "list_appointments",
    description: "Alle Termine (Besichtigung/Versammlung/Wartung/Frist) mit Start, Ende und Ort.",
    inputSchema: obj({}),
    run: (p) => data.listAppointments(p.tenantId),
  },
  {
    name: "list_tasks",
    description: "Alle Aufgaben/Wiedervorlagen mit Fälligkeit und Status.",
    inputSchema: obj({}),
    run: (p) => data.listTasks(p.tenantId),
  },
  {
    name: "list_contractors",
    description: "Alle Handwerker/Dienstleister mit Gewerk und Kontakt.",
    inputSchema: obj({}),
    run: (p) => data.listContractors(p.tenantId),
  },
  {
    name: "list_maintenance_contracts",
    description: "Alle Wartungsverträge mit Intervall, nächster Fälligkeit und Dienstleister.",
    inputSchema: obj({}),
    run: (p) => data.listMaintenanceContracts(p.tenantId),
  },
  {
    name: "list_insurances",
    description: "Alle Versicherungen je Objekt mit Typ, Versicherer, Police und Jahresprämie.",
    inputSchema: obj({}),
    run: (p) => data.listInsurances(p.tenantId),
  },
  {
    name: "list_property_taxes",
    description: "Grundsteuer je Objekt (Aktenzeichen, Messbetrag, Hebesatz, berechneter Jahresbetrag).",
    inputSchema: obj({}),
    run: (p) => data.listPropertyTaxes(p.tenantId),
  },
  {
    name: "create_task",
    description: "Neue Aufgabe/Wiedervorlage anlegen. dueDate optional als YYYY-MM-DD.",
    inputSchema: obj({ title: str, dueDate: str }, ["title"]),
    run: (p, a) => data.createTask(p.tenantId, { title: String(a.title), dueDate: a.dueDate ? String(a.dueDate) : undefined }),
  },
  {
    name: "create_ticket",
    description: "Neues Ticket/Schadensmeldung anlegen. propertyId optional.",
    inputSchema: obj(
      { title: str, description: str, propertyId: str, priority: { type: "string", enum: ["NIEDRIG", "MITTEL", "HOCH"] } },
      ["title"],
    ),
    run: (p, a) =>
      data.createTicket(p.tenantId, {
        title: String(a.title),
        description: a.description ? String(a.description) : undefined,
        propertyId: a.propertyId ? String(a.propertyId) : undefined,
        priority: a.priority ? String(a.priority) : undefined,
      }),
  },
  {
    name: "create_person",
    description: "Neue Person/Kontakt anlegen (z. B. Interessent).",
    inputSchema: obj(
      { firstName: str, lastName: str, email: str, phone: str, type: str },
      ["firstName", "lastName"],
    ),
    run: (p, a) =>
      data.createPerson(p.tenantId, {
        firstName: String(a.firstName),
        lastName: String(a.lastName),
        email: a.email ? String(a.email) : undefined,
        phone: a.phone ? String(a.phone) : undefined,
        type: a.type ? String(a.type) : undefined,
      }),
  },
];

const rpc = (id: unknown, result: unknown) => Response.json({ jsonrpc: "2.0", id, result });
const rpcError = (id: unknown, code: number, message: string) =>
  Response.json({ jsonrpc: "2.0", id, error: { code, message } });

export async function POST(req: Request) {
  const principal = await authenticateBearer(req);
  if (!principal) {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || body.jsonrpc !== "2.0") return rpcError(null, -32600, "Invalid Request");
  const { id, method, params } = body;

  // Notifications (keine Antwort erwartet)
  if (typeof method === "string" && method.startsWith("notifications/")) {
    return new Response(null, { status: 202 });
  }

  switch (method) {
    case "initialize":
      return rpc(id, {
        protocolVersion: params?.protocolVersion ?? PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: "HaVeWa", version: "1.0.0" },
      });
    case "ping":
      return rpc(id, {});
    case "tools/list":
      return rpc(id, {
        tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return rpcError(id, -32602, `Unbekanntes Tool: ${params?.name}`);
      try {
        const result = await tool.run(principal, params?.arguments ?? {});
        return rpc(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (e) {
        return rpc(id, {
          content: [{ type: "text", text: `Fehler: ${e instanceof Error ? e.message : "unbekannt"}` }],
          isError: true,
        });
      }
    }
    default:
      return rpcError(id, -32601, `Methode nicht unterstützt: ${method}`);
  }
}

// Manche Clients prüfen GET (SSE-Stream). Stateless → nicht unterstützt.
export function GET() {
  return new Response("MCP: bitte POST (JSON-RPC) verwenden.", { status: 405 });
}
