#!/usr/bin/env bash
# HaVeWa on a Debian machine: PostgreSQL from the distribution, Node from NodeSource, the app built
# from its newest tag, a systemd unit and a database password nobody has to invent.
#
# Runs on its own as well as from havewa.sh, which is what makes it testable by hand -- on a plain
# Debian VM, in an LXC container, on a Raspberry Pi:
#
#   curl -fsSL https://raw.githubusercontent.com/fgilde/hausverwaltung/main/deploy/proxmox/install.sh | bash
#
# No Docker. Docker inside an unprivileged LXC container starts nothing on a current Proxmox: runc
# writes net.ipv4.ip_unprivileged_port_start and /proc/sys is read-only in there, so even hello-world
# fails. A privileged container would fix that by handing the container root on the host, which is a
# poor trade for two processes Debian ships anyway.
#
# Idempotent: run it again and it builds the current tag, keeps the database, the password, the
# uploaded documents and the port it already wrote, and restarts the service.
set -euo pipefail

PORT="${HAVEWA_PORT:-3010}"
INSTALL_DIR="/opt/havewa"
DATA_DIR="${HAVEWA_DATA_DIR:-/var/lib/havewa}"
ENV_FILE="/etc/havewa.env"
REPO="fgilde/hausverwaltung"
DB_NAME="havewa"
DB_USER="havewa"

note() { echo "==> $*"; }
die() { echo "havewa: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run as root"

export DEBIAN_FRONTEND=noninteractive
note "packages"
apt-get update -qq
# openssl is what the Prisma query engine wants; postgresql is the database this app cannot do without.
apt-get install -y -qq --no-install-recommends \
  ca-certificates curl gnupg git openssl tar postgresql >/dev/null

if ! command -v node >/dev/null 2>&1 || [ "$(node --version | sed 's/^v\([0-9]*\).*/\1/')" -lt 22 ]; then
  note "installing Node 24"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key |
    gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y -qq nodejs >/dev/null
fi

systemctl enable --now postgresql >/dev/null 2>&1 || true

# Generated once and kept in the env file, so a second run does not lock the app out of its own
# database.
DB_PASSWORD=""
if [ -f "$ENV_FILE" ]; then
  DB_PASSWORD="$(sed -n 's|.*postgresql://[^:]*:\([^@]*\)@.*|\1|p' "$ENV_FILE" | head -1)"
fi
[ -n "$DB_PASSWORD" ] || DB_PASSWORD="$(openssl rand -hex 24)"

note "database"
su postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'\"" | grep -q 1 ||
  su postgres -c "psql -qc \"CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}'\"" >/dev/null
su postgres -c "psql -qc \"ALTER ROLE ${DB_USER} PASSWORD '${DB_PASSWORD}'\"" >/dev/null
su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'\"" | grep -q 1 ||
  su postgres -c "createdb -O ${DB_USER} ${DB_NAME}" >/dev/null

note "fetching the newest tag"
TAG="$(curl -fsSL "https://api.github.com/repos/${REPO}/tags" |
  grep -o '"name": *"v[0-9][^"]*"' | head -1 | sed 's/.*"\(v[^"]*\)"$/\1/')"
[ -n "$TAG" ] || die "the repository has no version tag"

note "building ${TAG} (this takes a few minutes)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://github.com/${REPO}/archive/refs/tags/${TAG}.tar.gz" -o "$TMP/src.tar.gz"
mkdir -p "$TMP/src"
tar xzf "$TMP/src.tar.gz" -C "$TMP/src" --strip-components=1

# Built beside the running copy and swapped in at the end: a half-built application in the directory
# the service runs from is a service that restarts into a broken state.
BUILD_DIR="${INSTALL_DIR}.new"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR" "$DATA_DIR/storage/documents"
cp -a "$TMP/src/." "$BUILD_DIR/"
# The app writes uploads to ./storage; the link keeps them in the data directory, so an update
# replaces the code without taking the documents with it.
ln -sfn "$DATA_DIR/storage" "$BUILD_DIR/storage"

(
  cd "$BUILD_DIR"
  npm ci --no-audit --no-fund >/dev/null
  npx prisma generate >/dev/null
  NODE_ENV=production npm run build >/dev/null
)

id -u havewa >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin havewa

if [ ! -f "$ENV_FILE" ]; then
  note "writing the environment"
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=${PORT}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}?schema=public
# Signs the login sessions. Changing it logs everyone out.
AUTH_SECRET=$(openssl rand -base64 32)
AUTH_TRUST_HOST=true
# SEED_DEMO=true installs the demo data set with the admin account admin@havewa.app / admin.
# Left empty, the first visit opens the setup wizard instead.
SEED_DEMO=
ADMIN_EMAIL=
ADMIN_PASSWORD=
TENANT_NAME=
EOF
  chmod 640 "$ENV_FILE"
fi

note "migrating the database"
(
  cd "$BUILD_DIR"
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
  npx prisma migrate deploy >/dev/null
  npx tsx prisma/bootstrap.ts >/dev/null 2>&1 || true
)

systemctl stop havewa >/dev/null 2>&1 || true
rm -rf "${INSTALL_DIR}.old"
[ -d "$INSTALL_DIR" ] && mv "$INSTALL_DIR" "${INSTALL_DIR}.old"
mv "$BUILD_DIR" "$INSTALL_DIR"
rm -rf "${INSTALL_DIR}.old"
chown -R havewa:havewa "$DATA_DIR" "$INSTALL_DIR"
chown root:havewa "$ENV_FILE"

note "writing the service"
cat > /etc/systemd/system/havewa.service <<EOF
[Unit]
Description=HaVeWa
After=network-online.target postgresql.service
Wants=network-online.target
Requires=postgresql.service

[Service]
Type=simple
User=havewa
Group=havewa
EnvironmentFile=${ENV_FILE}
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=${DATA_DIR}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable havewa >/dev/null 2>&1 || true
systemctl restart havewa

note "waiting for the app to answer"
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/"; then
    IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
    echo ""
    note "done (${TAG})"
    echo "    URL:      http://${IP:-127.0.0.1}:${PORT}"
    echo "    Account:  the first visit opens the setup wizard"
    echo "    Config:   ${ENV_FILE}"
    echo "    Service:  systemctl status havewa"
    echo "    Update:   run this script again"
    exit 0
  fi
  sleep 2
done

journalctl -u havewa --no-pager -n 30 || true
die "the service did not answer on port ${PORT}"
