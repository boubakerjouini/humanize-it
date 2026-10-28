import { EditorSkeleton } from "@/components/workspace/skeleton";

// Shown inside the shell while a workspace route streams in, instead of a blank pane.
export default function DashboardLoading() {
  return <EditorSkeleton />;
}
