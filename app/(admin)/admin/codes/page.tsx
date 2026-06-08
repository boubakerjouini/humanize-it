"use client";

import { useCallback, useEffect, useState } from "react";
import { Ticket, Plus, Copy, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { THEME } from "@/lib/theme";

interface Code {
  id: string;
  code: string;
  plan: string;
  maxUses: number;
  usedCount: number;
  grantDays: number | null;
  createdAt: string;
  _count: { redemptions: number };
}

export default function AdminCodesPage() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New code form
  const [plan, setPlan] = useState<"PRO" | "TEAM">("PRO");
  const [maxUses, setMaxUses] = useState(1);
  const [lifetime, setLifetime] = useState(false);
  const [grantDays, setGrantDays] = useState(365);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/codes");
      const data = await res.json() as { codes?: Code[]; error?: { message: string } };
      if (!res.ok) { toast.error(data.error?.message ?? "Failed to load codes."); return; }
      setCodes(data.codes ?? []);
    } catch { toast.error("Network error."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/codes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, maxUses, grantDays: lifetime ? null : grantDays }),
      });
      const data = await res.json() as { code?: Code; error?: { message: string } };
      if (!res.ok || !data.code) { toast.error(data.error?.message ?? "Failed to create code."); return; }
      setCodes(prev => [data.code!, ...prev]);
      toast.success(`Created ${data.code.code}`);
    } catch { toast.error("Network error."); }
    finally { setCreating(false); }
  };

  const copy = async (c: Code) => {
    await navigator.clipboard.writeText(c.code);
    setCopiedId(c.id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em" }}>Discount codes</h1>
        <p style={{ fontSize: 14, color: THEME.textDim, marginTop: 4 }}>Generate redeemable codes that grant Pro or Team access.</p>
      </div>

      {/* Create form */}
      <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
          <Field label="Plan">
            <select value={plan} onChange={e => setPlan(e.target.value as "PRO" | "TEAM")} style={inputStyle}>
              <option value="PRO">PRO</option>
              <option value="TEAM">TEAM</option>
            </select>
          </Field>
          <Field label="Max uses">
            <input type="number" min={1} value={maxUses} onChange={e => setMaxUses(Math.max(1, Number(e.target.value)))} style={{ ...inputStyle, width: 90 }} />
          </Field>
          <Field label="Duration">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" min={1} value={grantDays} disabled={lifetime} onChange={e => setGrantDays(Math.max(1, Number(e.target.value)))} style={{ ...inputStyle, width: 90, opacity: lifetime ? 0.4 : 1 }} />
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: THEME.textDim, cursor: "pointer" }}>
                <input type="checkbox" checked={lifetime} onChange={e => setLifetime(e.target.checked)} /> Lifetime
              </label>
            </div>
          </Field>
          <button onClick={create} disabled={creating} style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, border: "none",
            background: THEME.brand, color: "#fff", fontSize: 13, fontWeight: 700, cursor: creating ? "not-allowed" : "pointer",
          }}>
            {creating ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />} Generate
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: THEME.textDim }}>Loading…</div>
        ) : codes.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: THEME.textDim }}>
            <Ticket size={26} color={THEME.textMuted} style={{ marginBottom: 8 }} aria-hidden="true" />
            <p style={{ fontSize: 14 }}>No codes yet — generate your first above.</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${THEME.border}`, background: THEME.surface1 }}>
                {["Code", "Plan", "Uses", "Duration", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {codes.map(c => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                  <td style={{ padding: "12px 14px", fontFamily: THEME.fontMono, fontWeight: 600, color: THEME.text }}>{c.code}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: THEME.brandDim, color: THEME.brandHi }}>{c.plan}</span>
                  </td>
                  <td className="tnum" style={{ padding: "12px 14px", color: THEME.textDim }}>{c.usedCount} / {c.maxUses}</td>
                  <td style={{ padding: "12px 14px", color: THEME.textDim }}>{c.grantDays === null ? "Lifetime" : `${c.grantDays} days`}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>
                    <button onClick={() => copy(c)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, border: `1px solid ${THEME.border}`, background: THEME.surface1, color: THEME.textDim, fontSize: 12, cursor: "pointer" }}>
                      {copiedId === c.id ? <CheckCircle2 size={12} color={THEME.human} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />} {copiedId === c.id ? "Copied" : "Copy"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px", borderRadius: 8, border: `1px solid ${THEME.border}`,
  background: THEME.surface1, color: THEME.text, fontSize: 13, outline: "none",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: THEME.textDim }}>{label}</span>
      {children}
    </div>
  );
}
