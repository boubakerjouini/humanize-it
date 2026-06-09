import { notFound } from "next/navigation";

// Every published post has its own statically-routed directory (one folder per
// slug in lib/posts-metadata.ts). This catch-all therefore only ever receives
// UNKNOWN slugs, which must 404. It must NOT redirect to `/blog/${slug}` — for
// any post lacking a named directory that redirect targets this same route and
// loops forever (which is exactly what happened to /blog/undetectable-ai-alternative).
export default function BlogSlugPage() {
  notFound();
}
