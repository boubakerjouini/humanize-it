import { redirect } from "next/navigation";

// Document upload was merged into the unified Humanize workspace at /dashboard
// (use the "Upload" tab).
export default function DocumentsRedirect() {
  redirect("/dashboard");
}
