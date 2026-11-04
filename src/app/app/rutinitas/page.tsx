import { redirect } from "next/navigation";
import { RoutineBoard } from "@/components/routine-board";
import { getCurrentUser } from "@/lib/auth";
import { getRoutinesWithLogs, getWeeklyRoutineStats } from "@/lib/data";
import { wibDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function RutinitasPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const today = wibDateKey();
  const [items, weekly] = await Promise.all([
    getRoutinesWithLogs(user.id, today),
    getWeeklyRoutineStats(user.id),
  ]);
  return <RoutineBoard initialItems={items} weekly={weekly} userReligion={user.religion} today={today} />;
}
