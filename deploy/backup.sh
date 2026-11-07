#!/usr/bin/env bash
# HaVeWa backup (#82): database, documents and configuration in one archive, with checksums,
# a manifest, and a test restore into a scratch database after every run.
#
#   backup.sh [create]          write a backup (default), then verify it
#   backup.sh verify FILE       checksums + test restore into a scratch database, row counts compared
#   backup.sh restore FILE      put a backup back (takes a safety backup first)
#   backup.sh restore FILE --with-config   also restore /etc/havewa.env (Proxmox/Debian install)
#
# Works on both installation types, detected on its own:
#   native  deploy/proxmox/install.sh (PostgreSQL + systemd, config in /etc/havewa.env)
#   docker  the compose files in this repo (containers havewa-app + havewa-db)
#
# Settings (environment):
#   HAVEWA_BACKUP_DIR       where archives go   (native: /var/lib/havewa/backups, docker: ./backups)
#   HAVEWA_BACKUP_KEEP      archives to keep    (14)
#   HAVEWA_BACKUP_PASSWORD  encrypts the archive with openssl (AES-256). The archive holds AUTH_SECRET
#                           and the database with all personal data: set this when it leaves the machine.
#   HAVEWA_BACKUP_VERIFY    0 skips the test restore after create
#   HAVEWA_MODE             native | docker     (auto)
#   HAVEWA_APP_CONTAINER / HAVEWA_DB_CONTAINER  (havewa-app / havewa-db)
#   HAVEWA_DB_USER / HAVEWA_DB_NAME             (havewa / havewa, docker only)
#   HAVEWA_COMPOSE_DIR      directory with .env and docker-compose*.yml to include (docker, current dir)
#
# Consistency: pg_dump is one snapshot; documents are copied right after it. Uploads get new unique
# names and are never changed in place, so every document the dump refers to is in the archive,
# unless it was deleted in the seconds between the two steps.
set -euo pipefail
umask 077

ENV_FILE="/etc/havewa.env"
DATA_DIR="${HAVEWA_DATA_DIR:-/var/lib/havewa}"
INSTALL_DIR="/opt/havewa"
APP_C="${HAVEWA_APP_CONTAINER:-havewa-app}"
DB_C="${HAVEWA_DB_CONTAINER:-havewa-db}"
KEEP="${HAVEWA_BACKUP_KEEP:-14}"
PASS="${HAVEWA_BACKUP_PASSWORD:-}"
VERIFY_DB="havewa_verify"
export PGOPTIONS="-c client_min_messages=warning" # no NOTICE for "dropdb --if-exists"

