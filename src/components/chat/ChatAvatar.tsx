"use client";

import { cn, colorOf, getInitials } from "@/lib/wa-utils";

interface ChatAvatarProps {
  name?: string | null;
  colorKey?: string | null;
  avatarUrl?: string | null;
  className?: string;
  iconClassName?: string;
}

/** Avatar lingkaran inisial khas WhatsApp (atau gambar bila ada avatarUrl). */
export default function ChatAvatar({ name, colorKey, avatarUrl, className, iconClassName }: ChatAvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ? `Avatar ${name}` : "Avatar"}
        className={cn("h-10 w-10 rounded-full object-cover shrink-0", className)}
      />
    );
  }
  const c = colorOf(colorKey);
  return (
    <div
      aria-hidden="true"
      className={cn(
        "h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0",
        c.bg,
        className
      )}
    >
      <span className={cn("text-sm leading-none", iconClassName)}>{getInitials(name)}</span>
    </div>
  );
}
