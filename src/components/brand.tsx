import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-master-500 via-master-600 to-master-800 text-white shadow-lg shadow-master-700/30",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path
          d="M4 17V8.5c0-1.4 1.6-2.2 2.8-1.4L12 10.6l5.2-3.5C18.4 6.3 20 7.1 20 8.5V17"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="16.6" r="1.6" fill="currentColor" />
      </svg>
    </span>
  );
}

export function BrandWordmark({
  className,
  subtitle,
  light = false,
}: {
  className?: string;
  subtitle?: string;
  light?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark />
      <div className="leading-tight">
        <p className={cn("text-[17px] font-extrabold tracking-tight", light ? "text-white" : "text-master-900")}>
          Master
        </p>
        <p className={cn("text-[10.5px] font-medium tracking-[0.16em] uppercase", light ? "text-rose-100/80" : "text-master-500")}>
          {subtitle ?? "Poin Digital"}
        </p>
      </div>
    </div>
  );
}
