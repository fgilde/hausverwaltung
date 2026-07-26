# HaVeWa — Hausverwaltung

_🇬🇧 [English](README.md) · 🇩🇪 Deutsch_

Vollständige Immobilienverwaltungssoftware für **Miet- und WEG-Verwaltung**.
Mandantenfähig, rollenbasiert, zweisprachig (DE/EN).

## Funktionsumfang

Objekte/Einheiten/Personen/Zähler · Mietverwaltung (Verträge, Staffel-/Indexmiete,
Kaution) · Finanzen (Sollstellung, Zahlungen, offene Posten, SEPA-Mandate,
Mahnwesen, objektübergreifendes Mahn-Dashboard) · Betriebskostenabrechnung
(BetrKV, Verteilerschlüssel-Engine) · WEG (MEA, Wirtschaftsplan, Hausgeld,
Jahresabrechnung, Rücklagen, Vermögensbericht) · Eigentümerversammlung (Agenda,
Abstimmung, Beschlusssammlung §24) · Dokumente (GoBD, E-Rechnung) · Instandhaltung
(Tickets mit Workflow/Zeiterfassung, Handwerker, Wartung) · Verwalterhonorar ·
Kautionskonten · Vorlagen/Serienbriefe · benutzerdefinierte Felder · Report-Manager ·
Versicherungen · Grundsteuer · Zensus · Mieter-/Eigentümer-Portale ·
camt.053-Import + DATEV-/SEPA-Export · Kalender · E-Mail-Postausgang · Dashboard.

## Tech-Stack

Next.js 16 (App Router) · TypeScript · PostgreSQL · Prisma · shadcn/ui + Tailwind ·
next-intl · Auth.js · Vitest.

## Lokale Entwicklung

Voraussetzungen: Node 20+, Docker (für Postgres).

```bash
npm install
cp .env.example .env        # DATABASE_URL zeigt auf localhost:5432
npm run db:up               # Postgres via docker-compose.yml
npm run db:migrate          # Migrationen anwenden
npm run dev                 # http://localhost:3000
```

## Ersteinrichtung — mit oder ohne Demo-Daten

Nach `db:migrate` ist die Datenbank leer (keine Benutzer). Beim ersten Aufruf
erscheint automatisch ein **Setup-Assistent** (`/setup`), der den ersten Mandanten
und den Administrator anlegt (inkl. optionaler Theme-Farbe). Danach ist der
Assistent gesperrt.

- **Ohne Demo-Daten (Produktion):** nur `db:migrate`, dann Setup-Assistent durchlaufen.
- **Mit Demo-Daten (zum Ausprobieren):** zusätzlich `npm run db:seed` —
  legt einen Muster-Mandanten samt Objekten und drei Demo-Logins an:

| Rolle | E-Mail | Passwort | Bereich |
|---|---|---|---|
| Administrator | `admin@havewa.app` | `admin` | Verwalter-App (Vollzugriff) |
| Mieter | `mieter@havewa.app` | `mieter` | Mieter-Portal (`/portal`) |
| Eigentümer | `eigentuemer@havewa.app` | `eigentuemer` | Eigentümer-Portal (`/portal`) |

Weitere Zugänge legt der Administrator unter **Einstellungen → Benutzer** an.

## Konfiguration (KI, E-Mail, Branding)

Unter **Einstellungen** (nur Administrator) pro Mandant: KI-Assistent (Claude),
SMTP-Postausgang sowie **Theme-Farbe und Logo** der App. Ohne KI-Schlüssel liefert
der Assistent eine regelbasierte Zusammenfassung; ohne SMTP wird der Postausgang
nur lokal geführt. Alternativ greifen die Adapter auf `ANTHROPIC_API_KEY`,
`SMTP_HOST` etc. aus der Umgebung zurück.

## Scripts

| Script | Zweck |
|---|---|
| `npm run dev` | Dev-Server |
| `npm run build` / `npm start` | Produktions-Build / -Start |
| `npm test` | Vitest (Engine, Abrechnung, Validierung …) |
| `npm run db:up` | Postgres-Container (lokal) |
| `npm run db:migrate` | Prisma-Migration (dev) |
| `npm run db:seed` | Demo-Daten (optional) |
| `npm run db:studio` | Prisma Studio |

## Deployment (VPS + Docker)

Ein Server mit Docker: Caddy (automatisches HTTPS) + App + Postgres per Compose.
Voraussetzung: Domain mit DNS-A-Record auf den Server, Ports **80 + 443** offen.

```bash
git clone https://github.com/fgilde/hausverwaltung.git && cd hausverwaltung
cp .env.prod.example .env    # DB_PASSWORD, AUTH_SECRET (openssl rand -base64 32), DOMAIN
docker compose -f docker-compose.prod.yml up -d --build
```

Migrationen laufen beim Container-Start automatisch. Persistenz über die Volumes
`havewa-db`, `havewa-storage` (Dokumente/Logo) und `caddy-data` (Zertifikate).
Erste Einrichtung anschließend über den Setup-Assistenten unter `https://<DOMAIN>/setup`.

## Bekannte Vereinfachungen

`ponytail:`-Kommentare im Code: HeizkostenV-Verbrauchsumlage fällt mangels
Zählerintegration auf Fläche zurück · DATEV-Export ist vereinfachtes CSV · das
zeitabhängige Flächenmodell (`docs/flaechenmodell.md`) ist als Entwurf spezifiziert,
aber noch nicht implementiert.
