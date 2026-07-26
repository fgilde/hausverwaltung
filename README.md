# HaVeWa — Property Management

_🇬🇧 English · 🇩🇪 [Deutsch](README.de.md)_

Complete property-management software for **rental and HOA (WEG) administration**.
Multi-tenant, role-based, bilingual (DE/EN).

## Features

Properties/units/people/meters · rental management (leases, stepped/index rent,
deposits) · finances (charges, payments, open items, SEPA mandates, dunning +
portfolio-wide dunning dashboard) · service-charge statements (BetrKV, allocation
engine) · HOA (co-ownership shares, economic plan, HOA fees, annual statement,
reserves, asset report) · owners' meetings (agenda, voting, §24 resolution
collection) · documents (GoBD, e-invoice) · maintenance (tickets with
workflow/time-tracking, contractors, service intervals) · management fees ·
deposit accounts · templates/mail merge · custom fields · report manager ·
insurance · property tax · census · tenant/owner portals · camt.053 import +
DATEV/SEPA export · calendar · outbox · dashboard · **REST API + MCP server for AI
agents** (per-user tokens).

## Tech stack

Next.js 16 (App Router) · TypeScript · PostgreSQL · Prisma · shadcn/ui + Tailwind ·
next-intl · Auth.js · OpenAPI 3.1 + Scalar · Vitest.

## Local development

Requirements: Node 20+, Docker (for Postgres).

```bash
npm install
cp .env.example .env        # DATABASE_URL points to localhost:5432
npm run db:up               # Postgres via docker-compose.yml
npm run db:migrate          # apply migrations
npm run dev                 # http://localhost:3000
```

## First-run setup — with or without demo data

After `db:migrate` the database is empty (no users). On first visit a **setup
wizard** (`/setup`) appears automatically and creates the first tenant and the
administrator (including an optional theme colour). Afterwards the wizard is locked.

- **Without demo data (production):** run only `db:migrate`, then complete the wizard.
- **With demo data (to try it out):** additionally run `npm run db:seed` — creates
  a sample tenant with properties and three demo logins:

| Role | Email | Password | Area |
|---|---|---|---|
| Administrator | `admin@havewa.app` | `admin` | Manager app (full access) |
| Tenant | `mieter@havewa.app` | `mieter` | Tenant portal (`/portal`) |
| Owner | `eigentuemer@havewa.app` | `eigentuemer` | Owner portal (`/portal`) |

Further accounts are created by the administrator under **Settings → Users**.

