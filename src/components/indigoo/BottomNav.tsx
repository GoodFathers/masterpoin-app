"use client";

import type { ElementType } from "react";
import { CalendarCheck, CalendarClock, CircleDashed, MessageCircle, Phone } from "lucide-react";
import { cn } from "@/lib/wa-utils";

export type TabId = "chat" | "panggilan" | "pembaruan" | "rutinitas" | "appointment";

const ITEMS: { id: TabId; label: string; icon: ElementType }[] = [
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "panggilan", label: "Panggilan", icon: Phone },
  { id: "pembaruan", label: "Pembaruan", icon: CircleDashed },
  { id: "rutinitas", label: "Rutinitas", icon: CalendarCheck },
  { id: "appointment", label: "Appointment", icon: CalendarClock },
];

/**
 * Navigasi bawah ala aplikasi mobile — tab utama dinamis.
 * Tab yang dimatikan Panel Super Admin (flag fitur_* = false) disembunyikan.
 */
export default function BottomNav({
  active,
  onSelect,
  hiddenTabs = [],
}: {
  active: TabId;
  onSelect: (t: TabId) => void;
  /** Tab yang dinonaktifkan admin — tidak dirender. */
  hiddenTabs?: TabId[];
}) {
  const items = ITEMS.filter((i) => !hiddenTabs.includes(i.id));
  return (
    <nav
      aria-label="Navigasi utama"
      className="grid h-16 w-full border-t border-border bg-white dark:bg-background"
      style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}
    >
      {items.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex items-center justify-center rounded-full px-4 py-0.5 transition-colors",
                isActive && "bg-primary/10"
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="leading-none">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
