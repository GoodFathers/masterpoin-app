import { NextRequest } from "next/server";
import { ok, bad } from "@/lib/api-helpers";
import { langNameOf } from "@/lib/translate-langs";
import ZAI from "z-ai-web-dev-sdk";

/**
 * POST /api/translate  { text, target }
 * Menerjemahkan teks pesan ke bahasa tujuan memakai LLM (server-only).
 * Respons: { translation }  — error: { error }
 * Cache memori sederhana (teks+bahasa) supaya terjemahan ulang instan & hemat kuota.
 */

const MAX_LEN = 1500;
const cache = new Map<string, string>();

function cacheKey(target: string, text: string) {
  return `${target}::${text}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { text?: unknown; target?: unknown } | null;
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const target = typeof body?.target === "string" ? body.target.trim() : "";

    if (!text) return bad("Teks yang diterjemahkan tidak boleh kosong");
    if (text.length > MAX_LEN) return bad(`Teks terlalu panjang (maksimal ${MAX_LEN} karakter)`);
    const langName = langNameOf(target);
    if (!langName) return bad("Bahasa tujuan tidak didukung");

    const key = cacheKey(target, text);
    const hit = cache.get(key);
    if (hit) return ok({ translation: hit });

    const zai = await ZAI.create();
    const completion = (await Promise.race([
      zai.chat.completions.create({
        messages: [
          {
            role: "assistant",
            content:
              `Kamu penerjemah profesional. Terjemahkan teks user ke "${langName}". ` +
              `Pertahankan makna, nada (santai/formal), emoji, dan pindah baris. ` +
              `Balas HANYA hasil terjemahannya — tanpa tanda kutip, tanpa penjelasan, tanpa nama bahasa. ` +
              `Jika teks sudah dalam ${langName}, kembalikan teksnya (boleh dirapikan sedikit).`,
          },
          { role: "user", content: text },
        ],
        thinking: { type: "disabled" },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("LLM timeout")), 20_000)),
    ])) as { choices?: { message?: { content?: string } }[] };

    const translation = completion?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!translation) return bad("Terjemahan tidak tersedia, coba lagi", 502);

    cache.set(key, translation);
    if (cache.size > 300) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }

    return ok({ translation });
  } catch (err) {
    console.error("POST /api/translate error:", err);
    return bad("Layanan terjemahan sedang tidak tersedia", 500);
  }
}
