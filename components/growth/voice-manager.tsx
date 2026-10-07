"use client";

// ===========================================================
// components/growth/voice-manager.tsx — The Voice profiles screen: create a
// Voice Match profile from 2-3 samples the user wrote, then list, rename or
// delete profiles. Plan limits come from GET /api/voice-profiles; Free sees
// an upgrade prompt instead of the form. Only the style description is
// stored, never the samples, and the copy says so.
// ===========================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AudioLines, Lock, Pencil, Trash2, Check, X, ArrowUpRight, Wand2 } from "lucide-react";
import { THEME, glow } from "@/lib/theme";
import { PRO_ANNUAL_VOICE_PROFILES } from "@/lib/plans";
import { UpgradeModal } from "@/components/ui/upgrade-modal";

export type VoiceProfileRow = { id: string; name: string; sampleWords: number; createdAt: string; usable: boolean };
type VoiceList = { profiles: VoiceProfileRow[]; limit: number; used: number; plan: string; annual: boolean; founding: boolean };

const MIN_CHARS = 50;
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export function VoiceManager() {
  const [data, setData] = useState<VoiceList | null>(null);
  const [failed, setFailed] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/voice-profiles");
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as VoiceList);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const locked = data !== null && data.limit === 0;
  const canCreate = data !== null && data.used < data.limit;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 24px 64px", fontFamily: THEME.fontSans }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em", margin: "0 0 4px" }}>Voice profiles</h1>
      <p style={{ fontSize: 14, color: THEME.textDim, margin: "0 0 22px", lineHeight: 1.6 }}>
        Paste 2 or 3 things you wrote yourself. Voice Match reads how you write (sentence length, word choice, punctuation habits) and every rewrite then follows it.
      </p>

      {failed && <Panel><p style={{ margin: 0, fontSize: 13, color: THEME.ai }}>Couldn&apos;t load your voice profiles. Refresh to try again.</p></Panel>}
      {!data && !failed && <Panel><p style={{ margin: 0, fontSize: 13, color: THEME.textMuted }}>Loading…</p></Panel>}

      {locked && (
        <Panel>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", width: 38, height: 38, borderRadius: 10, background: THEME.brandDim, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Lock size={18} color={THEME.brandHi} aria-hidden="true" />
            </span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading }}>Voice Match is part of Pro and Team</h2>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: THEME.textDim, lineHeight: 1.6 }}>
                {`Pro includes 1 voice (${PRO_ANNUAL_VOICE_PROFILES} on annual), Team includes 10, for example one per client.`}
              </p>
              <button onClick={() => setUpgradeOpen(true)} style={primaryBtn(true)}>
                See plans <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
          {data.profiles.length > 0 && (
            <p style={{ margin: "14px 0 0", fontSize: 12, color: THEME.textMuted }}>
              Your saved profiles are kept. They work again as soon as you&apos;re back on a plan that includes them.
            </p>
          )}
        </Panel>
      )}

      {data && !locked && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, margin: "0 0 12px" }}>
          <span className="tnum" style={{ fontSize: 13, color: THEME.textDim }}>
            {`${data.used} of ${data.limit} ${data.limit === 1 ? "profile" : "profiles"} used`}
          </span>
          {data.plan === "PRO" && data.limit < PRO_ANNUAL_VOICE_PROFILES && (
            <span style={{ fontSize: 12, color: THEME.textMuted }}>{`Annual Pro includes ${PRO_ANNUAL_VOICE_PROFILES} voices.`}</span>
          )}
        </div>
      )}

      {data && canCreate && <CreateVoice onCreated={() => void load()} />}
      {data && !locked && !canCreate && (
        <p style={{ fontSize: 13, color: THEME.textMuted, margin: "0 0 4px" }}>Every voice in your plan is in use. Delete one to create another.</p>
      )}

      {data && data.profiles.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
          {data.profiles.map((p) => <VoiceRow key={p.id} profile={p} onChanged={() => void load()} />)}
        </div>
      )}

      {data && !locked && data.profiles.length > 0 && (
        <p style={{ fontSize: 13, color: THEME.textDim, marginTop: 18 }}>
          Pick a voice from the <strong>Voice</strong> menu in the{" "}
          <Link href="/dashboard" style={{ color: THEME.brandHi, fontWeight: 600, textDecoration: "none" }}>editor</Link> before you humanize.
        </p>
      )}

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} currentPlan={data?.plan ?? "FREE"} trigger="feature" />
    </div>
  );
}

