import { redirect } from "next/navigation";
import { TransactionHistory } from "@/components/transaction-history";
import { getCurrentUser } from "@/lib/auth";
import { getSummary, getTransactions } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function RiwayatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [items, summary] = await Promise.all([getTransactions(user.id), getSummary(user.id)]);
  return <TransactionHistory initialItems={items} initialBalance={summary?.balance ?? 0} />;
}
