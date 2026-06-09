import { DocumentEditor } from "@/components/workspace/document-editor";

export const metadata = { title: "Humanize — HumanizeIt" };

// The signed-in home IS the tool: users land straight in the document editor.
export default function DashboardHome() {
  return <DocumentEditor />;
}
