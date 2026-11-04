import { redirect } from "next/navigation";
import { CheckInPanel } from "@/components/checkin-panel";
import { getCurrentUser } from "@/lib/auth";
import { computeStreak, getCheckInHistory } from "@/lib/data";
import { wibDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const history = await getCheckInHistory(user.id, 60);
  return (
    <CheckInPanel
      initialHistory={history}
      initialStreak={computeStreak(history.map((item) => item.date))}
      today={wibDateKey()}
    />
  );
}
