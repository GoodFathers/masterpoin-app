export type UserRole = "super_admin" | "admin" | "user";

export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === "super_admin";
}

export function isAdmin(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

export function isRegularUser(role: string | null | undefined): boolean {
  return role === "user" || !role;
}

export function canManagePoints(user: { role?: string | null; canEditPoints?: boolean | null } | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  return Boolean(user.canEditPoints);
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  user: "Pengguna",
};

export const ROLE_BADGE_STYLE: Record<string, string> = {
  super_admin: "bg-purple-50 text-purple-700 border-purple-200",
  admin: "bg-master-50 text-master-700 border-master-200",
  user: "bg-slate-50 text-slate-700 border-slate-200",
};
