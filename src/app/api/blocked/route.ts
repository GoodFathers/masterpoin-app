import { db } from "@/lib/db";
import { ok } from "@/lib/api-helpers";

// GET /api/blocked → { contacts } (hanya kontak yang diblokir)
export async function GET() {
  const contacts = await db.contact.findMany({
    where: { blocked: true },
    orderBy: { name: "asc" },
  });
  return ok({ contacts });
}