note() { echo "==> $*"; }
# Temporary directories and the scratch database go away however the script ends.
TMPS=()
VERIFYING=
cleanup() {
  [ ${#TMPS[@]} -eq 0 ] || rm -rf "${TMPS[@]}"
  [ -z "$VERIFYING" ] || pg_admin "dropdb --if-exists $VERIFY_DB" || true
}
trap cleanup EXIT
die() { echo "havewa-backup: $*" >&2; exit 1; }

MODE="${HAVEWA_MODE:-}"
if [ -z "$MODE" ]; then
  if [ -f "$ENV_FILE" ] && command -v pg_dump >/dev/null 2>&1; then MODE=native
  elif command -v docker >/dev/null 2>&1 && docker inspect "$DB_C" >/dev/null 2>&1; then MODE=docker
  else die "no installation found (neither $ENV_FILE nor a container $DB_C)"; fi
fi

if [ "$MODE" = native ]; then
  [ "$(id -u)" -eq 0 ] || die "run as root"
  DATABASE_URL="$(sed -n 's/^DATABASE_URL=//p' "$ENV_FILE" | head -1 | tr -d '"')"
  [ -n "$DATABASE_URL" ] || die "DATABASE_URL missing in $ENV_FILE"
  DB_URL="${DATABASE_URL%%\?*}" # pg tools do not know Prisma's ?schema=
  DB_NAME="${DB_URL##*/}"
  DB_USER="$(printf '%s' "$DB_URL" | sed -n 's|^postgresql://\([^:]*\):.*|\1|p')"
  OUT="${HAVEWA_BACKUP_DIR:-$DATA_DIR/backups}"
  # $1 = database, rest = command; native talks over the URL, so the app's own role is used
  dbx() { local db="$1"; shift; "$@" -d "${DB_URL%/*}/$db"; }
  psql_q() { psql -X -q -At -v ON_ERROR_STOP=1 -d "${DB_URL%/*}/$1" -c "$2"; }
  pg_admin() { su postgres -c "$*" >/dev/null; }
else
  DB_USER="${HAVEWA_DB_USER:-havewa}"
  DB_NAME="${HAVEWA_DB_NAME:-havewa}"
  OUT="${HAVEWA_BACKUP_DIR:-$PWD/backups}"
  dbx() { local db="$1"; shift; docker exec -i "$DB_C" "$@" -U "$DB_USER" -d "$db"; }
  psql_q() { docker exec -i "$DB_C" psql -X -q -At -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$1" -c "$2"; }
  pg_admin() { docker exec -i -e PGOPTIONS "$DB_C" sh -c "$* -U $DB_USER" >/dev/null; }
fi

tables() { psql_q "$1" "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"; }
# Row counts as "table<TAB>count", the reference a test restore is compared against.
counts() {
  local db="$1" t
  for t in $(tables "$db"); do printf '%s\t%s\n' "$t" "$(psql_q "$db" "SELECT count(*) FROM \"$t\"")"; done
}

app_version() {
  if [ "$MODE" = native ]; then
    sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' "$INSTALL_DIR/package.json" 2>/dev/null | head -1
  else
    # package.json version plus the image digest: "latest" alone says nothing a year later
    local img
    img="$(docker inspect -f '{{.Config.Image}}' "$APP_C")"
    echo "$(docker exec "$APP_C" sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' /app/package.json | head -1)" \
      "$(docker inspect -f '{{join .RepoDigests " "}}' "$img" 2>/dev/null || echo "$img")"
  fi
}

# Migrations the installed app knows; a backup from a newer version must not go into an older app.
app_migrations() {
  if [ "$MODE" = native ]; then ls "$INSTALL_DIR/prisma/migrations" 2>/dev/null
  else docker run --rm --entrypoint ls "$(docker inspect -f '{{.Config.Image}}' "$APP_C")" /app/prisma/migrations 2>/dev/null; fi
}

create() {
  local prefix="${1:-havewa}" stamp name work
  stamp="$(date -u +%Y%m%d-%H%M%SZ)"
  name="${prefix}-${stamp}"
  mkdir -p "$OUT"
  work="$(mktemp -d)"
  TMPS+=("$work")
  mkdir -p "$work/$name/csv" "$work/$name/config"
  local b="$work/$name"

  note "database ($MODE)"
  dbx "$DB_NAME" pg_dump -Fc --no-owner > "$b/database.dump"
  # Readable without HaVeWa and without PostgreSQL: one CSV per table.
  local t
  for t in $(tables "$DB_NAME"); do
    psql_q "$DB_NAME" "COPY \"$t\" TO STDOUT WITH (FORMAT csv, HEADER)" > "$b/csv/$t.csv"
  done
  counts "$DB_NAME" > "$b/counts.tsv"

  note "documents"
  if [ "$MODE" = native ]; then
    cp -a "$DATA_DIR/storage" "$b/storage"
  else
    docker cp "$APP_C:/app/storage" "$b/storage" >/dev/null
  fi

  note "configuration"
  if [ "$MODE" = native ]; then
    cp "$ENV_FILE" "$b/config/havewa.env"
  else
    # What the container really runs with, whatever set it up (compose, Unraid, Portainer ...)
    docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$APP_C" > "$b/config/container.env"
    local dir="${HAVEWA_COMPOSE_DIR:-$PWD}" f
    for f in "$dir"/.env "$dir"/docker-compose*.yml "$dir"/Caddyfile; do [ -f "$f" ] && cp "$f" "$b/config/"; done
  fi

  local last files bytes
  last="$(psql_q "$DB_NAME" "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name DESC LIMIT 1")"
  files="$(find "$b/storage" -type f | wc -l | tr -d ' ')"
  bytes="$(du -sb "$b/storage" | cut -f1)"
  cat > "$b/MANIFEST.txt" <<EOF
created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
host=$(hostname)
mode=$MODE
app_version=$(app_version)
last_migration=$last
postgres=$(psql_q "$DB_NAME" "SHOW server_version")
tables=$(wc -l < "$b/counts.tsv" | tr -d ' ')
document_files=$files
document_bytes=$bytes
EOF
  cat > "$b/README.txt" <<'EOF'
HaVeWa backup

database.dump   PostgreSQL dump (pg_dump -Fc), restore with: backup.sh restore <archive>
csv/            every table as CSV, opens in any spreadsheet without HaVeWa or PostgreSQL
storage/        uploaded documents; csv/Document.csv maps each file (storageKey) to its name,
                category, property, unit and person
config/         environment of the installation. AUTH_SECRET in there decrypts the stored
                SMTP, IMAP, banking and AI credentials: a restore without it leaves them unreadable.
counts.tsv      rows per table at backup time, checked by every test restore
MANIFEST.txt    time, app version, last database migration, document count
SHA256SUMS      checksums of all files above: sha256sum -c SHA256SUMS
EOF
  (cd "$b" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)

  local archive="$OUT/$name.tar.gz"
  if [ -n "$PASS" ]; then
    archive="$archive.enc"
    tar czf - -C "$work" "$name" | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:HAVEWA_BACKUP_PASSWORD -out "$archive"
  else
    tar czf "$archive" -C "$work" "$name"
  fi
  (cd "$OUT" && sha256sum "$(basename "$archive")" > "$(basename "$archive").sha256")
  note "written $archive ($(du -h "$archive" | cut -f1), $files documents)"
  CREATED="$archive"
}

# Unpacks an archive into $1 after checking it; prints the backup directory.
unpack() {
  local archive="$1" dest="$2"
  [ -f "$archive" ] || die "not found: $archive"
  if [ -f "$archive.sha256" ]; then
    (cd "$(dirname "$archive")" && sha256sum -c --quiet "$(basename "$archive").sha256") >&2 || die "archive checksum does not match"
  fi
  case "$archive" in
    *.enc)
      [ -n "$PASS" ] || die "encrypted archive: set HAVEWA_BACKUP_PASSWORD"
      openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:HAVEWA_BACKUP_PASSWORD -in "$archive" | tar xzf - -C "$dest" || die "cannot decrypt (wrong password?)"
      ;;
    *) tar xzf "$archive" -C "$dest" ;;
  esac
  local b
  b="$(find "$dest" -mindepth 1 -maxdepth 1 -type d | head -1)"
  (cd "$b" && sha256sum -c --quiet SHA256SUMS) >&2 || die "file checksums do not match"
  echo "$b"
}

