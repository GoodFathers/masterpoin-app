// Wrapper <img> sederhana (gambar data URL / lokal, bukan remote optimizer Next).
import * as React from "react";

export default function WaImg({
  src,
  alt,
  className,
  loading = "lazy",
}: {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  return <img src={src} alt={alt} className={className} loading={loading} />;
}
