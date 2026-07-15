# HaVeWa — Hausverwaltung

Vollständige Immobilienverwaltungssoftware für **Miet- und WEG-Verwaltung**.
Mandantenfähig, rollenbasiert, zweisprachig (DE/EN).

## Funktionsumfang

Objekte/Einheiten/Personen/Zähler · Mietverwaltung (Verträge, Staffel-/Indexmiete,
Kaution) · Finanzen (Sollstellung, Zahlungen, offene Posten, SEPA-Mandate,
Mahnwesen) · Betriebskostenabrechnung (BetrKV, Verteilerschlüssel-Engine) ·
WEG (MEA, Wirtschaftsplan, Hausgeld, Jahresabrechnung, Rücklagen, Vermögensbericht) ·
Eigentümerversammlung (Agenda, Abstimmung, Beschlusssammlung §24) ·
Dokumente (GoBD, E-Rechnung) · Instandhaltung (Tickets, Handwerker, Wartung) ·
Mieter-/Eigentümer-Portale · camt.053-Import + DATEV-/SEPA-Export · Dashboard.

## Tech-Stack

Next.js 16 (App Router) · TypeScript · PostgreSQL · Prisma · shadcn/ui + Tailwind ·
next-intl · Auth.js · Vitest.

## Lokale Entwicklung

Voraussetzungen: Node 20+, Docker (für Postgres).

```bash
# 1. Abhängigkeiten
npm install

# 2. Umgebungsvariablen
cp .env.example .env        # DATABASE_URL zeigt auf localhost:5432

# 3. Datenbank starten
npm run db:up               # Postgres via docker-compose.yml

# 4. Schema + Demo-Daten
npm run db:migrate          # Migrationen anwenden
npm run db:seed             # Demo-Mandant + Logins

# 5. Dev-Server
npm run dev                 # http://localhost:3000
```

**Demo-Logins** (nach Seed): `admin@havewa.de / admin` (Verwalter),
`mieter@havewa.de / mieter`, `eigentuemer@havewa.de / eigentuemer` (Portale).

## Scripts

| Script | Zweck |
|---|---|
| `npm run dev` | Dev-Server |
| `npm run build` / `npm start` | Produktions-Build / -Start |
| `npm test` | Vitest (Allocation-Engine, Abrechnung, camt-Parser) |
| `npm run db:up` | Postgres-Container (lokal) |
| `npm run db:migrate` | Prisma-Migration (dev) |
| `npm run db:seed` | Demo-Daten |
| `npm run db:studio` | Prisma Studio |

## Projektstruktur

```
prisma/schema.prisma          Datenmodell + Migrationen
messages/{de,en}.json         Übersetzungen (neue Sprache = neue Datei)
src/
  app/[locale]/(admin)/...     Verwalter-App (interne Rollen)
  app/[locale]/portal/...      Mieter-/Eigentümer-Portal
  app/api/...                  Auth, Dokument-Download, Exporte
  lib/allocation/              Verteilerschlüssel-Engine (Miet + WEG geteilt)
  lib/adapters/                camt.053 / DATEV / SEPA / E-Rechnung
  lib/storage.ts               Datei-Ablage (Dokumente)
  server/actions/              Server Actions je Fachmodul (tenant-scoped, RBAC)
  components/                  UI + Formular-Dialoge
```

## Persistenz

- **Datenbank**: PostgreSQL (Prisma). Lokal im Docker-Volume `havewa-db`.
- **Dokumente**: Dateisystem unter `storage/documents/` (bzw. Volume in Produktion),
  gekapselt in `src/lib/storage.ts` — für Objektspeicher (S3/Blob) nur diese Datei tauschen.

## Deployment (VPS + Docker)

Ein einzelner Server mit Docker. App + Postgres + Volumes laufen per Compose.

```bash
# auf dem VPS
git clone https://github.com/fgilde/hausverwaltung.git
cd hausverwaltung

# Secrets setzen
cp .env.prod.example .env
#   DB_PASSWORD  = starkes Passwort
#   AUTH_SECRET  = openssl rand -base64 32

# Build + Start (Migrationen laufen automatisch beim Container-Start)
docker compose -f docker-compose.prod.yml up -d --build
```

- App: `http://<server>:3000` (davor idealerweise Reverse-Proxy wie Caddy/nginx für TLS).
- **Persistenz**: `havewa-db` (Datenbank) + `havewa-storage` (Dokumente) als Docker-Volumes.
- **Updates**: `git pull && docker compose -f docker-compose.prod.yml up -d --build`
  (Migrationen werden beim Start via `prisma migrate deploy` angewandt).
- **Demo-Daten** einmalig optional: `docker compose -f docker-compose.prod.yml exec app npx tsx prisma/seed.ts`

### Umgebungsvariablen (Produktion)

| Variable | Beschreibung |
|---|---|
| `DB_PASSWORD` | Postgres-Passwort (Compose baut daraus `DATABASE_URL`) |
| `AUTH_SECRET` | Session-Secret (`openssl rand -base64 32`) |

## Bekannte Vereinfachungen

Als `ponytail:`-Kommentare im Code markiert: HeizkostenV-Verbrauchsumlage fällt
mangels Zählerintegration auf Fläche zurück · DATEV-Export ist vereinfachtes CSV
(kein zertifiziertes EXTF) · E-Rechnung wird erkannt, aber XML-Felder noch nicht
geparst · KI-Features sind regelbasierte Hinweise (keine LLM-Anbindung).
