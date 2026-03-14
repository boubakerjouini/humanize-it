"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Copy, Key, Plus, Trash2, Lock, CheckCircle2, Terminal,
  ExternalLink, AlertTriangle, X, Loader2, Clock,
} from "lucide-react";
import { toast } from "sonner";

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

// ── Usage Arc SVG ──────────────────────────────────────────

function UsageArc({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(1, used / limit) : 0;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const arcLength = circ * 0.75; // 270 degrees
  const offset = arcLength * (1 - pct);

  // Color transition: blue→orange→red
  let color = "#3b82f6";
  if (pct > 0.8) color = "#dc2626";
  else if (pct > 0.5) color = "#f59e0b";

  return (
    <svg width="140" height="120" viewBox="0 0 140 120">
      {/* Background arc */}
      <circle
        cx="70" cy="70" r={r}
        fill="none" stroke="#e5e7eb" strokeWidth="8"
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
        style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.5s ease" }}
      />
      {/* Center text */}
      <text x="70" y="65" textAnchor="middle" fill="#111827" fontSize="22" fontWeight="800" fontFamily="var(--font-geist-mono), monospace">
        {used.toLocaleString()}
      </text>
      <text x="70" y="82" textAnchor="middle" fill="#9ca3af" fontSize="10">
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
  };

  // ── Loading ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!state) return null;

  // ── FREE plan gate ───────────────────────────────────────

  if (!state.apiAccess) {
    return (
      <div className="min-h-full p-6 md:p-10">
        <div className="max-w-md mx-auto mt-20 text-center rounded-2xl border border-gray-200 bg-white p-10">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <Lock size={20} className="text-gray-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">API Access Required</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            The Developer API is available on Pro (1,000 req/mo) and Team (10,000 req/mo) plans.
            Integrate AI detection and humanization directly into your workflow.
          </p>
          <a
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
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
    <div className="min-h-full p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── A) Header ─────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Terminal size={16} className="text-blue-500" />
              <h1 className="text-lg font-bold text-gray-900">API Access</h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                {state.plan}
              </span>
            </div>
            <p className="text-sm text-gray-500">Integrate HumanizeIt into your apps</p>
          </div>
          <a
            href="/docs/api"
            target="_blank"
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-500 transition-colors"
          >
            View Documentation <ExternalLink size={11} />
          </a>
        </div>

        {/* ── B) Usage Card ─────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                API Usage &mdash; {currentMonth()}
              </h2>
              <div className="text-2xl font-extrabold text-gray-900">
                {totalUsage.toLocaleString()} <span className="text-sm font-normal text-gray-500">/ {state.apiRequestsLimit.toLocaleString()} requests</span>
              </div>
            </div>
            <UsageArc used={totalUsage} limit={state.apiRequestsLimit} />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock size={11} />
            Resets {activeKeys[0] ? formatDate(activeKeys[0].monthlyResetAt) : "next month"}
          </div>
        </div>

        {/* ── C) API Keys Section ───────────────────────── */}
        <div className="rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">API Keys</h2>
              <p className="text-xs text-gray-400 mt-0.5">Your secret API keys. Treat them like passwords.</p>
            </div>
            <button
              onClick={() => { setShowCreate(true); setRevealedKey(null); setCreateName(""); setKeySaved(false); }}
              disabled={atKeyLimit}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                atKeyLimit
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20"
              }`}
            >
              <Plus size={13} />
              Create new key
            </button>
          </div>

          {/* Keys list */}
          <div className="divide-y divide-gray-100">
            {activeKeys.length === 0 && revokedKeys.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mb-4 opacity-20">
                  <path d="M24 4C18.48 4 14 8.48 14 14c0 3.53 1.84 6.62 4.6 8.38L16 44h16l-2.6-21.62C32.16 20.62 34 17.53 34 14c0-5.52-4.48-10-10-10z" stroke="#111827" strokeWidth="1.5" strokeLinejoin="round"/>
                  <circle cx="24" cy="14" r="3" stroke="#111827" strokeWidth="1.5"/>
                </svg>
                <p className="text-sm text-gray-500 mb-1">No API keys yet</p>
                <p className="text-xs text-gray-400">Create your first key to start using the API</p>
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
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Revoked</p>
                {revokedKeys.map((k) => (
                  <KeyRow key={k.id} data={k} onCopy={() => {}} onRevoke={() => {}} isNew={false} />
                ))}
              </div>
            )}
          </div>

          {atKeyLimit && (
            <div className="px-5 py-3 border-t border-gray-100 text-xs text-amber-600 flex items-center gap-2">
              <AlertTriangle size={12} />
              Maximum {state.apiKeysMax} active keys on {state.plan} plan.
              {state.plan === "PRO" && <a href="/dashboard/settings" className="text-blue-600 hover:underline ml-1">Upgrade to Team</a>}
            </div>
          )}
        </div>

        {/* ── D) Create Key Modal ───────────────────────── */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => !revealedKey && closeReveal()}>
            <div
              className="relative w-full max-w-md mx-4 rounded-2xl border border-gray-200 bg-white shadow-2xl animate-fade-up"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={closeReveal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={16} />
              </button>

              {!revealedKey ? (
                // ── Create form ──
                <div className="p-6">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">Create a new API key</h3>
                  <label className="block text-xs text-gray-500 mb-1.5">Key name</label>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. Production, My App, Testing"
                    maxLength={50}
                    className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && !creating && handleCreate()}
                  />
                  <button
                    onClick={() => void handleCreate()}
                    disabled={creating}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-100 disabled:text-gray-400 text-white text-sm font-semibold transition-all"
                  >
                    {creating ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : <>Create key</>}
                  </button>
                </div>
              ) : (
                // ── Reveal state ──
                <div className="p-6">
                  <h3 className="text-sm font-semibold text-gray-800 mb-1">Your new API key</h3>
                  <p className="text-xs text-gray-500 mb-4">Copy it now. It will never be shown again.</p>

                  {/* Key display with pulsing blue border */}
                  <div className="relative rounded-xl border-2 border-blue-500 p-4 bg-gray-50 animate-[pulse-border_2s_ease-in-out_infinite]">
                    <code className="block text-sm font-mono text-blue-600 break-all leading-relaxed select-all">
                      {revealedKey}
                    </code>
                  </div>

                  <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 leading-relaxed">
                      Save this key now. It will never be shown again.
                    </p>
                  </div>

                  <button
                    onClick={() => void handleCopyRevealedKey()}
                    className={`mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                      keyCopied
                        ? "bg-green-50 border border-green-200 text-green-600"
                        : "bg-blue-600 hover:bg-blue-500 text-white"
                    }`}
                  >
                    {keyCopied ? <><CheckCircle2 size={14} /> Copied!</> : <><Copy size={14} /> Copy API Key</>}
                  </button>

                  <label className="flex items-center gap-2.5 mt-4 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={keySaved}
                      onChange={(e) => setKeySaved(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 bg-white text-blue-500 focus:ring-blue-500/30"
                    />
                    <span className="text-xs text-gray-500">I have saved my key</span>
                  </label>

                  <button
                    onClick={closeReveal}
                    disabled={!keySaved}
                    className="mt-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed bg-gray-100 hover:bg-gray-200 text-gray-600"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setRevokeTarget(null)}>
            <div
              className="relative w-full max-w-sm mx-4 rounded-2xl border border-gray-200 bg-white shadow-2xl animate-fade-up p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setRevokeTarget(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={16} />
              </button>

              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50">
                  <Trash2 size={14} className="text-red-500" />
                </div>
                <h3 className="text-sm font-semibold text-gray-800">Revoke API Key</h3>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed mb-4">
                Revoking <strong className="text-gray-800">{revokeTarget.name}</strong> will immediately break any apps using it. This cannot be undone.
              </p>

              <label className="block text-xs text-gray-500 mb-1.5">
                Type <span className="text-gray-700 font-mono">{revokeTarget.name}</span> to confirm
              </label>
              <input
                type="text"
                value={revokeConfirm}
                onChange={(e) => setRevokeConfirm(e.target.value)}
                placeholder={revokeTarget.name}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-red-500/50 transition-all"
                autoFocus
              />

              <button
                onClick={() => void handleRevoke()}
                disabled={revokeConfirm !== revokeTarget.name || revoking}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed bg-red-600 hover:bg-red-500 text-white"
              >
                {revoking ? <><Loader2 size={14} className="animate-spin" /> Revoking...</> : "Revoke key permanently"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Pulse border animation (inline style) ───────── */}
      <style>{`
        @keyframes pulse-border {
          0%, 100% { border-color: rgba(59,130,246,0.8); box-shadow: 0 0 12px rgba(59,130,246,0.15); }
          50% { border-color: rgba(59,130,246,0.3); box-shadow: 0 0 4px rgba(59,130,246,0.05); }
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
    <div className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${isNew ? "bg-blue-50" : ""} ${isRevoked ? "opacity-40" : "hover:bg-gray-50"}`}>
      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full shrink-0 ${isRevoked ? "bg-red-500" : "bg-green-500"}`} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-gray-800 truncate">{data.name}</span>
          {isNew && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 uppercase">New</span>}
        </div>
        <div className="flex items-center gap-2">
          <code className="text-xs font-mono text-gray-500 truncate">{masked}</code>
          {!isRevoked && (
            <button onClick={onCopy} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0" title="Copy prefix">
              <Copy size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-6 shrink-0">
        <div className="text-right">
          <div className="text-xs text-gray-500 font-mono">{data.monthlyRequestCount.toLocaleString()}</div>
          <div className="text-[10px] text-gray-400">requests</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">{timeAgo(data.lastUsedAt)}</div>
          <div className="text-[10px] text-gray-400">last used</div>
        </div>
      </div>

      {/* Revoke button */}
      {!isRevoked && (
        <button
          onClick={onRevoke}
          className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
          title="Revoke key"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}