> In Docker you can skip the wizard and pre-provision tenant + admin (or seed demo
> data) via environment variables — see [Optional first-run bootstrap](#optional-first-run-bootstrap-all-optional).

## Configuration (AI, email, branding)

**Settings** is organised into tabs (General · AI & API · Email · Users · Advanced),
per tenant, admin only:

- **AI assistant** — provider is selectable: **Anthropic (Claude)** or any
  **OpenAI-compatible** endpoint (OpenAI, OpenRouter, Groq, Ollama, …) via base URL +
  model. Without a key the assistant returns a rule-based summary.
- **Email** — SMTP outbox; without SMTP the outbox is kept locally only.
- **Branding** — tenant name, theme colour and logo.

Adapters also fall back to `ANTHROPIC_API_KEY`, `SMTP_HOST`, etc. from the environment.

## API & MCP (for integrations and AI agents)

Every user creates personal **API tokens** under **Settings → AI & API** (an admin
can also issue tokens for other users). Authenticate with `Authorization: Bearer <token>`.

- **REST API** at `/api/v1` — read + write across all modules (properties, units,
  leases, finances, meetings, resolutions, documents, WEG plans, insurance, tax …),
  plus operations (charge run, dunning run, apply rent adjustment, bank import,
  send email, upload document …). Interactive reference (Scalar) at `/api-reference`,
  OpenAPI spec at `/api/v1/openapi.json`.
- **MCP server** (Model Context Protocol) at `/api/mcp` — connect Claude Desktop,
  ChatGPT or any MCP client so an AI can read **and manage** the portfolio. The exact
  URLs and a ready-to-paste client config are shown under **Settings → AI & API**.

Tokens are stored hashed (only a `hvw_…` prefix is kept); writes require a writing
role, config operations require admin. All access is scoped to the token's tenant.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / start |
| `npm test` | Vitest (engine, statements, validation …) |
| `npm run db:up` | Postgres container (local) |
| `npm run db:migrate` | Prisma migration (dev) |
| `npm run db:seed` | Demo data (optional) |
| `npm run db:studio` | Prisma Studio |

## Project structure

```
prisma/schema.prisma          data model + migrations
messages/{de,en}.json         translations (new language = new file)
src/
  app/[locale]/(admin)/...     manager app (internal roles)
  app/[locale]/portal/...      tenant/owner portal
  app/[locale]/setup/...       first-run setup wizard
  app/api/v1/...               REST API v1 (Bearer) incl. records + operations
  app/api/mcp/                 MCP server (JSON-RPC, Bearer)
  app/api-reference/           Scalar API reference
  app/api/...                  auth, downloads, exports, logo
  lib/allocation/              allocation engine (shared rental + HOA)
  lib/adapters/                camt.053 / DATEV / SEPA / e-invoice / mailer
  lib/api-data.ts              shared read layer (REST + MCP)
  lib/api-write.ts             generic CRUD write layer (REST + MCP)
  lib/api-ops.ts               operations (charge/dunning run, apply adjustment …)
  lib/storage.ts               file storage (documents, logo)
  server/actions/              server actions per module (tenant-scoped, RBAC)
  components/                  UI + form dialogs
```

## Persistence

- **Database**: PostgreSQL (Prisma). Local Docker volume `havewa-db`.
- **Files** (documents, logo): filesystem under `storage/` (volume in production),
  wrapped in `src/lib/storage.ts` — swap that one file for object storage (S3/Blob).

## Deployment (VPS + Docker)

A single server with Docker: Caddy (automatic HTTPS via Let's Encrypt) + app +
Postgres via Compose. Requires a domain with a DNS A record and ports **80 + 443**.

```bash
git clone https://github.com/fgilde/hausverwaltung.git && cd hausverwaltung
cp .env.prod.example .env    # DB_PASSWORD, AUTH_SECRET (openssl rand -base64 32), DOMAIN
docker compose -f docker-compose.prod.yml up -d --build
```

Migrations run automatically on container start. Persistence via the volumes
`havewa-db`, `havewa-storage` (documents/logo) and `caddy-data` (certificates).
Then do the first-run setup at `https://<DOMAIN>/setup`.

**Prebuilt image (faster):** every push to `main` builds and publishes an image to
`ghcr.io/fgilde/hausverwaltung:latest` (GitHub Actions). Deploy without building on
the server via `docker-compose.registry.yml`:

```bash
docker compose -f docker-compose.registry.yml pull
docker compose -f docker-compose.registry.yml up -d
```

### Environment variables (production)

| Variable | Description |
|---|---|
| `DB_PASSWORD` | Postgres password (Compose builds `DATABASE_URL` from it) |
| `AUTH_SECRET` | Session secret (`openssl rand -base64 32`) |
| `DOMAIN` | Domain for Caddy/HTTPS (DNS must point to the server) |

#### Optional first-run bootstrap (all optional)

Applied once at container start while the system is still empty:

| Variable | Effect |
|---|---|
| `SEED_DEMO=true` | Seed the demo dataset (admin `admin@havewa.app` / `admin`). `ADMIN_*`/`TENANT_NAME` are ignored. |
| `ADMIN_EMAIL` + `ADMIN_PASSWORD` | Create the tenant + admin directly — **the setup wizard is skipped**. |
| `ADMIN_NAME` | Admin display name (default `Admin`). |
| `TENANT_NAME` | Tenant name (default `HaVeWa`). |

If none are set, the setup wizard appears on first login (unchanged).

## Known simplifications

Marked with `ponytail:` comments in the code: HeizkostenV consumption allocation
falls back to area without meter integration · DATEV export is simplified CSV · the
time-based area model (`docs/flaechenmodell.md`) is specified as a draft but not yet
implemented.