function CreateVoice({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("My voice");
  const [samples, setSamples] = useState(["", "", ""]);
  const [busy, setBusy] = useState(false);

  const filled = samples.filter((s) => s.trim().length > 0);
  const tooShort = filled.some((s) => s.trim().length < MIN_CHARS);
  const ready = name.trim().length > 0 && filled.length >= 2 && !tooShort && !busy;

  async function create() {
    if (!ready) return;
    setBusy(true);
    try {
      const res = await fetch("/api/voice-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), samples: filled }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) { toast.error(d.error?.message ?? "Couldn't create the voice."); return; }
      toast.success("Voice saved");
      setSamples(["", "", ""]);
      onCreated();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <h2 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, display: "flex", alignItems: "center", gap: 8 }}>
        <AudioLines size={16} color={THEME.brand} aria-hidden="true" /> New voice
      </h2>
      <label style={labelStyle}>
        Name
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder="e.g. Academic, LinkedIn, Client: Acme"
          style={{ ...fieldStyle, marginTop: 6 }} />
      </label>
      {samples.map((s, i) => (
        <label key={i} style={{ ...labelStyle, marginTop: 12 }}>
          <span style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{`Sample ${i + 1}${i === 2 ? " (optional)" : ""}`}</span>
            <span className="tnum" style={{ color: s.trim() && s.trim().length < MIN_CHARS ? THEME.warn : THEME.textMuted, fontWeight: 500 }}>{`${words(s)} words`}</span>
          </span>
          <textarea value={s} onChange={(e) => setSamples((prev) => prev.map((v, j) => (j === i ? e.target.value.slice(0, 6000) : v)))}
            placeholder={i === 0 ? "Paste an email, essay paragraph or post you wrote yourself…" : "Another piece in the same kind of writing…"}
            rows={5} style={{ ...fieldStyle, marginTop: 6, resize: "vertical", lineHeight: 1.6 }} />
        </label>
      ))}
      <p style={{ fontSize: 12, color: THEME.textMuted, margin: "10px 0 14px", lineHeight: 1.6 }}>
        {`Use writing that is yours, at least ${MIN_CHARS} characters each; a few paragraphs works best. We keep a short description of your style, not the samples.`}
      </p>
      <button onClick={create} disabled={!ready} style={primaryBtn(ready)}>
        <Wand2 size={14} aria-hidden="true" /> {busy ? "Reading your voice…" : "Create voice"}
      </button>
    </Panel>
  );
}

function VoiceRow({ profile, onChanged }: { profile: VoiceProfileRow; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function rename() {
    if (!name.trim() || name.trim() === profile.name) { setEditing(false); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/voice-profiles/${profile.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
      if (!res.ok) throw new Error(String(res.status));
      setEditing(false);
      onChanged();
    } catch {
      toast.error("Couldn't rename the voice.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/voice-profiles/${profile.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      toast.success("Voice deleted");
      onChanged();
    } catch {
      toast.error("Couldn't delete the voice.");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radius, padding: "12px 14px", opacity: profile.usable ? 1 : 0.7 }}>
      <AudioLines size={16} color={profile.usable ? THEME.brand : THEME.textMuted} aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 160 }}>
        {editing ? (
          <input autoFocus value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} aria-label="Voice name"
            onKeyDown={(e) => { if (e.key === "Enter") void rename(); if (e.key === "Escape") { setName(profile.name); setEditing(false); } }}
            style={{ ...fieldStyle, padding: "6px 8px" }} />
        ) : (
          <div style={{ fontSize: 14, fontWeight: 600, color: THEME.text, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {profile.name}
            {!profile.usable && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: THEME.textMuted, background: THEME.surface3, borderRadius: 100, padding: "2px 8px" }}>
                <Lock size={10} aria-hidden="true" /> Not in your plan
              </span>
            )}
          </div>
        )}
        <div className="tnum" style={{ fontSize: 12, color: THEME.textMuted, marginTop: 2 }}>
          {`From ${profile.sampleWords.toLocaleString("en-US")} words · ${new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
        </div>
      </div>
      {editing ? (
        <>
          <IconBtn label="Save name" onClick={() => void rename()} disabled={busy}><Check size={15} aria-hidden="true" /></IconBtn>
          <IconBtn label="Cancel" onClick={() => { setName(profile.name); setEditing(false); }} disabled={busy}><X size={15} aria-hidden="true" /></IconBtn>
        </>
      ) : confirming ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: THEME.text }}>
          Delete this voice?
          <button onClick={() => void remove()} disabled={busy} style={{ ...smallBtn, background: THEME.aiDim, color: THEME.ai, borderColor: `${THEME.ai}55` }}>Delete</button>
          <button onClick={() => setConfirming(false)} disabled={busy} style={smallBtn}>Keep</button>
        </span>
      ) : (
        <>
          <IconBtn label="Rename" onClick={() => setEditing(true)}><Pencil size={14} aria-hidden="true" /></IconBtn>
          <IconBtn label="Delete" onClick={() => setConfirming(true)}><Trash2 size={14} aria-hidden="true" /></IconBtn>
        </>
      )}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 18, marginBottom: 14 }}>{children}</div>;
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} title={label} aria-label={label}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, background: THEME.surface2, color: THEME.textDim, border: `1px solid ${THEME.border}`, borderRadius: 9, cursor: disabled ? "wait" : "pointer" }}>
      {children}
    </button>
  );
}

const primaryBtn = (enabled: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 6,
  background: enabled ? THEME.gradient : THEME.surface3, color: enabled ? "#fff" : THEME.textMuted,
  border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700,
  cursor: enabled ? "pointer" : "not-allowed", boxShadow: enabled ? glow(THEME.brand, 0.28) : "none", fontFamily: THEME.fontSans,
});
const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: THEME.textDim };
const fieldStyle: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 14, color: THEME.text, background: THEME.surface1, outline: "none", fontFamily: THEME.fontSans };
const smallBtn: React.CSSProperties = { background: THEME.surface3, color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: THEME.fontSans };
