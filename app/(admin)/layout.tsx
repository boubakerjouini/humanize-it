import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { AdminShell } from "@/components/admin-shell";
import { InternalDeviceMark } from "@/components/analytics/internal-device-mark";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  // Hard gate: anyone who isn't an allow-listed / role=ADMIN user is bounced.
  if (!admin) redirect("/dashboard");

  return (
    <>
      {/* Admins only (checked above): keeps this browser out of every analytics tool. */}
      <InternalDeviceMark />
      <AdminShell email={admin.email}>{children}</AdminShell>
    </>
  );
}
