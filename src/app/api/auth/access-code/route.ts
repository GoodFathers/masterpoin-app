import { generateUserAccessNumber } from "@/lib/access-code";

export const dynamic = "force-dynamic";

export async function GET() {
  const code = generateUserAccessNumber();
  return Response.json({
    ok: true,
    accessCode: code,
  });
}
