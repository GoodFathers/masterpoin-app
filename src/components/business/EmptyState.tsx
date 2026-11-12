"use client";

import type { LucideIcon } from "lucide-react";

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 gap-3">
      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>
      <p className="font-medium">{title}</p>
      {description ? <p className="text-sm text-muted-foreground max-w-xs">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
