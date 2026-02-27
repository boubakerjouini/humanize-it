import { DashboardNav } from "@/components/dashboard-nav";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardNav>{children}</DashboardNav>;
}
