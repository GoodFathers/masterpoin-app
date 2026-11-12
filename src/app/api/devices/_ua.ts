/**
 * Parsing USER-AGENT nyata untuk identifikasi "perangkat ini".
 * Menghasilkan nama (browser + OS) dan platform WEB | DESKTOP | TABLET.
 */
export function parseUserAgent(uaRaw: string | null): { name: string; platform: "WEB" | "DESKTOP" | "TABLET" } {
  const ua = uaRaw ?? "";
  const lower = ua.toLowerCase();

  // ---- Browser ----
  let browser = "Browser";
  if (lower.includes("edg/")) browser = "Edge";
  else if (lower.includes("opr/") || lower.includes("opera")) browser = "Opera";
  else if (lower.includes("chrome") || lower.includes("crios")) browser = "Chrome"; // mencakup HeadlessChrome
  else if (lower.includes("firefox") || lower.includes("fxios")) browser = "Firefox";
  else if (lower.includes("safari")) browser = "Safari";

  // Versi mayor (opsional)
  let version = "";
  const patterns: Record<string, RegExp> = {
    Edge: /edg\/(\d+)/i,
    Opera: /(?:opr|opera)\/(\d+)/i,
    Chrome: /(?:chrome|crios)\/(\d+)/i,
    Firefox: /(?:firefox|fxios)\/(\d+)/i,
    Safari: /version\/(\d+)/i,
  };
  const m = patterns[browser]?.exec(ua);
  if (m) version = ` ${m[1]}`;

  // ---- OS + jenis perangkat ----
  let os = "Perangkat Tidak Dikenal";
  let isTablet = false;
  let isMobile = false;
  if (/ipad/i.test(ua)) {
    os = "iPadOS";
    isTablet = true;
  } else if (/iphone|ipod/i.test(ua)) {
    os = "iPhone";
    isMobile = true;
  } else if (/android/i.test(ua)) {
    if (/mobile/i.test(ua)) {
      os = "Android";
      isMobile = true;
    } else {
      os = "Tablet Android";
      isTablet = true;
    }
  } else if (/windows nt|windows phone/i.test(ua)) {
    os = "Windows";
  } else if (/mac os x|macintosh/i.test(ua)) {
    os = "macOS";
  } else if (/cros/i.test(ua)) {
    os = "ChromeOS";
  } else if (/linux|x11/i.test(ua)) {
    os = "Linux";
  }

  const platform: "WEB" | "DESKTOP" | "TABLET" = isTablet ? "TABLET" : isMobile ? "WEB" : "DESKTOP";
  return { name: `${browser}${version} di ${os}`, platform };
}
