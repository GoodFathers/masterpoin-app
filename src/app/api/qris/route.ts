import QRCode from "qrcode";
import { ACCESS_FEE, QRIS } from "@/lib/constants";
import { getCurrentUser, jsonError } from "@/lib/auth";

export const dynamic = "force-dynamic";

function buildPayload(amount: number): string {
  const amountStr = String(amount);
  const amountField = `${String(amountStr.length).padStart(2, "0")}54${amountStr}`;
  return [
    "000201",
    "010211",
    `26${String(QRIS.merchant.length + 4).padStart(2, "0")}0016ID.CO.QRIS.WWW0118${QRIS.nmid}`,
    "52045814",
    "5303360",
    amountField,
    "5802ID",
    `59${String(QRIS.merchant.length).padStart(2, "0")}${QRIS.merchant}`,
    `60${String(QRIS.city.length).padStart(2, "0")}${QRIS.city}`,
    "6304ABCD",
  ].join("");
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  const raw = Number(new URL(request.url).searchParams.get("amount"));
  const amount = Number.isFinite(raw) && raw >= ACCESS_FEE ? Math.round(raw) : ACCESS_FEE;
  try {
    const svg = await QRCode.toString(buildPayload(amount), {
      type: "svg",
      margin: 1,
      width: 320,
      errorCorrectionLevel: "M",
      color: { dark: "#7a0d15", light: "#ffffff" },
    });
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return jsonError("Gagal membuat kode QRIS.", 500);
  }
}
