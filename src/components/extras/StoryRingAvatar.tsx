"use client";

import { cn, colorOf, getInitials } from "@/lib/wa-utils";

// Avatar dengan cincin gradient status WhatsApp (atau cincin abu jika sudah dilihat)
export default function StoryRingAvatar({
  name,
  colorKey,
  size = 56,
  seen = false,
  className,
}: {
  name: string;
  colorKey?: string | null;
  size?: number;
  seen?: boolean;
  className?: string;
}) {
  const inner = size - 8;
  return (
    <span
      className={cn(
        "wa-story-ring inline-flex items-center justify-center rounded-full p-[3px] shrink-0",
        seen && "bg-muted-foreground/30",
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className="h-full w-full rounded-full border-2 border-background bg-background flex items-center justify-center overflow-hidden"
        style={{ width: inner, height: inner }}
      >
        <span
          className={cn(
            "h-full w-full rounded-full flex items-center justify-center text-white font-semibold",
            colorOf(colorKey).bg
          )}
          style={{ fontSize: Math.max(11, Math.round(inner / 2.8)) }}
        >
          {getInitials(name)}
        </span>
      </span>
    </span>
  );
}
