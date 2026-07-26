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
    "/api/v1/leases": { get: listOp("Verträge", "Mietverträge auflisten") },
    "/api/v1/open-items": { get: listOp("Finanzen", "Offene Posten auflisten") },
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
