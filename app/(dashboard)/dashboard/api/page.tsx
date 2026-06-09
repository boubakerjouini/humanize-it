import { redirect } from "next/navigation";

// API key management moved into Settings (the "API keys" section).
export default function ApiRedirect() {
  redirect("/dashboard/settings");
}
