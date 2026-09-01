#!/usr/bin/env bash
# HaVeWa on Proxmox VE: an unprivileged Debian container with PostgreSQL, Node and the app in it.
#
# Run it on the PVE host as root:
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/fgilde/hausverwaltung/main/deploy/proxmox/havewa.sh)"
#
# No Docker in the container. Docker inside an unprivileged LXC starts nothing on a current Proxmox:
# runc writes net.ipv4.ip_unprivileged_port_start, and /proc/sys is read-only in there. A privileged
# container would fix that by handing the container root on the host, which is a poor trade for two
# processes Debian ships anyway. The container gets PostgreSQL and Node instead, and the app is built
# from its newest tag inside it -- which is why it wants a little more RAM and disk than a container
# that only unpacks a binary.
#
# Self-contained on purpose. The community helper scripts source a shared build.func from another
# repository at run time, which is convenient right up to the day that file moves. This one needs
# pct, which every PVE host has.
#
# Overridable: CTID, HOSTNAME_, DISK_GB, RAM_MB, CORES, BRIDGE, STORAGE, TEMPLATE_STORAGE, PORT
set -euo pipefail

CTID="${CTID:-}"
HOSTNAME_="${HOSTNAME_:-havewa}"
DISK_GB="${DISK_GB:-12}"
RAM_MB="${RAM_MB:-4096}"
CORES="${CORES:-2}"
BRIDGE="${BRIDGE:-vmbr0}"
STORAGE="${STORAGE:-local-lvm}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"
PORT="${PORT:-3010}"
INSTALLER="${INSTALLER:-https://raw.githubusercontent.com/fgilde/hausverwaltung/main/deploy/proxmox/install.sh}"

die() { echo "havewa: $*" >&2; exit 1; }
note() { echo "==> $*"; }

command -v pct >/dev/null || die "this runs on a Proxmox VE host: pct was not found"
[ "$(id -u)" -eq 0 ] || die "run as root"

[ -n "$CTID" ] || { CTID="$(pvesh get /cluster/nextid)"; note "no CTID given, taking the next free one: $CTID"; }

pveam update >/dev/null 2>&1 || true

pick_template() {
  pveam available --section system 2>/dev/null | awk -v pat="$1" '$2 ~ pat {print $2}' | sort -V | tail -1
}

# Newest first, but an older PVE refuses a newer Debian outright ("unsupported debian version") and
# only says so at create time - so the fallback is a second create, not a cleverer check.
CREATED=0
for pattern in debian-13-standard debian-12-standard; do
  TEMPLATE="$(pick_template "$pattern")"
  [ -n "$TEMPLATE" ] || continue
  if ! pveam list "$TEMPLATE_STORAGE" 2>/dev/null | grep -q "$TEMPLATE"; then
    note "downloading the template $TEMPLATE"
    pveam download "$TEMPLATE_STORAGE" "$TEMPLATE" >/dev/null
  fi
  note "creating the container $CTID from $TEMPLATE"
  if pct create "$CTID" "${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}" \
      --hostname "$HOSTNAME_" \
      --cores "$CORES" --memory "$RAM_MB" --swap 512 \
      --rootfs "${STORAGE}:${DISK_GB}" \
      --net0 "name=eth0,bridge=${BRIDGE},ip=dhcp" \
      --unprivileged 1 --onboot 1 >/dev/null 2>&1; then
    CREATED=1
    break
  fi
  note "this PVE will not create a container from $TEMPLATE, trying an older Debian"
done
[ "$CREATED" = "1" ] || die "no Debian template this PVE accepts"
pct start "$CTID"

note "waiting for the network"
IP=""
for _ in $(seq 1 30); do
  IP="$(pct exec "$CTID" -- bash -c "hostname -I 2>/dev/null | awk '{print \$1}'" 2>/dev/null || true)"
  [ -n "$IP" ] && break
  sleep 2
done
[ -n "$IP" ] || die "the container did not get an address"

note "installing HaVeWa"
pct exec "$CTID" -- bash -lc "apt-get update -qq && apt-get install -y -qq --no-install-recommends curl ca-certificates >/dev/null"
pct exec "$CTID" -- bash -lc "HAVEWA_PORT=${PORT} bash -c \"\$(curl -fsSL ${INSTALLER})\""

echo ""
note "done"
echo "    URL:      http://${IP}:${PORT}"
echo "    Account:  the first visit opens the setup wizard"
echo "    Update:   pct exec ${CTID} -- bash -c \"\$(curl -fsSL ${INSTALLER})\""
echo "    Config:   pct exec ${CTID} -- cat /etc/havewa.env"