# Test restore into a scratch database, row counts compared with the backup's own record.
verify() {
  local archive="$1" work b
  work="$(mktemp -d)"
  TMPS+=("$work")
  note "verifying $(basename "$archive")"
  b="$(unpack "$archive" "$work")"
  VERIFYING=1
  pg_admin "dropdb --if-exists $VERIFY_DB"
  if [ "$MODE" = native ]; then pg_admin "createdb -O $DB_USER $VERIFY_DB"; else pg_admin "createdb $VERIFY_DB"; fi
  dbx "$VERIFY_DB" pg_restore --no-owner --exit-on-error < "$b/database.dump"
  counts "$VERIFY_DB" > "$work/restored.tsv"
  diff -u "$b/counts.tsv" "$work/restored.tsv" >&2 || die "row counts differ after the test restore"
  local docs missing=0 k
  docs="$(psql_q "$VERIFY_DB" 'SELECT "storageKey" FROM "Document"')"
  for k in $docs; do [ -f "$b/storage/documents/$k" ] || missing=$((missing + 1)); done
  [ "$missing" -eq 0 ] || die "$missing documents referenced in the database are missing in the archive"
  pg_admin "dropdb $VERIFY_DB"
  VERIFYING=
  note "ok: $(wc -l < "$b/counts.tsv" | tr -d ' ') tables, $(echo "$docs" | grep -c . || true) documents, checksums match"
}

