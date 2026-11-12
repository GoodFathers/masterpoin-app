"use client";

import { cn } from "@/lib/wa-utils";

// Baris pengaturan: judul + deskripsi di kiri, kontrol di kanan
export default function SettingsRow({
  title,
  description,
  htmlFor,
  children,
  className,
}: {
  title: string;
  description?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-3", className)}>
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-sm font-medium leading-tight cursor-default">
          {title}
        </label>
        {description ? <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
