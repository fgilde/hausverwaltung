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
camt.053-Import + DATEV-/SEPA-Export · Kalender · E-Mail-Postausgang · Dashboard ·
**REST-API + MCP-Server für KI-Agenten** (Token je Benutzer).

## Tech-Stack

Next.js 16 (App Router) · TypeScript · PostgreSQL · Prisma · shadcn/ui + Tailwind ·
next-intl · Auth.js · OpenAPI 3.1 + Scalar · Vitest.

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

> Im Docker-Betrieb lässt sich der Wizard überspringen und Mandant + Admin (oder
> Demo-Daten) per Umgebungsvariablen vorbelegen — siehe [Optionaler Bootstrap beim
> ersten Start](#optionaler-bootstrap-beim-ersten-start-alles-optional).

## Konfiguration (KI, E-Mail, Branding)

**Einstellungen** ist in Tabs gegliedert (Allgemein · KI & API · E-Mail · Benutzer ·
Erweitert), pro Mandant, nur Administrator:

- **KI-Assistent** — Anbieter wählbar: **Anthropic (Claude)** oder ein beliebiger
  **OpenAI-kompatibler** Endpunkt (OpenAI, OpenRouter, Groq, Ollama …) via Base-URL +
  Modell. Ohne Schlüssel liefert der Assistent eine regelbasierte Zusammenfassung.
- **E-Mail** — SMTP-Postausgang; ohne SMTP wird nur lokal geführt.
- **Branding** — Mandantenname, Theme-Farbe und Logo.

Alternativ greifen die Adapter auf `ANTHROPIC_API_KEY`, `SMTP_HOST` etc. aus der
Umgebung zurück.

## API & MCP (für Integrationen und KI-Agenten)

Jeder Benutzer erzeugt persönliche **API-Tokens** unter **Einstellungen → KI & API**
(ein Admin kann auch Token für andere Benutzer ausstellen). Authentifizierung per
`Authorization: Bearer <token>`.

- **REST-API** unter `/api/v1` — Lesen + Schreiben über alle Module (Objekte,
  Einheiten, Verträge, Finanzen, Versammlungen, Beschlüsse, Dokumente, WEG-Pläne,
  Versicherung, Grundsteuer …) plus Operationen (Sollstellungslauf, Mahnlauf,
  Mietanpassung anwenden, Bank-Import, E-Mail senden, Dokument-Upload …).
  Interaktive Referenz (Scalar) unter `/api-reference`, OpenAPI-Spec unter
  `/api/v1/openapi.json`.
- **MCP-Server** (Model Context Protocol) unter `/api/mcp` — Claude Desktop, ChatGPT
  oder beliebigen MCP-Client verbinden, damit eine KI den Bestand **lesen und
  verwalten** kann. Die genauen URLs und eine fertige Client-Konfiguration zum
  Kopieren stehen unter **Einstellungen → KI & API**.

Token werden gehasht gespeichert (nur ein `hvw_…`-Präfix bleibt sichtbar); Schreiben
erfordert eine Schreibrolle, Konfigurations-Operationen einen Admin. Aller Zugriff
ist auf den Mandanten des Tokens beschränkt.

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

#### Optionaler Bootstrap beim ersten Start (alles optional)

Wird einmalig beim Container-Start ausgeführt, solange das System noch leer ist:

| Variable | Wirkung |
|---|---|
| `SEED_DEMO=true` | Demo-Datensatz einspielen (Admin `admin@havewa.app` / `admin`). `ADMIN_*`/`TENANT_NAME` werden ignoriert. |
| `ADMIN_EMAIL` + `ADMIN_PASSWORD` | Mandant + Admin direkt anlegen — **der Wizard entfällt**. |
| `ADMIN_NAME` | Anzeigename des Admins (Standard `Admin`). |
| `TENANT_NAME` | Mandantenname (Standard `HaVeWa`). |

Ist nichts gesetzt, erscheint beim ersten Login der Setup-Assistent (wie bisher).

**Vorgebautes Image (schneller):** jeder Push auf `main` baut per GitHub Actions ein
Image nach `ghcr.io/fgilde/hausverwaltung:latest`. Deploy ohne Bauen auf dem Server
via `docker-compose.registry.yml`:

```bash
docker compose -f docker-compose.registry.yml pull
docker compose -f docker-compose.registry.yml up -d
```

## Heimserver-Installation (Unraid · Umbrel · Proxmox)

Fertige Deploy-Artefakte liegen in [`deploy/`](deploy/) und nutzen das vorgebaute
Image `ghcr.io/fgilde/hausverwaltung:latest`.

### Unraid

1. **Docker → Add Container → Template**, Vorlage laden von
   `https://raw.githubusercontent.com/fgilde/hausverwaltung/main/deploy/unraid/havewa.xml`
   (oder Datei nach `/boot/config/plugins/dockerMan/templates-user/` kopieren).
2. **PostgreSQL 16** aus den Community Applications installieren (`POSTGRES_USER=havewa`,
   `POSTGRES_DB=havewa`, Passwort setzen).
3. In der HaVeWa-Vorlage `DATABASE_URL` auf diese DB setzen, `AUTH_SECRET` erzeugen
   (`openssl rand -base64 32`), optional `SEED_DEMO=true`. Starten — WebUI auf Port `3000`.

### Umbrel

HaVeWa über einen Community-App-Store hinzufügen (App-Dateien in
[`deploy/umbrel/`](deploy/umbrel/)): in Umbrel den Store
`https://github.com/fgilde/hausverwaltung` (Ordner `deploy/umbrel`) hinzufügen, dann
HaVeWa installieren. Postgres, Secrets und Storage werden automatisch verdrahtet;
beim ersten Start kommen Demo-Daten (abschaltbar, indem `SEED_DEMO` in der Compose
entfernt wird).

### Proxmox VE

Auf dem **PVE-Host** als root ausführen — legt einen Debian-12-LXC an, installiert
Docker und startet HaVeWa + Postgres:

```bash
bash -c "$(wget -qO- https://raw.githubusercontent.com/fgilde/hausverwaltung/main/deploy/proxmox/install.sh)"
```

Anpassbar per Env (`CTID`, `RAM_MB`, `CORES`, `DISK_GB`, `BRIDGE`, `STORAGE`, `PORT`,
`SEED_DEMO`). Gibt am Ende die Container-URL aus; Update im Container mit
`docker compose pull && docker compose up -d`.

## Bekannte Vereinfachungen

`ponytail:`-Kommentare im Code: HeizkostenV-Verbrauchsumlage fällt mangels
Zählerintegration auf Fläche zurück · DATEV-Export ist vereinfachtes CSV · das
zeitabhängige Flächenmodell (`docs/flaechenmodell.md`) ist als Entwurf spezifiziert,
aber noch nicht implementiert.
