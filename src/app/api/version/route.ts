// Unique build timestamp so clients can immediately detect when the server has updated
const APP_VERSION = "v2.1-" + Date.now();

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      ok: true,
      version: APP_VERSION,
      timestamp: Date.now(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
      },
    },
  );
}
