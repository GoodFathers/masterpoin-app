import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { getSummary } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const summary = await getSummary(user.id);

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        accessStatus: user.accessStatus,
        religion: user.religion,
        avatarUrl: user.avatarUrl ?? null,
        canEditPoints: user.role === "super_admin" || Boolean(user.canEditPoints),
      }}
      ledgerPoints={summary?.ledgerPoints ?? 0}
      timerStartedAt={user.timerStartedAt ? user.timerStartedAt.toISOString() : null}
      hasPending={Boolean(summary?.pendingRequest)}
    >
      {children}
    </AppShell>
  );
}
