// ===========================================================
// components/workspace/notify.ts — the one toast style for the signed-in app.
// Short sentence-case title, optional one-sentence description, no emoji, no
// trailing period on titles. Every copy/save/export/delete confirmation in
// the workspace goes through here so they read the same everywhere.
// ===========================================================

import { toast } from "sonner";

export const notify = {
  success: (title: string, description?: string) => toast.success(title, { description }),
  error: (title: string, description?: string) => toast.error(title, { description }),
  info: (title: string, description?: string) => toast.info(title, { description }),

  copied: () => toast.success("Copied to clipboard"),
  copyFailed: () => toast.error("Couldn't copy", { description: "Your browser blocked the clipboard. Select the text and copy it by hand." }),
  downloaded: (fileName: string) => toast.success("Download started", { description: fileName }),
  deleted: (what = "Document") => toast.success(`${what} deleted`),
  /** A request that never reached the server (offline, DNS, dropped connection). */
  offline: () => toast.error("You seem to be offline", { description: "Check your connection and try again." }),
};

/** Copies text and confirms with the shared toast; false when the browser refused. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    notify.copied();
    return true;
  } catch {
    notify.copyFailed();
    return false;
  }
}
