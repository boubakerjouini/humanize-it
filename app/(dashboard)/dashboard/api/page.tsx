"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Copy, Plus, Trash2, Lock, CheckCircle2, Terminal,
  ExternalLink, AlertTriangle, X, Loader2, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { THEME } from "@/lib/theme";

// ── Types ──────────────────────────────────────────────────

interface ApiKeyData {
  id: string;
  name: string;
  keyPrefix: string;
  monthlyRequestCount: number;
  monthlyResetAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

interface ApiState {
  keys: ApiKeyData[];
  plan: string;
  apiAccess: boolean;
  apiRequestsLimit: number;
  apiKeysMax: number;
}

// ── Helpers ────────────────────────────────────────────────

function timeAgo(date: string | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function currentMonth(): string {
  return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ── Usage Arc SVG (API request consumption gauge — not a human score) ──

function UsageArc({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(1, used / limit) : 0;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const arcLength = circ * 0.75; // 270 degrees
  const offset = arcLength * (1 - pct);

  // Color transition: brand→amber→red as consumption rises
  let color: string = THEME.brand;
  if (pct > 0.8) color = THEME.ai;
  else if (pct > 0.5) color = THEME.warn;

  return (
    <svg width="140" height="120" viewBox="0 0 140 120" aria-hidden="true">
      {/* Background arc */}
      <circle
        cx="70" cy="70" r={r}
        fill="none" stroke={THEME.border} strokeWidth="8"
        strokeDasharray={`${arcLength} ${circ}`}
        strokeDashoffset="0"
        strokeLinecap="round"
        transform="rotate(135 70 70)"
      />
      {/* Filled arc */}
      <circle
        cx="70" cy="70" r={r}
        fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${arcLength} ${circ}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(135 70 70)"
        style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.5s ease", filter: `drop-shadow(0 0 6px ${color}66)` }}
      />
      {/* Center text */}
      <text x="70" y="65" textAnchor="middle" fill={THEME.text} fontSize="22" fontWeight="700" fontFamily={THEME.fontMono} style={{ fontVariantNumeric: "tabular-nums" }}>
        {used.toLocaleString()}
      </text>
      <text x="70" y="82" textAnchor="middle" fill={THEME.textMuted} fontSize="10" fontFamily={THEME.fontMono}>
        of {limit.toLocaleString()}
      </text>
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────

export default function ApiPage() {
  const [state, setState] = useState<ApiState | null>(null);
  const [loading, setLoading] = useState(true);

  // Create key modal
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  // Revoke modal
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyData | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState("");
  const [revoking, setRevoking] = useState(false);

  // Focus-return refs for modals
  const createTriggerRef = useRef<HTMLButtonElement>(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/keys");
      const data = (await res.json()) as ApiState;
      setState(data);
    } catch {
      toast.error("Failed to load API keys.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchState(); }, [fetchState]);

  // ── Handlers ─────────────────────────────────────────────

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim() || "Default" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? "Failed to create key.");
        return;
      }
      setRevealedKey(data.key);
      setRevealedId(data.id);
      toast.success("API key created!");
      void fetchState();
    } catch {
      toast.error("Network error.");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/keys/${revokeTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error?.message ?? "Failed to revoke key.");
        return;
      }
      toast.success("API key revoked.");
      setRevokeTarget(null);
      setRevokeConfirm("");
      void fetchState();
    } catch {
      toast.error("Network error.");
    } finally {
      setRevoking(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const handleCopyRevealedKey = async () => {
    if (!revealedKey) return;
    await copyToClipboard(revealedKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  const closeReveal = () => {
    setRevealedKey(null);
    setRevealedId(null);
    setKeyCopied(false);
    setKeySaved(false);
    setShowCreate(false);
    setCreateName("");
    createTriggerRef.current?.focus();
  };

  // ESC to close modals
  useEffect(() => {
    if (!showCreate && !revokeTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (revokeTarget) { setRevokeTarget(null); setRevokeConfirm(""); }
      else if (showCreate && !revealedKey) closeReveal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreate, revokeTarget, revealedKey]);

  // ── Loading ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={20} className="animate-spin text-[var(--text-dim)]" aria-label="Loading" />
      </div>
    );
  }

  if (!state) return null;

  // ── FREE plan gate ───────────────────────────────────────

  if (!state.apiAccess) {
    return (
      <div className="min-h-full p-6 md:p-10">
        <div className="max-w-md mx-auto mt-20 text-center rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-10">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-3)]">
            <Lock size={20} className="text-[var(--text-dim)]" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text)] mb-2" style={{ fontFamily: THEME.fontHeading }}>API Access Required</h2>
          <p className="text-sm text-[var(--text-dim)] leading-relaxed mb-6">
            The Developer API is available on Pro (1,000 req/mo) and Team (10,000 req/mo) plans.
            Integrate AI detection and humanization directly into your workflow.
          </p>
          <a
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hi)] text-white text-sm font-semibold transition-colors"
          >
            Upgrade Plan
          </a>
        </div>
      </div>
    );
  }

  // ── Data ─────────────────────────────────────────────────

  const activeKeys = state.keys.filter((k) => !k.revokedAt);
  const revokedKeys = state.keys.filter((k) => k.revokedAt);
  const totalUsage = state.keys.reduce((sum, k) => sum + (k.revokedAt ? 0 : k.monthlyRequestCount), 0);
  const atKeyLimit = activeKeys.length >= state.apiKeysMax;

  return (
    <div className="min-h-full p-4 md:p-8" style={{ fontFamily: THEME.fontSans }}>
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── A) Header ─────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Terminal size={16} className="text-[var(--brand-hi)]" aria-hidden="true" />
              <h1 className="text-lg font-bold text-[var(--text)]" style={{ fontFamily: THEME.fontHeading }}>API Access</h1>
              <span className="mono text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--brand-dim)] text-[var(--brand-hi)] border border-[var(--brand)]/40">
                {state.plan}
              </span>
            </div>
            <p className="text-sm text-[var(--text-dim)]">Integrate HumanizeIt into your apps</p>
          </div>
          <a
            href="/docs/api"
            target="_blank"
            className="flex items-center gap-1.5 text-xs text-[var(--brand-hi)] hover:text-[var(--brand)] transition-colors"
          >
            View Documentation <ExternalLink size={11} aria-hidden="true" />
          </a>
        </div>

        {/* ── B) Usage Card ─────────────────────────────── */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="mono text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1">
                API Usage &mdash; {currentMonth()}
              </h2>
              <div className="tnum text-2xl font-bold text-[var(--text)]">
                {totalUsage.toLocaleString()} <span className="text-sm font-normal text-[var(--text-dim)]">/ {state.apiRequestsLimit.toLocaleString()} requests</span>
              </div>
            </div>
            <UsageArc used={totalUsage} limit={state.apiRequestsLimit} />
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Clock size={11} aria-hidden="true" />
            Resets {activeKeys[0] ? formatDate(activeKeys[0].monthlyResetAt) : "next month"}
          </div>
        </div>

        {/* ── C) API Keys Section ───────────────────────── */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]">
          <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
            <div>
              <h2 className="mono text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wider">API Keys</h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Your secret API keys. Treat them like passwords.</p>
            </div>
            <button
              ref={createTriggerRef}
              onClick={() => { setShowCreate(true); setRevealedKey(null); setCreateName(""); setKeySaved(false); }}
              disabled={atKeyLimit}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                atKeyLimit
                  ? "bg-[var(--surface-3)] text-[var(--text-muted)] cursor-not-allowed"
                  : "bg-[var(--brand)] hover:bg-[var(--brand-hi)] text-white shadow-md shadow-[var(--brand)]/30"
              }`}
            >
              <Plus size={13} aria-hidden="true" />
              Create new key
            </button>
          </div>

          {/* Keys list */}
          <div className="divide-y divide-[var(--border)]">
            {activeKeys.length === 0 && revokedKeys.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mb-4 opacity-20" aria-hidden="true">
                  <path d="M24 4C18.48 4 14 8.48 14 14c0 3.53 1.84 6.62 4.6 8.38L16 44h16l-2.6-21.62C32.16 20.62 34 17.53 34 14c0-5.52-4.48-10-10-10z" stroke={THEME.text} strokeWidth="1.5" strokeLinejoin="round"/>
                  <circle cx="24" cy="14" r="3" stroke={THEME.text} strokeWidth="1.5"/>
                </svg>
                <p className="text-sm text-[var(--text-dim)] mb-1">No API keys yet</p>
                <p className="text-xs text-[var(--text-muted)]">Create your first key to start using the API</p>
              </div>
            )}

            {activeKeys.map((k) => (
              <KeyRow
                key={k.id}
                data={k}
                onCopy={() => { void copyToClipboard(`${k.keyPrefix}${"•".repeat(24)}`); toast.success("Key prefix copied"); }}
                onRevoke={() => { setRevokeTarget(k); setRevokeConfirm(""); }}
                isNew={k.id === revealedId}
              />
            ))}

            {revokedKeys.length > 0 && (
              <div className="px-5 py-3">
                <p className="mono text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Revoked</p>
                {revokedKeys.map((k) => (
                  <KeyRow key={k.id} data={k} onCopy={() => {}} onRevoke={() => {}} isNew={false} />
                ))}
              </div>
            )}
          </div>

          {atKeyLimit && (
            <div className="px-5 py-3 border-t border-[var(--border)] text-xs text-[var(--warn)] flex items-center gap-2">
              <AlertTriangle size={12} aria-hidden="true" />
              Maximum {state.apiKeysMax} active keys on {state.plan} plan.
              {state.plan === "PRO" && <a href="/dashboard/settings" className="text-[var(--brand-hi)] hover:underline ml-1">Upgrade to Team</a>}
            </div>
          )}
        </div>

        {/* ── D) Create Key Modal ───────────────────────── */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !revealedKey && closeReveal()}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-key-title"
              className="relative w-full max-w-md mx-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] shadow-2xl animate-fade-up"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={closeReveal} aria-label="Close dialog" className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                <X size={16} aria-hidden="true" />
              </button>

              {!revealedKey ? (
                // ── Create form ──
                <div className="p-6">
                  <h3 id="create-key-title" className="text-sm font-semibold text-[var(--text)] mb-4" style={{ fontFamily: THEME.fontHeading }}>Create a new API key</h3>
                  <label htmlFor="api-key-name" className="block text-xs text-[var(--text-dim)] mb-1.5">Key name</label>
                  <input
                    id="api-key-name"
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. Production, My App, Testing"
                    maxLength={50}
                    className="mono w-full px-3 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--brand)]/60 focus:ring-1 focus:ring-[var(--brand)]/30 transition-all"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && !creating && handleCreate()}
                  />
                  <button
                    onClick={() => void handleCreate()}
                    disabled={creating}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-hi)] disabled:bg-[var(--surface-3)] disabled:text-[var(--text-muted)] text-white text-sm font-semibold transition-all"
                  >
                    {creating ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Creating...</> : <>Create key</>}
                  </button>
                </div>
              ) : (
                // ── Reveal state ──
                <div className="p-6">
                  <h3 id="create-key-title" className="text-sm font-semibold text-[var(--text)] mb-1" style={{ fontFamily: THEME.fontHeading }}>Your new API key</h3>
                  <p className="text-xs text-[var(--text-dim)] mb-4">Copy it now. It will never be shown again.</p>

                  {/* Key display with pulsing brand border */}
                  <div className="relative rounded-xl border-2 border-[var(--brand)] p-4 bg-[var(--surface-2)] animate-[pulse-border_2s_ease-in-out_infinite]">
                    <code className="block text-sm font-mono text-[var(--brand-hi)] break-all leading-relaxed select-all">
                      {revealedKey}
                    </code>
                  </div>

                  <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-[var(--warn-dim)] border border-[var(--warn)]/40">
                    <AlertTriangle size={13} className="text-[var(--warn)] mt-0.5 shrink-0" aria-hidden="true" />
                    <p className="text-xs text-[var(--warn)] leading-relaxed">
                      Save this key now. It will never be shown again.
                    </p>
                  </div>

                  <button
                    onClick={() => void handleCopyRevealedKey()}
                    className={`mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                      keyCopied
                        ? "bg-[var(--human-dim)] border border-[var(--human)]/40 text-[var(--human)]"
                        : "bg-[var(--brand)] hover:bg-[var(--brand-hi)] text-white"
                    }`}
                  >
                    {keyCopied ? <><CheckCircle2 size={14} aria-hidden="true" /> Copied!</> : <><Copy size={14} aria-hidden="true" /> Copy API Key</>}
                  </button>

                  <label className="flex items-center gap-2.5 mt-4 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={keySaved}
                      onChange={(e) => setKeySaved(e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--border)] bg-[var(--surface-2)] accent-[var(--brand)] focus:ring-[var(--brand)]/40"
                    />
                    <span className="text-xs text-[var(--text-dim)]">I have saved my key</span>
                  </label>

                  <button
                    onClick={closeReveal}
                    disabled={!keySaved}
                    className="mt-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:bg-[var(--surface-2)] disabled:text-[var(--text-muted)] disabled:cursor-not-allowed bg-[var(--surface-3)] hover:bg-[var(--border-strong)] text-[var(--text-dim)]"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── E) Revoke Confirmation Modal ──────────────── */}
        {revokeTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setRevokeTarget(null); setRevokeConfirm(""); }}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="revoke-key-title"
              className="relative w-full max-w-sm mx-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] shadow-2xl animate-fade-up p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => { setRevokeTarget(null); setRevokeConfirm(""); }} aria-label="Close dialog" className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                <X size={16} aria-hidden="true" />
              </button>

              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ai-dim)]">
                  <Trash2 size={14} className="text-[var(--ai)]" aria-hidden="true" />
                </div>
                <h3 id="revoke-key-title" className="text-sm font-semibold text-[var(--text)]" style={{ fontFamily: THEME.fontHeading }}>Revoke API Key</h3>
              </div>

              <p className="text-xs text-[var(--text-dim)] leading-relaxed mb-4">
                Revoking <strong className="text-[var(--text)]">{revokeTarget.name}</strong> will immediately break any apps using it. This cannot be undone.
              </p>

              <label htmlFor="revoke-confirm" className="block text-xs text-[var(--text-dim)] mb-1.5">
                Type <span className="text-[var(--text)] font-mono">{revokeTarget.name}</span> to confirm
              </label>
              <input
                id="revoke-confirm"
                type="text"
                value={revokeConfirm}
                onChange={(e) => setRevokeConfirm(e.target.value)}
                placeholder={revokeTarget.name}
                className="mono w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--ai)]/60 transition-all"
                autoFocus
              />

              <button
                onClick={() => void handleRevoke()}
                disabled={revokeConfirm !== revokeTarget.name || revoking}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:bg-[var(--surface-2)] disabled:text-[var(--text-muted)] disabled:cursor-not-allowed bg-[var(--ai)] hover:opacity-90 text-white"
              >
                {revoking ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Revoking...</> : "Revoke key permanently"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Pulse border animation (inline style) ───────── */}
      <style>{`
        @keyframes pulse-border {
          0%, 100% { border-color: ${THEME.brand}; box-shadow: 0 0 12px ${THEME.brand}40; }
          50% { border-color: ${THEME.brand}66; box-shadow: 0 0 4px ${THEME.brand}1a; }
        }
      `}</style>
    </div>
  );
}

// ── Key Row Component ──────────────────────────────────────

function KeyRow({
  data,
  onCopy,
  onRevoke,
  isNew,
}: {
  data: ApiKeyData;
  onCopy: () => void;
  onRevoke: () => void;
  isNew: boolean;
}) {
  const isRevoked = !!data.revokedAt;
  const masked = `${data.keyPrefix}${"•".repeat(24)}`;

  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${isNew ? "bg-[var(--brand-dim)]" : ""} ${isRevoked ? "opacity-40" : "hover:bg-[var(--surface-3)]"}`}>
      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full shrink-0 ${isRevoked ? "bg-[var(--ai)]" : "bg-[var(--human)]"}`} aria-hidden="true" />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-[var(--text)] truncate">{data.name}</span>
          {isNew && <span className="mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-dim)] text-[var(--brand-hi)] uppercase">New</span>}
        </div>
        <div className="flex items-center gap-2">
          <code className="text-xs font-mono text-[var(--text-dim)] truncate">{masked}</code>
          {!isRevoked && (
            <button onClick={onCopy} className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors shrink-0" title="Copy prefix" aria-label="Copy key prefix">
              <Copy size={11} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-6 shrink-0">
        <div className="text-right">
          <div className="tnum text-xs text-[var(--text-dim)]">{data.monthlyRequestCount.toLocaleString()}</div>
          <div className="text-[10px] text-[var(--text-muted)]">requests</div>
        </div>
        <div className="text-right">
          <div className="mono text-xs text-[var(--text-dim)]">{timeAgo(data.lastUsedAt)}</div>
          <div className="text-[10px] text-[var(--text-muted)]">last used</div>
        </div>
      </div>

      {/* Revoke button */}
      {!isRevoked && (
        <button
          onClick={onRevoke}
          className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--ai)] hover:bg-[var(--ai-dim)] transition-all shrink-0"
          title="Revoke key"
          aria-label={`Revoke key ${data.name}`}
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
