#!/usr/bin/env bash
# HaVeWa auf Proxmox VE — legt einen Debian-12-LXC an, installiert Docker und
# startet HaVeWa + PostgreSQL via Compose (vorgebautes GHCR-Image).
#
# Auf dem PVE-HOST als root ausführen:
#   bash -c "$(wget -qO- https://raw.githubusercontent.com/fgilde/hausverwaltung/main/deploy/proxmox/install.sh)"
#
# Überschreibbar per Env: CTID, HOSTNAME, DISK_GB, RAM_MB, CORES, BRIDGE, STORAGE, PORT
set -euo pipefail

CTID="${CTID:-$(pvesh get /cluster/nextid)}"
HOSTNAME="${HOSTNAME:-havewa}"
DISK_GB="${DISK_GB:-8}"
RAM_MB="${RAM_MB:-2048}"
CORES="${CORES:-2}"
BRIDGE="${BRIDGE:-vmbr0}"
STORAGE="${STORAGE:-local-lvm}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"
PORT="${PORT:-3000}"
SEED_DEMO="${SEED_DEMO:-true}"

echo "==> HaVeWa Proxmox-Installer — CTID=$CTID Host=$HOSTNAME"

# Debian-12-Template sicherstellen
TEMPLATE=$(pveam available --section system 2>/dev/null | awk '/debian-12-standard/{print $2}' | sort | tail -1)
if ! pveam list "$TEMPLATE_STORAGE" 2>/dev/null | grep -q "$TEMPLATE"; then
  echo "==> Lade Template $TEMPLATE ..."
  pveam update >/dev/null 2>&1 || true
  pveam download "$TEMPLATE_STORAGE" "$TEMPLATE"
fi
TPL_REF="${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}"

# Unprivilegierten Container anlegen (nesting=1 für Docker)
echo "==> Erstelle LXC $CTID ..."
pct create "$CTID" "$TPL_REF" \
  --hostname "$HOSTNAME" \
  --cores "$CORES" --memory "$RAM_MB" --swap 512 \
  --rootfs "${STORAGE}:${DISK_GB}" \
  --net0 "name=eth0,bridge=${BRIDGE},ip=dhcp" \
  --features nesting=1,keyctl=1 \
  --unprivileged 1 --onboot 1
pct start "$CTID"

echo "==> Warte auf Netzwerk ..."
for _ in $(seq 1 30); do
  IP=$(pct exec "$CTID" -- bash -c "hostname -I 2>/dev/null | awk '{print \$1}'" || true)
  [ -n "${IP:-}" ] && break
  sleep 2
done

# Docker + Compose-Plugin im Container
echo "==> Installiere Docker im Container ..."
pct exec "$CTID" -- bash -lc '
  set -e
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl openssl >/dev/null
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin >/dev/null
  systemctl enable --now docker >/dev/null 2>&1 || true
'

# Compose auf dem Host bauen und in den Container schieben (kein verschachteltes Quoting)
echo "==> Konfiguriere HaVeWa ..."
TMP_COMPOSE=$(mktemp)
cat > "$TMP_COMPOSE" <<'YAML'
services:
  app:
    image: ghcr.io/fgilde/hausverwaltung:latest
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: "postgresql://havewa:${DB_PASSWORD}@db:5432/havewa?schema=public"
      AUTH_SECRET: "${AUTH_SECRET}"
      AUTH_TRUST_HOST: "true"
      SEED_DEMO: "${SEED_DEMO}"
    ports:
      - "${PORT}:3000"
    volumes:
      - havewa-storage:/app/storage
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: havewa
      POSTGRES_PASSWORD: "${DB_PASSWORD}"
      POSTGRES_DB: havewa
    volumes:
      - havewa-db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U havewa"]
      interval: 10s
      timeout: 5s
      retries: 10
volumes:
  havewa-db:
  havewa-storage:
YAML
pct exec "$CTID" -- mkdir -p /opt/havewa
pct push "$CTID" "$TMP_COMPOSE" /opt/havewa/docker-compose.yml
rm -f "$TMP_COMPOSE"

# .env im Container erzeugen (Secrets dort würfeln), dann starten
pct exec "$CTID" -- bash -lc '
  set -e
  cd /opt/havewa
  if [ ! -f .env ]; then
    {
      echo "DB_PASSWORD=$(openssl rand -hex 24)"
      echo "AUTH_SECRET=$(openssl rand -base64 32)"
      echo "SEED_DEMO='"$SEED_DEMO"'"
      echo "PORT='"$PORT"'"
    } > .env
  fi
  docker compose pull -q && docker compose up -d
'

echo ""
echo "==> Fertig. HaVeWa läuft auf: http://${IP:-<container-ip>}:${PORT}"
[ "$SEED_DEMO" = "true" ] && echo "    Demo-Login: admin@havewa.app / admin"
echo "    Update:  pct exec $CTID -- bash -lc 'cd /opt/havewa && docker compose pull && docker compose up -d'"
