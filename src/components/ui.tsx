"use client";

import { useEffect, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-rose-200 bg-rose-50/40 px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-master-600 shadow-sm">{icon}</div> : null}
      <div>
        <p className="text-sm font-semibold text-master-900">{title}</p>
        {description ? <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  selesai: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  diproses: "bg-amber-50 text-amber-700 border-amber-200",
  inactive: "bg-slate-100 text-slate-600 border-slate-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const text =
    label ??
    ({
      active: "Aktif",
      approved: "Disetujui",
      pending: "Menunggu",
      inactive: "Belum Aktif",
      rejected: "Ditolak",
      cancelled: "Dibatalkan",
      selesai: "Selesai",
      diproses: "Diproses",
    }[status] ??
      status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        STATUS_STYLES[status] ?? "border-slate-200 bg-slate-50 text-slate-600",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {text}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-master-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        className={cn(
          "animate-rise max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6",
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-master-950">{title}</h3>
            {description ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-master-700"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
        {footer ? <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Toast({
  message,
  tone = "success",
  onClose,
}: {
  message: string | null;
  tone?: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 3800);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4">
      <div
        className={cn(
          "animate-rise pointer-events-auto flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-xl",
          tone === "success" ? "bg-emerald-600" : "bg-rose-600",
        )}
      >
        <span className="h-2 w-2 rounded-full bg-white/90" />
        {message}
      </div>
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-rose-100", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-master-500 to-master-700 transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
