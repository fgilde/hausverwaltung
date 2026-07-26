// OpenAPI 3.1 Beschreibung der HaVeWa REST-API. Öffentlich (keine Geheimnisse),
// dient Scalar/Swagger als Referenz.

const listOp = (tag: string, summary: string) => ({
  tags: [tag],
  summary,
  security: [{ bearerAuth: [] }],
  responses: { "200": { description: "OK" }, "401": { description: "Unauthorized" } },
});

const spec = {
  openapi: "3.1.0",
  info: {
    title: "HaVeWa API",
    version: "1.0.0",
    description:
      "REST-API der Hausverwaltungssoftware HaVeWa. Authentifizierung per Bearer-Token " +
      "(persönlicher Zugangstoken aus den Einstellungen). Alle Daten sind auf den Mandanten des Tokens beschränkt.",
  },
  servers: [{ url: "/" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", description: "Persönlicher API-Token (Einstellungen → API- & MCP-Zugänge)" },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/api/v1/me": {
      get: { tags: ["Allgemein"], summary: "Eigene Info + Portfolio-Kennzahlen", security: [{ bearerAuth: [] }], responses: { "200": { description: "OK" }, "401": { description: "Unauthorized" } } },
    },
    "/api/v1/properties": { get: listOp("Objekte", "Objekte auflisten") },
    "/api/v1/properties/{id}": {
      get: {
        tags: ["Objekte"],
        summary: "Objekt mit Gebäuden & Einheiten",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" }, "404": { description: "Not found" } },
      },
    },
    "/api/v1/units": { get: listOp("Einheiten", "Einheiten auflisten") },
    "/api/v1/meters": { get: listOp("Einheiten", "Zähler + letzter Stand auflisten") },
    "/api/v1/owners": { get: listOp("Einheiten", "Eigentümer-Zuordnungen auflisten") },
    "/api/v1/leases": { get: listOp("Verträge", "Mietverträge auflisten") },
    "/api/v1/open-items": { get: listOp("Finanzen", "Offene Posten auflisten") },
    "/api/v1/accounts": { get: listOp("Finanzen", "Konten + Saldo auflisten") },
    "/api/v1/charges": { get: listOp("Finanzen", "Sollstellungen auflisten") },
    "/api/v1/payments": { get: listOp("Finanzen", "Zahlungen auflisten") },
    "/api/v1/documents": { get: listOp("Dokumente", "Dokumente auflisten") },
    "/api/v1/meetings": { get: listOp("Versammlung", "Eigentümerversammlungen auflisten") },
    "/api/v1/resolutions": { get: listOp("Versammlung", "Beschlusssammlung auflisten") },
    "/api/v1/economic-plans": { get: listOp("WEG", "Wirtschaftspläne auflisten") },
    "/api/v1/reserves": { get: listOp("WEG", "Erhaltungsrücklagen + Saldo auflisten") },
    "/api/v1/appointments": { get: listOp("Kalender", "Termine auflisten") },
    "/api/v1/contractors": { get: listOp("Instandhaltung", "Handwerker/Dienstleister auflisten") },
    "/api/v1/maintenance-contracts": { get: listOp("Instandhaltung", "Wartungsverträge auflisten") },
    "/api/v1/insurances": { get: listOp("Weitere", "Versicherungen auflisten") },
    "/api/v1/property-taxes": { get: listOp("Weitere", "Grundsteuer auflisten") },
    "/api/v1/operations": {
      get: {
        tags: ["Operationen"],
        summary: "Verfügbare Operationen (kein reines CRUD)",
        description:
          "Sollstellungslauf, Mahnlauf, Mietanpassung anwenden, Wartung fortschreiben, Zeiterfassung, " +
          "Bank-Import (camt.053), E-Mail senden, Dokument-Upload, KI-/SMTP-Konfiguration. " +
          "Ausführen: POST /api/v1/operations/{name} mit den Parametern im Body.",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "OK" }, "401": { description: "Unauthorized" } },
      },
    },
    "/api/v1/operations/{name}": {
      post: {
        tags: ["Operationen"],
        summary: "Operation ausführen",
        description: "name z. B. run_charge_generation, run_dunning, apply_adjustment, send_email, import_camt, upload_document …",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "name", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { content: { "application/json": { schema: { type: "object", additionalProperties: true } } } },
        responses: { "200": { description: "OK" }, "400": { description: "Bad request" }, "403": { description: "Forbidden" }, "404": { description: "Not found" } },
      },
    },
    "/api/v1/records": {
      get: {
        tags: ["Schreiben"],
        summary: "Schema-Discovery: schreibbare Entitäten + Felder",
        description:
          "Generische Schreibschicht. Liefert alle Entitäten mit Feldnamen und Relationen. " +
          "Anlegen: POST /api/v1/records/{entity}. Ändern: PATCH /api/v1/records/{entity}/{id}. Löschen: DELETE …",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "OK" }, "401": { description: "Unauthorized" } },
      },
    },
    "/api/v1/records/{entity}": {
      post: {
        tags: ["Schreiben"],
        summary: "Datensatz anlegen (generisch)",
        description: "entity z. B. property, unit, person, lease, charge, payment, meeting, resolution, insurance, user …",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "entity", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: true } } } },
        responses: { "201": { description: "Created" }, "400": { description: "Bad request" }, "403": { description: "Forbidden" } },
      },
    },
    "/api/v1/records/{entity}/{id}": {
      patch: {
        tags: ["Schreiben"],
        summary: "Datensatz ändern (generisch)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "entity", in: "path", required: true, schema: { type: "string" } },
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: true } } } },
        responses: { "200": { description: "OK" }, "404": { description: "Not found" }, "405": { description: "Nicht aktualisierbar" } },
      },
      delete: {
        tags: ["Schreiben"],
        summary: "Datensatz löschen (generisch)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "entity", in: "path", required: true, schema: { type: "string" } },
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "OK" }, "404": { description: "Not found" } },
      },
    },
    "/api/v1/tasks": {
      get: listOp("Aufgaben", "Aufgaben auflisten"),
      post: {
        tags: ["Aufgaben"],
        summary: "Aufgabe anlegen",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: { title: { type: "string" }, dueDate: { type: "string", format: "date" } },
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, "400": { description: "Bad request" } },
      },
    },
    "/api/v1/persons": {
      get: listOp("Personen", "Personen auflisten"),
      post: {
        tags: ["Personen"],
        summary: "Person anlegen",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["firstName", "lastName"],
                properties: {
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                  type: { type: "string", enum: ["MIETER", "EIGENTUEMER", "INTERESSENT", "HANDWERKER", "MAKLER", "BANK", "SONSTIGE"] },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, "400": { description: "Bad request" } },
      },
    },
    "/api/v1/tickets": {
      get: listOp("Instandhaltung", "Tickets auflisten"),
      post: {
        tags: ["Instandhaltung"],
        summary: "Ticket anlegen",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  propertyId: { type: "string" },
                  priority: { type: "string", enum: ["NIEDRIG", "MITTEL", "HOCH"] },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, "400": { description: "Bad request" } },
      },
    },
  },
};

export function GET() {
  return Response.json(spec);
}
