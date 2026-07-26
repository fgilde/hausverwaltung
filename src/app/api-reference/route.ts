import { ApiReference } from "@scalar/nextjs-api-reference";

// Scalar API-Referenz unter /api-reference (rendert /api/v1/openapi.json).
export const GET = ApiReference({
  url: "/api/v1/openapi.json",
  theme: "default",
  metaData: { title: "HaVeWa API-Referenz" },
});
