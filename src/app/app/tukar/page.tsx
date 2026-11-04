import { redirect } from "next/navigation";
import { RewardsGallery } from "@/components/rewards-gallery";
import { getCurrentUser } from "@/lib/auth";
import { getRewardsCatalog, getSummary } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function TukarPoinPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [data, summary] = await Promise.all([getRewardsCatalog(user.id), getSummary(user.id)]);
  return (
    <RewardsGallery
      catalog={data.catalog}
      redemptions={data.redemptions}
      ledgerPoints={summary?.ledgerPoints ?? 0}
      timerStartedAt={summary?.user.timerStartedAt ?? null}
      initialBalance={summary?.balance ?? 0}
    />
  );
}
