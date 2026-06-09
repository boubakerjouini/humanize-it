import { HumanizeWorkspace } from "@/components/workspace/humanize-workspace";

export const metadata = { title: "Humanize — HumanizeIt" };

// The signed-in home IS the tool: users land straight in the Humanize workspace.
export default function DashboardHome() {
  return <HumanizeWorkspace />;
}
