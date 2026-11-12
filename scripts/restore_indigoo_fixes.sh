#!/bin/bash
# ============================================================
# RESTORE INDIIGOO — v2 (ANTI-RESURRECTION, Task 83)
# Dipakai watchdog (Job 519513) & agen pasca rollback platform.
#
# Kebijakan (worklog Task 81 & 83, mengikat):
#  - Sumber kebenaran = backup remote GitHub (backup/main), BUKAN tar lama.
#  - Fitur Misi DIHAPUS PERMANEN: kebangkitan MissionsTab = pelanggaran.
#  - Sentinel: MissionsTab TIDAK boleh ada; vercel.json,
#    api/appointments/route.ts, lib/matrix.ts WAJIB ada.
# ============================================================
set -u
PROJ="/home/z/my-project"
cd "$PROJ" || exit 1

TRIPPED=""
[ -e src/components/indigoo/MissionsTab.tsx ] && TRIPPED="missions-resurrected"
[ ! -f vercel.json ] && TRIPPED="$TRIPPED vercel.json-hilang"
[ ! -f src/app/api/appointments/route.ts ] && TRIPPED="$TRIPPED appointments-hilang"
[ ! -f src/lib/matrix.ts ] && TRIPPED="$TRIPPED matrix-hilang"
command rg -c openrelay src/lib/realcall.ts >/dev/null 2>&1 || TRIPPED="$TRIPPED realcall-hilang"
[ ! -f src/app/not-found.tsx ] && TRIPPED="$TRIPPED notfound-hilang"

if [ -n "$TRIPPED" ]; then
  echo "SENTINEL TRIPPED: $TRIPPED — restore dari backup remote..."
  if git fetch backup main 2>/dev/null; then
    git reset --hard backup/main || exit 1
    bun install >/dev/null 2>&1
    bunx prisma generate >/dev/null 2>&1
    bun run db:push >/dev/null 2>&1
    echo "RESTORED dari backup/main (full state)"
  else
    # fallback darurat: tar legacy (hanya 9 file inti)
    for F in "/home/z/indigoo-fixes-backup/indigoo-fixes-latest.tar.gz" \
             "/tmp/indigoo-fixes-latest.tar.gz" \
             "$PROJ/scripts/indigoo-fixes-backup/indigoo-fixes-latest.tar.gz"; do
      if [ -f "$F" ]; then tar -xzf "$F" -C "$PROJ"; echo "RESTORED dari $F (tar legacy)"; exit 0; fi
    done
    echo "BACKUP TIDAK DITEMUKAN — HEAL-FAILED"
    exit 1
  fi
else
  echo "INTEGRITAS OK (sentinel bersih — tidak ada yang di-restore)"
fi
