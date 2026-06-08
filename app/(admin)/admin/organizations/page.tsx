import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";
import { ORG_SEAT } from "@/lib/plans";
import { THEME } from "@/lib/theme";
import { Building2, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationsPage() {
  // Defense-in-depth: gate inside the page, not just the layout.
  if (!(await getAdminUser())) redirect("/dashboard");

  const orgs = await db.organization.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      owner: { select: { email: true } },
      _count: { select: { memberships: true, invitations: true } },
    },
  });

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em" }}>Organizations</h1>
        <p style={{ fontSize: 14, color: THEME.textDim, marginTop: 4 }}>Every team workspace and its seat usage.</p>
      </div>

      {orgs.length === 0 ? (
        <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 48, textAlign: "center" }}>
          <Building2 size={28} color={THEME.textMuted} style={{ marginBottom: 10 }} aria-hidden="true" />
          <p style={{ fontSize: 14, color: THEME.textDim }}>No organizations yet.</p>
        </div>
      ) : (
        <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${THEME.border}`, background: THEME.surface1 }}>
                  {["Organization", "Owner", "Seats", "Status", "Est. MRR", "Created"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orgs.map(o => (
                  <tr key={o.id} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: THEME.text }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <Building2 size={14} color={THEME.brand} aria-hidden="true" /> {o.name}
                      </div>
                      <div style={{ fontSize: 11, color: THEME.textMuted }}>/{o.slug}</div>
                    </td>
                    <td style={{ padding: "12px 14px", color: THEME.textDim }}>{o.owner.email}</td>
                    <td style={{ padding: "12px 14px", color: THEME.textDim }}>
                      <span className="tnum" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Users size={12} aria-hidden="true" /> {o._count.memberships} / {o.seatsTotal}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999,
                        background: o.status === "active" ? THEME.humanDim : THEME.warnDim,
                        color: o.status === "active" ? THEME.human : THEME.warn,
                      }}>{o.status}</span>
                    </td>
                    <td className="tnum" style={{ padding: "12px 14px", color: THEME.text, fontWeight: 600 }}>${(o.seatsTotal * ORG_SEAT.pricePerSeatMonthly).toLocaleString()}</td>
                    <td style={{ padding: "12px 14px", color: THEME.textDim, whiteSpace: "nowrap" }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
