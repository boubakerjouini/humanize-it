import { renderToStaticMarkup } from "react-dom/server";
import { AdminShell } from "@/components/admin-shell";

jest.mock("next/navigation", () => ({ usePathname: () => "/admin/contacts" }));
jest.mock("@clerk/nextjs", () => ({ UserButton: () => null }));
jest.mock("next/link", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  return {
    __esModule: true,
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => createElement("a", { href, ...rest }, children),
  };
});

const html = renderToStaticMarkup(
  <AdminShell email="admin@example.com">
    <p>content</p>
  </AdminShell>
);
const hrefs = [...html.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]).filter((h) => h.startsWith("/admin"));

describe("AdminShell navigation", () => {
  it("keeps every existing admin link", () => {
    for (const href of [
      "/admin",
      "/admin/users",
      "/admin/organizations",
      "/admin/documents",
      "/admin/revenue",
      "/admin/growth",
      "/admin/codes",
      "/admin/redemptions",
      "/admin/tags",
      "/admin/audit",
    ]) {
      expect(hrefs).toContain(href);
    }
  });

  it("adds the CRM and email pages", () => {
    for (const href of [
      "/admin/funnel",
      "/admin/contacts",
      "/admin/pipeline",
      "/admin/tasks",
      "/admin/segments",
      "/admin/referrals",
      "/admin/campaigns",
      "/admin/sequences",
      "/admin/email-log",
    ]) {
      expect(hrefs).toContain(href);
    }
    expect(hrefs).toHaveLength(19);
  });

  it("groups links under CRM, Email, Money and System headers", () => {
    const order = ["CRM", "Email", "Money", "System"].map((title) => html.indexOf(`>${title}</div>`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html.indexOf('href="/admin/growth"')).toBeGreaterThan(html.indexOf(">Money</div>"));
  });

  it("marks only the current page as active", () => {
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/<a href="\/admin\/contacts" aria-current="page"/);
  });

  it("keeps the startsWith active check exact: no link is a prefix of another", () => {
    const sections = hrefs.filter((h) => h !== "/admin");
    for (const a of sections) {
      for (const b of sections) {
        if (a !== b) expect(b.startsWith(`${a}`)).toBe(false);
      }
    }
  });

  it("lets the sidebar scroll when it overflows", () => {
    expect(html).toMatch(/<nav aria-label="Admin"[^>]* style="[^"]*overflow-y:auto/);
  });
});
