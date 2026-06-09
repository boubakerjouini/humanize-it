"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Key, Plus, Copy, Check, Trash2, Lock } from "lucide-react";
import { THEME, glow } from "@/lib/theme";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  monthlyRequestCount: number;
  lastUsedAt: string | null;
  revokedAt: string | null;
}
interface ApiState {
  keys: ApiKey[];
  plan: string;
  apiAccess: boolean;
  apiRequestsLimit: number;
  apiKeysMax: number;
}

export function ApiKeysSection({ onUpgrade }: { onUpgrade: () => void }) {
  const [state, setState] = useState<ApiState | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/keys");
      if (res.ok) setState((await res.json()) as ApiState);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const active = state?.keys.filter((k) => !k.revokedAt) ?? [];
  const atLimit = state ? active.length >= state.apiKeysMax : false;

  async function create() {
    setCreating(true);
    try {
      const res = await fetch("/api/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() || "Default" }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error?.message ?? "Failed to create key."); return; }
      setRevealed(data.key as string);
      setName("");
      toast.success("API key created — copy it now, it won't be shown again.");
      void load();
    } catch { toast.error("Network error."); } finally { setCreating(false); }
  }

  async function revoke(id: string) {
    setRevoking(id);
    try {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Failed to revoke."); return; }
      toast.success("Key revoked.");
      void load();
    } catch { toast.error("Network error."); } finally { setRevoking(null); }
  }

  if (state && !state.apiAccess) {
    return (
      <div style={{ textAlign: "center", padding: "24px 16px", color: THEME.textMuted }}>
        <Lock size={20} aria-hidden="true" style={{ marginBottom: 8 }} />
        <div style={{ fontSize: 14, marginBottom: 14 }}>API access is available on Pro and Team.</div>
        <button onClick={onUpgrade} style={{ background: THEME.gradient, color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Upgrade to Pro</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {revealed && (
        <div style={{ background: THEME.brandDim, border: `1px solid ${THEME.brand}55`, borderRadius: THEME.radius, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: THEME.brandHi, marginBottom: 8 }}>Your new API key — copy it now, it won&apos;t be shown again:</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <code style={{ flex: 1, fontFamily: THEME.fontMono, fontSize: 13, color: THEME.text, background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: 7, padding: "8px 10px", overflow: "auto", whiteSpace: "nowrap" }}>{revealed}</code>
            <button onClick={() => { navigator.clipboard?.writeText(revealed); setCopied(true); }} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: THEME.brand, color: "#fff", border: "none", borderRadius: 7, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? "Copied" : "Copy"}</button>
          </div>
          <button onClick={() => { setRevealed(null); setCopied(false); }} style={{ marginTop: 10, background: "transparent", border: "none", color: THEME.textDim, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Done</button>
        </div>
      )}

      {active.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {active.map((k) => (
            <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 12, background: THEME.surface1, border: `1px solid ${THEME.border}`, borderRadius: THEME.radius, padding: "11px 14px" }}>
              <Key size={15} color={THEME.brandHi} aria-hidden="true" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: THEME.text }}>{k.name}</div>
                <div style={{ fontSize: 12, color: THEME.textMuted, fontFamily: THEME.fontMono }}>{k.keyPrefix}••••  ·  {k.monthlyRequestCount.toLocaleString()}/{state?.apiRequestsLimit.toLocaleString()} req/mo</div>
              </div>
              <button onClick={() => void revoke(k.id)} disabled={revoking === k.id} title="Revoke"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: `1px solid ${THEME.ai}44`, color: THEME.ai, borderRadius: 7, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <Trash2 size={13} aria-hidden="true" /> {revoking === k.id ? "…" : "Revoke"}
              </button>
            </div>
          ))}
        </div>
      )}

      {atLimit ? (
        <div style={{ fontSize: 12, color: THEME.textMuted }}>You&apos;ve reached your plan&apos;s limit of {state?.apiKeysMax} active keys.</div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name (e.g. Production)" aria-label="API key name"
            style={{ flex: 1, minWidth: 180, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: THEME.text, background: THEME.surface2, outline: "none", fontFamily: THEME.fontSans }} />
          <button onClick={create} disabled={creating} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: THEME.brand, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: glow(THEME.brand, 0.2) }}>
            <Plus size={14} aria-hidden="true" /> {creating ? "Creating…" : "Create key"}
          </button>
        </div>
      )}
    </div>
  );
}
