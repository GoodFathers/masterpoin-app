import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  await ensureSeeded();
  const user = await getCurrentUser();
  if (user) redirect("/app");
  return <AuthForm mode="register" />;
}