restore() {
  local archive="$1" with_config="${2:-}" work b
  work="$(mktemp -d)"
  TMPS+=("$work")
  b="$(unpack "$archive" "$work")"
  cat "$b/MANIFEST.txt"

  local last
  last="$(sed -n 's/^last_migration=//p' "$b/MANIFEST.txt")"
  if [ -n "$last" ] && ! app_migrations | grep -qx "$last"; then
    die "backup is from a newer HaVeWa ($last) than the installed one; update the app first"
  fi

  # Without the same AUTH_SECRET the stored credentials stay encrypted for good.
  local old new
  if [ "$MODE" = native ]; then
    old="$(sed -n 's/^AUTH_SECRET=//p' "$ENV_FILE")"; new="$(sed -n 's/^AUTH_SECRET=//p' "$b/config/havewa.env")"
  else
    old="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$APP_C" | sed -n 's/^AUTH_SECRET=//p')"
    new="$(sed -n 's/^AUTH_SECRET=//p' "$b/config/container.env")"
  fi
  if [ "$old" != "$new" ] && [ "$with_config" != "--with-config" ]; then
    echo "" >&2
    echo "WARNING: AUTH_SECRET differs from the backup. Stored SMTP/IMAP/banking/AI credentials will" >&2
    echo "not decrypt. Native: add --with-config. Docker: put AUTH_SECRET from config/ into your .env." >&2
  fi

  if [ "${HAVEWA_YES:-}" != 1 ]; then
    local a=""
    read -r -p "Replace the current data with this backup? [y/N] " a || true
    [ "$a" = y ] || [ "$a" = Y ] || die "cancelled (HAVEWA_YES=1 skips the question)"
  fi

  note "safety backup of the current state"
  create "pre-restore"

  note "stopping the app"
  if [ "$MODE" = native ]; then systemctl stop havewa; else docker stop "$APP_C" >/dev/null; fi

  note "database"
  if [ "$MODE" = native ]; then
    pg_admin "dropdb --force $DB_NAME"
    pg_admin "createdb -O $DB_USER $DB_NAME"
  else
    docker exec "$DB_C" dropdb -U "$DB_USER" --force "$DB_NAME"
    docker exec "$DB_C" createdb -U "$DB_USER" "$DB_NAME"
  fi
  dbx "$DB_NAME" pg_restore --no-owner --exit-on-error < "$b/database.dump"

  note "documents"
  if [ "$MODE" = native ]; then
    rm -rf "$DATA_DIR/storage"
    cp -a "$b/storage" "$DATA_DIR/storage"
    chown -R havewa:havewa "$DATA_DIR/storage"
    if [ "$with_config" = "--with-config" ]; then
      cp "$ENV_FILE" "$ENV_FILE.before-restore"
      cp "$b/config/havewa.env" "$ENV_FILE"
      chown root:havewa "$ENV_FILE"; chmod 640 "$ENV_FILE"
    fi
    # The installed app may be newer than the backup: bring the schema up before it starts.
    (cd "$INSTALL_DIR" && set -a && . "$ENV_FILE" && set +a && PRISMA_HIDE_UPDATE_MESSAGE=1 npx prisma migrate deploy >/dev/null)
    systemctl start havewa
  else
    docker run --rm --volumes-from "$APP_C" -v "$b/storage:/restore:ro" --entrypoint sh \
      "$(docker inspect -f '{{.Config.Image}}' "$APP_C")" -c 'rm -rf /app/storage/* && cp -a /restore/. /app/storage/'
    docker start "$APP_C" >/dev/null # runs prisma migrate deploy on start
  fi
  note "restored $(basename "$archive")"
}

prune() {
  local old
  old="$(ls -1t "$OUT"/havewa-*.tar.gz "$OUT"/havewa-*.tar.gz.enc 2>/dev/null | tail -n +$((KEEP + 1)) || true)"
  for f in $old; do rm -f "$f" "$f.sha256"; done
  # safety backups from restores: the newest three
  old="$(ls -1t "$OUT"/pre-restore-*.tar.gz* 2>/dev/null | grep -v '\.sha256$' | tail -n +4 || true)"
  for f in $old; do rm -f "$f" "$f.sha256"; done
}

case "${1:-create}" in
  create)
    create
    [ "${HAVEWA_BACKUP_VERIFY:-1}" = 0 ] || verify "$CREATED"
    prune
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ok $(basename "$CREATED")" > "$OUT/LAST_BACKUP"
    ;;
  verify) verify "${2:?usage: backup.sh verify FILE}" ;;
  restore) restore "${2:?usage: backup.sh restore FILE [--with-config]}" "${3:-}" ;;
  *) die "usage: backup.sh [create | verify FILE | restore FILE [--with-config]]" ;;
esac
