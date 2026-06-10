import { redirect } from "next/navigation";

// History was merged into the editor (a slide-in "History" drawer at /dashboard).
// Kept as a redirect so old links/bookmarks don't 404.
export default function HistoryRedirect() {
  redirect("/dashboard");
}
