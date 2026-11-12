import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Prisma: jangan di-bundle agar query engine ikut ter-trace ke standalone/Vercel
  serverExternalPackages: ["@prisma/client", "prisma"],
  // Berkas unggahan tersimpan di DATABASE dan tersaji via /api/media/<name>.
  // URL bentuk lama /uploads/<kind>/<name> tetap hidup (rewrite afterFiles:
  // berkas statis disk bila ada lebih dulu, selain itu diambil dari DB).
  async rewrites() {
    return [{ source: "/uploads/:kind/:name", destination: "/api/media/:name" }];
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Izinkan domain resmi IndiGoo mengakses asset dev server (origin lintas host)
  allowedDevOrigins: [
    "indonesiandigitalgoo.com",
    "www.indonesiandigitalgoo.com",
  ],
};

export default nextConfig;
