"use client";

import { useCallback, useEffect, useState } from "react";
import { Tag as TagIcon, Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { THEME } from "@/lib/theme";

interface AdminTag {
  id: string;
  name: string;
  color: string;
  count: number;
}

export default function AdminTagsPage() {
  const [tags, setTags] = useState<AdminTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#7c3aed");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tags");
      const data = (await res.json()) as { tags?: AdminTag[]; error?: { message: string } };
      if (!res.ok) { toast.error(data.error?.message ?? "Failed to load tags."); return; }
      setTags(data.tags ?? []);
    } catch { toast.error("Network error."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Tag name required."); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/tags", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color }),
      });
      const data = (await res.json()) as { tag?: AdminTag; error?: { message: string } };
      if (!res.ok) { toast.error(data.error?.message ?? "Create failed."); return; }
      setName("");
      toast.success("Tag created");
      await load();
    } catch { toast.error("Network error."); }
    finally { setCreating(false); }
  }, [name, color, load]);

  const remove = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/tags/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: { message: string } };
      if (!res.ok) { toast.error(data.error?.message ?? "Delete failed."); return; }
      setTags(prev => prev.filter(t => t.id !== id));
      toast.success("Tag deleted");
    } catch { toast.error("Network error."); }
    finally { setDeletingId(null); }
  }, []);

  const inputStyle: React.CSSProperties = {
    padding: "9px 12px", borderRadius: 9, border: `1px solid ${THEME.border}`,
    background: THEME.surface2, color: THEME.text, fontSize: 13, outline: "none",
  };

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em" }}>Tags</h1>
        <p style={{ fontSize: 14, color: THEME.textDim, marginTop: 4 }}>Reusable labels for segmenting customers. Deleting a tag removes it from every customer.</p>
      </div>

      {/* Create form */}
      <form onSubmit={create} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 22, padding: 14, background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="New tag name…" aria-label="Tag name" style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 600 }}>Color</span>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} aria-label="Tag color" style={{ width: 38, height: 34, padding: 2, borderRadius: 8, border: `1px solid ${THEME.border}`, background: THEME.surface2, cursor: "pointer" }} />
        </label>
        <button type="submit" disabled={creating} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "none", background: THEME.brand, color: "#fff", fontSize: 13, fontWeight: 600, cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.6 : 1 }}>
          {creating ? <Loader2 size={14} aria-hidden="true" style={{ animation: "spin 0.8s linear infinite" }} /> : <Plus size={14} aria-hidden="true" />} Create tag
        </button>
      </form>

      <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: THEME.textDim }}>
            <Loader2 size={20} aria-hidden="true" style={{ animation: "spin 0.8s linear infinite" }} /> Loading…
          </div>
        ) : tags.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: THEME.textDim, fontSize: 14 }}>No tags yet. Create one above.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${THEME.border}`, background: THEME.surface1 }}>
                  {["Tag", "Usage", ""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tags.map(t => (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#fff", background: t.color, borderRadius: 999, padding: "4px 12px" }}>
                        <TagIcon size={11} aria-hidden="true" /> {t.name}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", color: THEME.textDim }}>
                      <span className="tnum" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Users size={12} aria-hidden="true" /> {t.count} {t.count === 1 ? "customer" : "customers"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      <button onClick={() => remove(t.id)} disabled={deletingId === t.id} aria-label={`Delete ${t.name}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, background: THEME.surface2, color: THEME.ai, border: `1px solid ${THEME.ai}44`, fontSize: 12, fontWeight: 600, cursor: deletingId === t.id ? "not-allowed" : "pointer", opacity: deletingId === t.id ? 0.6 : 1 }}>
                        {deletingId === t.id ? <Loader2 size={12} aria-hidden="true" style={{ animation: "spin 0.8s linear infinite" }} /> : <Trash2 size={12} aria-hidden="true" />} Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
