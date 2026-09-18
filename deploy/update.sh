#!/usr/bin/env bash
# HaVeWa aktualisieren (GHCR-Image) auf einem Docker-Host, z. B. /opt/havewa.
#
#   ssh root@<host> 'bash -s' < deploy/update.sh
#   # oder auf dem Host: cd /opt/havewa && bash update.sh
#
# Zieht das neueste Image, startet den App-Container neu (Migrationen laufen beim
# Start) und raeumt danach verwaiste Images weg — sonst sammeln sich nach jedem
# Pull alte <none>-Images an, bis die Platte voll ist und Postgres crasht.
set -euo pipefail

DIR="${HAVEWA_DIR:-/opt/havewa}"
FILES=(-f docker-compose.shared.yml -f docker-compose.image.yml)

cd "$DIR"
echo "==> pulling latest image"
docker compose "${FILES[@]}" pull havewa
echo "==> restarting app"
docker compose "${FILES[@]}" up -d havewa
echo "==> pruning dangling images"
docker image prune -f
echo "==> done"
docker compose "${FILES[@]}" ps
