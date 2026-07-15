# HaVeWa — Hausverwaltungssoftware · Design & Roadmap

_Stand: 2026-07-14 · Status: in Umsetzung_

## Ziel

Vollständige Immobilienverwaltungssoftware für **Miet- UND WEG-Verwaltung**,
i18n DE/EN (erweiterbar), moderne UI, Self-Service-Portale für Mieter/Eigentümer.
Iterativer Aufbau über mehrere Phasen bis zum vollen Funktionsumfang.

## Stack

Next.js 15 (App Router) · TypeScript · PostgreSQL (Docker) · Prisma · shadcn/ui +
Tailwind · next-intl · Auth.js · Zod · Vitest.

## Architektur-Prinzipien

- **Mandantenfähig**: jede Zeile `tenantId`, Row-Level-Scoping in jeder Query.
- **RBAC**: `ADMIN, VERWALTER, BUCHHALTUNG, BEIRAT, EIGENTUEMER, MIETER, HANDWERKER`.
- **Allocation-Engine** (`lib/allocation`): ein Verteilerschlüssel-Modell
  (Fläche/Personen/Einheiten/MEA/Verbrauch/Custom), zeitanteilig bei Wechsel.
  Miet-NK-Abrechnung UND WEG-Jahresabrechnung nutzen dieselbe Engine.
- **Adapter-Pattern** für externe Gateways (`lib/adapters`): `BankImport` (camt.053),
  `DatevExport`, `ERechnung` (XRechnung/ZUGFeRD) — Interface + Datei-Stub, Live-Anbindung später.
- **Audit-Log** (GoBD): unveränderliche Historie auf Finanz-/Beleg-Entitäten.

## Datenmodell-Kern

| Gruppe | Entitäten |
|---|---|
| Basis | Tenant, User, Role, AuditLog, Document |
| Objekt | Property, Building, Unit, Meter, MeterReading |
| Personen | Person, Owner, Renter, Contractor |
| Miet | Lease, RentComponent, RentAdjustment (Staffel/Index), Deposit |
| WEG | Community, OwnershipShare (MEA), EconomicPlan, Meeting, Resolution, Reserve |
| Finanzen | Account, Booking, Charge, Payment, SepaMandate, DunningNotice |
| Abrechnung | AllocationKey, CostType, Statement, StatementLine |
| Betrieb | Ticket, MaintenanceContract, Task, MessageThread |

## Roadmap (Phasen — je Phase eigener Plan)

1. **Fundament**: Scaffold, Prisma-Kern-Schema, i18n DE/EN, Auth + RBAC, Mandant,
   App-Shell/Navigation, Dashboard, Seed-Daten. → *lauffähig*
2. **Objekte & Personen**: Property/Building/Unit-CRUD, Personen, Zähler.
3. **Mietverwaltung**: Verträge, Miet-Komponenten, Staffel/Index, Kaution.
4. **Finanzen-Kern**: Konten, Sollstellung, Zahlungen, OP, SEPA-Mandate, Mahnwesen.
5. **Allocation-Engine + NK-Abrechnung** (BetrKV/HeizkostenV, CO2KostAufG).
6. **WEG**: MEA, Wirtschaftsplan, Hausgeld, Jahresabrechnung, Rücklagen, Vermögensbericht.
7. **Versammlung**: Einladung, Abstimmung, Protokoll, Beschlusssammlung §24.
8. **Dokumente (GoBD)** + E-Rechnung-Empfang.
9. **Instandhaltung/Tickets** + Handwerker + Wartungsfristen.
10. **Portale** Mieter/Eigentümer (Self-Service, Dokumente, Meldungen, Zahlungen).
11. **Bankanbindung live** (camt.053/pain) + **DATEV-Export** live.
12. **Reporting/Dashboard** Ausbau, Aufgaben/Fristen, KI-Features.

## Compliance-Anker (über Phasen)

BetrKV · HeizkostenV · CO2KostAufG · WEG/WEMoG (Vermögensbericht, Erhaltungsrücklage,
Abrechnungsspitze, Beschlusssammlung) · BGB Mietrecht §§556–560/557a/b/558/559 ·
DSGVO · GoBD · SEPA/camt.053 · DATEV · E-Rechnung (XRechnung/ZUGFeRD).

## Phase 1 — Fundament (dieser Build)

**Deliverables:**
- Next.js-App scaffolded, läuft lokal (`npm run dev`).
- `docker-compose.yml` mit Postgres; `.env` Vorlage.
- Prisma-Schema mit Kern-Entitäten (mind. Tenant, User, Role, Property, Building,
  Unit, Person, Owner, Renter) + Migration + Seed (1 Mandant, Demo-Objekt, User).
- i18n DE/EN via next-intl, Sprachumschalter, `messages/{de,en}.json`.
- Auth.js Credentials-Login + RBAC-Middleware + Mandanten-Scoping-Helper.
- App-Shell: Sidebar-Navigation, Header (User, Sprache, Mandant), Theme (hell/dunkel).
- Dashboard mit Kennzahlen-Kacheln (Objekte, Einheiten, Leerstand — aus Seed).
- Vitest-Setup + ein Test der Allocation-Engine-Signatur/RBAC-Helper.

**Nicht in Phase 1:** echte Finanzbuchungen, Abrechnungslogik-Vollausbau,
Live-Gateways, Portal-Funktionsfülle (Portal-Route existiert, aber minimal).

## Tests

Vitest, assert-basiert. Kern-Logik (Allocation-Engine, Mandanten-Scoping,
RBAC-Guards) bekommt Tests. Kein Framework-Overkill.
