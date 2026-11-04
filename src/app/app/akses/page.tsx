import { redirect } from "next/navigation";
import { AccessPanel } from "@/components/access-panel";
import { getCurrentUser } from "@/lib/auth";
import { getAccessRequests } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AksesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const requests = await getAccessRequests(user.id);
  return (
    <AccessPanel
      initialRequests={requests}
      initialStatus={user.accessStatus}
      timerStartedAt={user.timerStartedAt ? user.timerStartedAt.toISOString() : null}
      userName={user.name}
    />
  );
}
