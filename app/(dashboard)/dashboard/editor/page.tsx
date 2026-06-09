import { redirect } from "next/navigation";

// The editor was merged into the unified Humanize workspace at /dashboard.
export default function EditorRedirect() {
  redirect("/dashboard");
}
