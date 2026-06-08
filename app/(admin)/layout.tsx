import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  // Hard gate: anyone who isn't an allow-listed / role=ADMIN user is bounced.
  if (!admin) redirect("/dashboard");

  return <AdminShell email={admin.email}>{children}</AdminShell>;
}
