import { auth } from "@/auth";

// CSV-Vorlagen für den Import (#33): zeigen die erwartete Spaltenstruktur mit
// einer Beispielzeile. Deutsche Header werden vom Import ebenfalls akzeptiert.
const TEMPLATES: Record<string, string> = {
  person: "firstName,lastName,email,phone,type,note\nMax,Mustermann,max@example.de,+49 30 1234,MIETER,\n",
  property: "name,street,zip,city,type,management\nBeispielobjekt,Hauptstr. 1,12345,Berlin,WOHNEN,MIET\n",
  unit: "property,building,label,type,area,rooms,mea\nBeispielobjekt,Haupthaus,Whg 1,WOHNUNG,60,3,\n",
};

export async function GET(_req: Request, { params }: { params: Promise<{ entity: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const { entity } = await params;
  const csv = TEMPLATES[entity];
  if (!csv) return new Response("Not found", { status: 404 });
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="havewa-${entity}-template.csv"`,
    },
  });
}
