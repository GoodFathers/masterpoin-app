// Reset SEMUA saldo mP & Timer ke 0 (sekali jalan — dipanggil manual dari terminal).
// Juga dipakai ulang oleh tombol "Reset Semua ke 0" di panel Manajemen (API /api/admin/reset-mp).
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const r = await db.user.updateMany({
  data: {
    bonusMp: 0,
    activatedAt: null,
    timerStartedAt: null,
    timerPausedAccum: 0,
    timerCompleted: false,
    activationStatus: "NONE",
    activationRequestedAt: null,
    activationProcessedAt: null,
    activationProcessedBy: null,
  },
});
console.log("reset users:", r.count);
const check = await db.user.findMany({ select: { username: true, bonusMp: true, activatedAt: true, activationStatus: true, role: true } });
console.log(JSON.stringify(check, null, 1));
await db.$disconnect();
