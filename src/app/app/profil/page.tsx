import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <ProfileForm
      user={{
        name: user.name,
        email: user.email,
        religion: user.religion,
        phone: user.phone,
        city: user.city,
        role: user.role,
        avatarUrl: user.avatarUrl ?? null,
        accessCode: user.accessCode ?? null,
        accessStatus: user.accessStatus,
        timerStartedAt: user.timerStartedAt ? user.timerStartedAt.toISOString() : null,
        createdAt: user.createdAt.toISOString(),
      }}
    />
  );
}
