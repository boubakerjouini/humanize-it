"use client";

// ===========================================================
// components/ui/upgrade-modal.tsx — The plan menu: opened from upgrade buttons
// and, with trigger="quota", when a request hits the plan's limit. A
// Monthly/Annual toggle (annual pre-selected) sends { plan, annual } to
// /api/checkout; annual prices are shown per month (≈$6.58/mo for Pro).
// Opened with an intent (a plan picked on the pricing page before sign-up),
// it shows that billing period and marks that plan's card.
// On a quota hit, two cheaper ways out sit under the plans: the Word Pack
// (only once its Polar product exists) and inviting a friend (only
// while referrals are on). Prices, limits and the guarantee come from
// lib/plans.ts. While new payments are paused, /api/checkout answers
// CHECKOUT_PAUSED and the plans give way to a calm notice, not an error.
//
// A native <dialog> opened with showModal(): the browser keeps focus inside,
// makes the page behind it inert, closes it on Esc and returns focus to the
// button that opened it. Plans sit side by side on desktop, stack at 640px
// and below, and on phones the menu becomes a full-height sheet whose header
// (title + close) stays put while the plans scroll under it.
// ===========================================================

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { track } from "@vercel/analytics";
import { Check, CirclePause, X, Package, Gift, ShieldCheck } from "lucide-react";
import { THEME, glow } from "@/lib/theme";
import { GUARANTEE_DAYS, PLANS as PLAN_CONFIG, TEAM_ANNUAL_GUARANTEE_DAYS, type PlanConfig, type PlanId } from "@/lib/plans";
import type { CheckoutIntent, CheckoutPlan } from "@/lib/checkout-intent";
import { requestCheckout } from "@/components/checkout-outcome";
import { startOfferCheckout, useOffers, type OffersInfo } from "@/components/growth/founding-offers";
import { useReferralInfo, type ReferralInfo } from "@/components/growth/referral-card";

/** quota: a request hit the plan's limit. feature: a locked tone, voice or report was picked. */
export type UpgradeTrigger = "upgrade" | "quota" | "feature";

const KICKER: Record<UpgradeTrigger, string> = { upgrade: "Upgrade", quota: "Limit reached", feature: "Part of Pro" };
type Billing = "monthly" | "annual";
type WordPackOffer = Extract<OffersInfo["wordPack"], { available: true }>;

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: string;
  /** Why the modal opened; changes the header copy (see UpgradeTrigger). */
  trigger?: UpgradeTrigger;
  /** A plan picked on the pricing page before sign-up: preset its billing period and mark its card. */
  intent?: CheckoutIntent | null;
}

const PLAN_IDS = ["FREE", "PRO", "TEAM"] as const;
const PLAN_RANK: Record<PlanId, number> = { FREE: 0, PRO: 1, TEAM: 2 };

const UNLOCKS = [
  "Unlimited rewrites (within your plan's words)",
  "All 5 tones",
  "Voice Match: rewrites that follow how you write",
  "PDF and Word upload",
  "Before/After Report and saved history",
];

function fmtUsd(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

function fmtWords(plan: PlanConfig): string {
  const n = plan.wordsLimit >= 1000 ? `${plan.wordsLimit / 1000}k` : String(plan.wordsLimit);
  return `${n} words/${plan.wordsLimitPeriod === "day" ? "day" : "mo"}`;
}

/** Price shown on a card: the annual price spread per month (checkout bills it once a year). */
function displayPrice(plan: PlanConfig, billing: Billing): { price: string; note: string | null } {
  if (plan.price === 0) return { price: "$0", note: null };
  if (billing === "annual" && plan.priceAnnual) {
    return {
      price: `≈${fmtUsd(Math.round((plan.priceAnnual / 12) * 100) / 100)}`,
      note: `${fmtUsd(plan.priceAnnual)} billed yearly`,
    };
  }
  return { price: fmtUsd(plan.price), note: "billed monthly" };
}

/** Months of Pro an annual plan saves vs paying monthly, e.g. 3 ($108 vs $79). */
const ANNUAL_FREE_MONTHS = (() => {
  const pro = PLAN_CONFIG.PRO;
  return pro.priceAnnual ? Math.round((pro.price * 12 - pro.priceAnnual) / pro.price) : 0;
})();

/**
 * Keeps the page still behind the open menu. The scrollbar's width becomes
 * body padding so the page doesn't shift sideways. Returns the undo.
 */
function lockPageScroll(): () => void {
  const { body, documentElement } = document;
  const scrollbar = window.innerWidth - documentElement.clientWidth;
  const previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
  if (scrollbar > 0) body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + scrollbar}px`;
  body.style.overflow = "hidden";
  return () => {
    body.style.overflow = previous.overflow;
    body.style.paddingRight = previous.paddingRight;
  };
}

export function UpgradeModal({ isOpen, onClose, currentPlan, trigger = "upgrade", intent = null }: UpgradeModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const offers = useOffers();
  const referral = useReferralInfo();
  const wordPack = trigger === "quota" && offers?.wordPack.available ? offers.wordPack : null;

  // Follow the prop. A layout effect, so an emptied panel is never painted
  // between the close and the content leaving.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  // Light dismiss where <dialog closedby> is missing (Safari). Both the press
  // and the release must land outside the panel, so a text selection that
  // ends on the backdrop doesn't close it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || "closedBy" in HTMLDialogElement.prototype) return;
    let pressedOutside = false;
    const outside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    const onDown = (e: PointerEvent) => {
      pressedOutside = outside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && outside(e)) dialog.close();
    };
    dialog.addEventListener("pointerdown", onDown);
    dialog.addEventListener("pointerup", onUp);
    return () => {
      dialog.removeEventListener("pointerdown", onDown);
      dialog.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="hz-up"
      aria-labelledby={titleId}
      closedby="any"
      // Esc, the back gesture or a backdrop click already closed it: tell the owner.
      onClose={() => {
        if (isOpen) onClose();
      }}
    >
      <style>{STYLES}</style>
      {isOpen && (
        <UpgradePanel
          titleId={titleId}
          onClose={onClose}
          currentPlan={currentPlan}
          trigger={trigger}
          intent={intent}
          wordPack={wordPack}
          referral={trigger === "quota" ? referral : null}
        />
      )}
    </dialog>
  );
}

interface UpgradePanelProps {
  titleId: string;
  onClose: () => void;
  currentPlan: string;
  trigger: UpgradeTrigger;
  intent: CheckoutIntent | null;
  wordPack: WordPackOffer | null;
  referral: ReferralInfo | null;
}

/** The menu's content. Mounted on each opening, so it starts fresh with the intent's billing period. */
function UpgradePanel({ titleId, onClose, currentPlan, trigger, intent, wordPack, referral }: UpgradePanelProps) {
  const posthog = usePostHog();
  const [code, setCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [checkingOut, setCheckingOut] = useState<CheckoutPlan | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // Set while new payments are paused: the server's message replaces the plans.
  const [pausedMessage, setPausedMessage] = useState<string | null>(null);
  // Annual first: lower churn, and it is the better deal for the buyer.
  const [billing, setBilling] = useState<Billing>(intent && !intent.annual ? "monthly" : "annual");
  const [packBusy, setPackBusy] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);
  const codeId = useId();
  const fromPricing = !!intent;
  const current = currentPlan.toUpperCase();

  useEffect(() => {
    posthog?.capture("upgrade_modal_viewed", { current_plan: currentPlan, trigger, from_pricing: fromPricing });
  }, [posthog, currentPlan, trigger, fromPricing]);

  useEffect(() => lockPageScroll(), []);

  async function handleUpgrade(planId: CheckoutPlan) {
    if (checkingOut) return;
    setCheckingOut(planId);
    setCheckoutError(null);
    const annual = billing === "annual";
    posthog?.capture("upgrade_cta_clicked", { plan: planId, current_plan: currentPlan, annual, trigger, from_pricing: fromPricing });
    track("upgrade_cta_clicked", { plan: planId, annual });
    try {
      const outcome = await requestCheckout(planId, annual);
      if (outcome.kind === "redirect") {
        window.location.href = outcome.url;
        return; // keep spinner until navigation
      }
      if (outcome.kind === "paused") setPausedMessage(outcome.message);
      else setCheckoutError(outcome.message ?? "Could not start checkout. Try again.");
    } catch {
      setCheckoutError("Network error starting checkout.");
    }
    setCheckingOut(null);
  }

  /** Radio group keys: an arrow moves the choice and the focus to the other period. */
  function onBillingKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const next: Billing = billing === "annual" ? "monthly" : "annual";
    setBilling(next);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-billing="${next}"]`)?.focus();
  }

  async function buyWordPack() {
    if (packBusy) return;
    setPackBusy(true);
    setPackError(null);
    posthog?.capture("wordpack_cta_clicked", { current_plan: currentPlan });
    const message = await startOfferCheckout("wordpack");
    if (message) {
      setPackError(message);
      setPackBusy(false);
    }
  }

  async function handleRedeem() {
    if (!code.trim()) return;
    setRedeeming(true);
    setCodeStatus(null);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json() as { success?: boolean; plan?: string; error?: { message: string } };
      if (res.ok && data.success) {
        setCodeStatus({ type: "success", message: `Upgraded to ${data.plan}!` });
        posthog?.capture("discount_code_success", { plan: data.plan });
      } else {
        setCodeStatus({ type: "error", message: data.error?.message ?? "Invalid code." });
        posthog?.capture("discount_code_failed", { code: code.trim() });
      }
    } catch {
      setCodeStatus({ type: "error", message: "Network error." });
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <>
      {/* Stays in view while the body scrolls: the sheet's sticky header on phones. */}
      <header className="hz-up-head">
        <div className="kicker hz-up-kicker">{KICKER[trigger]}</div>
        <h2 id={titleId} className="hz-up-title">
          {trigger === "quota" ? (
            <>Keep going <span style={{ color: THEME.accent }}>today</span></>
          ) : (
            <>Keep your writing <span style={{ color: THEME.accent }}>sounding like you</span></>
          )}
        </h2>
        <button type="button" className="hz-up-close" onClick={onClose} aria-label="Close">
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div className="hz-up-body">
        {pausedMessage ? (
          <CheckoutPausedPanel message={pausedMessage} onDone={onClose} />
        ) : (
          <>
            <p className="hz-up-lead">
              {trigger !== "quota"
                ? "More words, unlimited rewrites, document upload and saved history."
                : current === "FREE"
                  ? "Free words reset 24 hours after your last reset. Need more now? Pick monthly or annual."
                  : "You've used this month's words. They reset with your next billing month, or you can move up a plan."}
            </p>

            {/* Billing toggle */}
            <div className="hz-up-billing">
              <div role="radiogroup" aria-label="Billing period" className="hz-up-seg" onKeyDown={onBillingKeyDown}>
                {(["monthly", "annual"] as const).map((b) => {
                  const active = billing === b;
                  return (
                    <button
                      key={b}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      tabIndex={active ? 0 : -1}
                      data-billing={b}
                      className="hz-up-seg-btn"
                      onClick={() => setBilling(b)}
                    >
                      {b === "monthly" ? "Monthly" : `Annual · about ${ANNUAL_FREE_MONTHS} months free`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Plan cards */}
            <div className="hz-up-plans">
              {PLAN_IDS.map((id) => {
                const plan = PLAN_CONFIG[id];
                const { price, note } = displayPrice(plan, billing);
                const isCurrent = current === plan.id;
                // The highlighted card: the plan picked on the pricing page, else Pro.
                const highlighted = plan.id === (intent?.plan ?? "PRO");
                const isFree = plan.id === "FREE";
                const checkoutPlan: CheckoutPlan | null = plan.id === "FREE" ? null : plan.id;
                // A step down from Team is a switch, not an upgrade.
                const verb = PLAN_RANK[plan.id] > (PLAN_RANK[current as PlanId] ?? 0) ? "Upgrade to" : "Switch to";
                return (
                  <div
                    key={plan.id}
                    className="hz-up-card"
                    data-highlighted={highlighted || undefined}
                    data-free={isFree || undefined}
                  >
                    {highlighted && (
                      // Not "Most popular": no sales figure backs that yet.
                      <div className="hz-up-badge">{intent ? "Your pick" : "Recommended"}</div>
                    )}
                    <h3 className="hz-up-name">{plan.name}</h3>
                    <div className="hz-up-price">
                      {price}
                      {!isFree && <span className="hz-up-per">/mo</span>}
                    </div>
                    <div className="hz-up-note">{note}</div>
                    <div className="hz-up-words">{fmtWords(plan)}</div>
                    {isCurrent ? (
                      <div className="hz-up-cta hz-up-current">Current plan</div>
                    ) : checkoutPlan ? (
                      <button
                        type="button"
                        className="hz-up-cta"
                        onClick={() => handleUpgrade(checkoutPlan)}
                        disabled={checkingOut !== null}
                        style={{
                          background: highlighted ? THEME.gradient : THEME.surface3,
                          color: highlighted ? "#ffffff" : THEME.text,
                          boxShadow: highlighted ? glow(THEME.brand, 0.34) : "none",
                          cursor: checkingOut ? "wait" : "pointer",
                          opacity: checkingOut && checkingOut !== checkoutPlan ? 0.6 : 1,
                        }}
                      >
                        {checkingOut === checkoutPlan ? "Starting…" : `${verb} ${plan.name}`}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {checkoutError && <div role="alert" className="hz-up-error">{checkoutError}</div>}

            {/* Cheaper ways out of a limit: a one-time pack, or a friend */}
            {(wordPack || referral) && (
              <div className="hz-up-alts">
                <div className="hz-up-alts-title">Not ready for a plan?</div>
                {wordPack && (
                  <button type="button" className="hz-up-alt" onClick={buyWordPack} disabled={packBusy}>
                    <Package size={16} color={THEME.brand} aria-hidden="true" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>
                      <strong style={{ color: THEME.text }}>{`Word Pack: ${wordPack.words.toLocaleString("en-US")} words for ${fmtUsd(wordPack.priceUsd)}`}</strong>
                      <span className="hz-up-alt-sub">
                        {`One payment, used after your plan's words, valid ${wordPack.days} days. It also lifts the daily rewrite cap.`}
                      </span>
                    </span>
                    <span className="hz-up-alt-go" style={{ color: THEME.brandHi }}>{packBusy ? "Starting…" : "Buy"}</span>
                  </button>
                )}
                {packError && <div role="alert" className="hz-up-error">{packError}</div>}
                {referral && (
                  <a href="/dashboard/settings#invite" className="hz-up-alt">
                    <Gift size={16} color={THEME.accent} aria-hidden="true" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>
                      <strong style={{ color: THEME.text }}>{`Invite a friend: you both get ${referral.rewardWords.toLocaleString("en-US")} words`}</strong>
                      <span className="hz-up-alt-sub">Once they sign up and run their first check.</span>
                    </span>
                    <span className="hz-up-alt-go" style={{ color: THEME.accentHi }}>Invite</span>
                  </a>
                )}
              </div>
            )}

            <div className="hz-up-guarantee">
              <ShieldCheck size={16} color={THEME.human} aria-hidden="true" style={{ flexShrink: 0, marginTop: "1px" }} />
              <span>
                {`${GUARANTEE_DAYS}-day "Sounds Like You" guarantee: if HumanizeIt doesn't make your writing clearer and more like you, email us for a full refund, monthly or annual (${TEAM_ANNUAL_GUARANTEE_DAYS} days on Team annual). We never promise a score on someone else's AI detector.`}
              </span>
            </div>

            {/* What you unlock */}
            <div>
              <h3 className="hz-up-subtitle">Everything you unlock</h3>
              <ul className="hz-up-unlock">
                {UNLOCKS.map((f) => (
                  <li key={f}>
                    <span className="hz-up-tick">
                      <Check size={12} color={THEME.human} aria-hidden="true" strokeWidth={3} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Discount code */}
            <div>
              <label htmlFor={codeId} className="hz-up-subtitle hz-up-code-label">Have a discount code?</label>
              <div className="hz-up-code-row">
                <input
                  id={codeId}
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter code"
                  aria-label="Discount code"
                  autoComplete="off"
                  className="mono hz-up-code-input"
                />
                <button
                  type="button"
                  className="hz-up-apply"
                  onClick={handleRedeem}
                  disabled={redeeming || !code.trim()}
                  style={{
                    background: code.trim() ? THEME.brand : THEME.surface3,
                    color: code.trim() ? "#ffffff" : THEME.textMuted,
                    cursor: code.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  {redeeming ? "..." : "Apply"}
                </button>
              </div>
              {codeStatus && (
                <div
                  aria-live="polite"
                  className="hz-up-code-status"
                  style={{ color: codeStatus.type === "success" ? THEME.human : THEME.ai }}
                >
                  {codeStatus.message}
                </div>
              )}
            </div>

            <button type="button" className="hz-up-later" onClick={onClose}>
              Maybe later
            </button>
          </>
        )}
      </div>
    </>
  );
}

/**
 * Shown instead of the plans when /api/checkout answers CHECKOUT_PAUSED: the
 * server's message and one way out. Focus lands on "Got it", which carries
 * the heading and message as its description for screen readers.
 */
export function CheckoutPausedPanel({ message, onDone }: { message: string; onDone: () => void }) {
  const doneRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  // The button that was clicked is gone: move focus somewhere useful.
  useEffect(() => {
    doneRef.current?.focus();
  }, []);

  return (
    <div className="hz-up-paused">
      <span className="hz-up-paused-icon" aria-hidden="true">
        <CirclePause size={26} strokeWidth={2} />
      </span>
      <h3 id={`${id}-title`} className="hz-up-paused-title">Checkout is paused for now</h3>
      <p id={`${id}-message`} className="hz-up-paused-message">{message}</p>
      <button
        ref={doneRef}
        type="button"
        className="hz-up-done"
        aria-describedby={`${id}-title ${id}-message`}
        onClick={onDone}
      >
        Got it
      </button>
    </div>
  );
}

// Layout lives here rather than inline: the breakpoints, the ::backdrop and
// the focus rings need CSS. Colors still come from THEME.
const STYLES = `
.hz-up {
  /* The global reset zeroes the margin that centers a modal dialog. */
  margin: auto;
  padding: 0;
  width: calc(100% - 32px);
  max-width: 760px;
  max-height: calc(100vh - 32px);
  max-height: calc(100dvh - 32px);
  overflow: hidden;
  overscroll-behavior: contain;
  border: 1px solid ${THEME.border};
  border-radius: ${THEME.radiusXl};
  background: ${THEME.surface2};
  color: ${THEME.text};
  font-family: ${THEME.fontSans};
  box-shadow: 0 28px 70px -18px rgba(124,58,237,0.32), 0 10px 30px -14px rgba(29,23,38,0.14);
}
.hz-up[open] { display: flex; flex-direction: column; animation: hz-up-in 0.2s cubic-bezier(0.2, 0.8, 0.2, 1); }
.hz-up::backdrop { background: rgba(29,23,38,0.36); backdrop-filter: blur(6px); overflow: hidden; overscroll-behavior: contain; }
.hz-up[open]::backdrop { animation: hz-up-fade 0.2s ease-out; }
@keyframes hz-up-in { from { opacity: 0; transform: translateY(12px) scale(0.985); } }
@keyframes hz-up-sheet { from { opacity: 0; transform: translateY(32px); } }
@keyframes hz-up-fade { from { opacity: 0; } }

.hz-up :is(button, a, input):focus-visible { outline: 2px solid ${THEME.brand}; outline-offset: 2px; }

.hz-up-head {
  position: relative;
  flex: none;
  padding: 20px 76px 18px 28px;
  background: linear-gradient(135deg, ${THEME.brandDim} 0%, ${THEME.accentDim} 100%);
  border-bottom: 1px solid ${THEME.border};
}
.hz-up-kicker { margin-bottom: 10px; }
.hz-up-title { margin: 0; font-family: ${THEME.fontHeading}; font-size: 22px; font-weight: 700; line-height: 1.25; letter-spacing: -0.02em; color: ${THEME.text}; text-wrap: balance; }
.hz-up-close {
  position: absolute; top: 12px; right: 12px;
  width: 44px; height: 44px;
  display: grid; place-items: center;
  border: 0; border-radius: ${THEME.radius};
  background: transparent; color: ${THEME.textDim}; cursor: pointer;
}
.hz-up-close:hover { background: rgba(255,255,255,0.75); color: ${THEME.text}; }

.hz-up-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex; flex-direction: column; gap: 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 20px 28px 28px;
  scrollbar-width: thin;
  scrollbar-color: ${THEME.borderStrong} transparent;
}
.hz-up-body > * { flex-shrink: 0; }
.hz-up-lead { margin: 0; font-size: 14px; line-height: 1.55; color: ${THEME.textDim}; text-wrap: pretty; }

.hz-up-billing { display: flex; justify-content: center; }
.hz-up-seg { display: inline-flex; gap: 4px; max-width: 100%; padding: 4px; border-radius: 999px; background: ${THEME.surface3}; }
.hz-up-seg-btn {
  flex: 1 1 auto;
  min-height: 44px; padding: 6px 18px;
  border: 0; border-radius: 999px;
  background: transparent; color: ${THEME.textDim};
  font-family: ${THEME.fontSans}; font-size: 13px; font-weight: 500; line-height: 1.25;
  cursor: pointer;
}
.hz-up-seg-btn[aria-checked="true"] { background: ${THEME.surface2}; color: ${THEME.text}; font-weight: 700; box-shadow: 0 1px 3px rgba(29,23,38,0.12); }

.hz-up-plans { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding-top: 6px; }
.hz-up-card {
  position: relative;
  min-width: 0;
  display: flex; flex-direction: column; align-items: center;
  padding: 24px 16px 16px;
  border: 1px solid ${THEME.border};
  border-radius: ${THEME.radiusLg};
  background: ${THEME.surface2};
  text-align: center;
}
.hz-up-card[data-free] { background: ${THEME.surface1}; }
.hz-up-card[data-highlighted] { border-color: ${THEME.brand}; background: ${THEME.brandDim}; box-shadow: ${glow(THEME.brand, 0.28)}; }
.hz-up-badge {
  position: absolute; top: -11px; left: 50%; transform: translateX(-50%);
  padding: 3px 10px; border-radius: 999px;
  background: ${THEME.accent}; color: #ffffff;
  font-size: 11px; font-weight: 700; letter-spacing: 0.01em; white-space: nowrap;
  box-shadow: ${glow(THEME.accent, 0.35)};
}
.hz-up-name { margin: 0 0 6px; font-family: ${THEME.fontSans}; font-size: 14px; font-weight: 700; color: ${THEME.text}; }
.hz-up-price {
  font-family: ${THEME.fontHeading};
  font-size: clamp(24px, 2.4vw + 8px, 30px); font-weight: 800; line-height: 1.15; letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums; white-space: nowrap;
  color: ${THEME.text};
}
.hz-up-card[data-highlighted] .hz-up-name, .hz-up-card[data-highlighted] .hz-up-price { color: ${THEME.brandHi}; }
.hz-up-per { margin-left: 2px; font-family: ${THEME.fontSans}; font-size: 13px; font-weight: 500; letter-spacing: 0; color: ${THEME.textDim}; }
.hz-up-note { min-height: 17px; margin-top: 4px; font-size: 12px; line-height: 1.4; color: ${THEME.textDim}; font-variant-numeric: tabular-nums; }
.hz-up-words { margin: 8px 0 16px; font-size: 13px; font-weight: 600; color: ${THEME.text}; font-variant-numeric: tabular-nums; }
.hz-up-cta {
  width: 100%; margin-top: auto;
  min-height: 44px; padding: 0 12px;
  display: flex; align-items: center; justify-content: center;
  border: 0; border-radius: ${THEME.radius};
  font-family: ${THEME.fontSans}; font-size: 13px; font-weight: 700;
}
button.hz-up-cta:not(:disabled):hover { filter: brightness(0.96); }
.hz-up-current { background: ${THEME.surface3}; color: ${THEME.textDim}; font-weight: 600; }
.hz-up-error { margin-top: -6px; font-size: 13px; font-weight: 500; line-height: 1.45; color: ${THEME.ai}; text-align: center; }

.hz-up-alts { display: flex; flex-direction: column; gap: 8px; }
.hz-up-alts-title { font-size: 12px; color: ${THEME.textDim}; text-align: center; }
.hz-up-alt {
  display: flex; align-items: center; gap: 12px;
  width: 100%; min-height: 56px; padding: 10px 14px;
  border: 1px solid ${THEME.border}; border-radius: ${THEME.radius};
  background: ${THEME.surface1}; color: ${THEME.textDim};
  font-family: ${THEME.fontSans}; font-size: 13px; line-height: 1.45; text-align: left; text-decoration: none;
  cursor: pointer;
}
.hz-up-alt:hover { border-color: ${THEME.borderStrong}; background: ${THEME.surface3}; }
.hz-up-alt-sub { display: block; margin-top: 2px; font-size: 12px; color: ${THEME.textDim}; }
.hz-up-alt-go { flex: none; font-size: 13px; font-weight: 700; }

.hz-up-guarantee {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px 14px; border-radius: ${THEME.radius};
  background: ${THEME.humanDim};
  font-size: 12.5px; line-height: 1.55; color: ${THEME.textDim}; text-wrap: pretty;
}

.hz-up-subtitle { display: block; margin: 0 0 10px; font-family: ${THEME.fontSans}; font-size: 13px; font-weight: 700; color: ${THEME.text}; }
.hz-up-unlock { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px 20px; margin: 0; padding: 0; list-style: none; }
.hz-up-unlock li { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; line-height: 1.45; color: ${THEME.textDim}; }
.hz-up-tick { flex: none; display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: ${THEME.humanDim}; }

.hz-up-code-label { margin-bottom: 8px; font-weight: 600; }
.hz-up-code-row { display: flex; gap: 8px; }
.hz-up-code-input {
  flex: 1 1 auto; min-width: 0;
  min-height: 44px; padding: 0 12px;
  border: 1px solid ${THEME.border}; border-radius: ${THEME.radius};
  background: ${THEME.surface1}; color: ${THEME.text};
  font-size: 14px; letter-spacing: 0.04em;
}
.hz-up-code-input:focus { border-color: ${THEME.brand}; background: ${THEME.surface2}; }
.hz-up-apply { flex: none; min-width: 80px; min-height: 44px; padding: 0 16px; border: 0; border-radius: ${THEME.radius}; font-family: ${THEME.fontSans}; font-size: 13px; font-weight: 600; }
.hz-up-code-status { margin-top: 8px; font-size: 12px; font-weight: 500; }

.hz-up-later {
  width: 100%; min-height: 44px;
  border: 1px solid ${THEME.border}; border-radius: ${THEME.radius};
  background: transparent; color: ${THEME.textDim};
  font-family: ${THEME.fontSans}; font-size: 13px; cursor: pointer;
}
.hz-up-later:hover { background: ${THEME.surface1}; color: ${THEME.text}; }

.hz-up-paused { margin: auto 0; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px 4px 8px; text-align: center; }
.hz-up-paused-icon { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; background: ${THEME.brandDim}; color: ${THEME.brand}; }
.hz-up-paused-title { margin: 4px 0 0; font-family: ${THEME.fontHeading}; font-size: 19px; font-weight: 700; letter-spacing: -0.01em; color: ${THEME.text}; text-wrap: balance; }
.hz-up-paused-message { max-width: 440px; margin: 0; font-size: 14px; line-height: 1.6; color: ${THEME.textDim}; overflow-wrap: break-word; text-wrap: pretty; }
.hz-up-done {
  min-width: 180px; min-height: 44px; margin-top: 8px; padding: 0 24px;
  border: 0; border-radius: ${THEME.radius};
  background: ${THEME.brand}; color: #ffffff;
  font-family: ${THEME.fontSans}; font-size: 14px; font-weight: 700; cursor: pointer;
}
.hz-up-done:hover { background: ${THEME.brandHi}; }

/* Tablets and phones: one plan per row, name and price side by side. */
@media (max-width: 640px) {
  .hz-up-plans { grid-template-columns: minmax(0, 1fr); gap: 16px; padding-top: 4px; }
  .hz-up-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: "name price" "words note" "cta cta";
    align-items: baseline; column-gap: 12px;
    padding: 18px 16px 16px;
    text-align: left;
  }
  .hz-up-badge { left: 14px; transform: none; }
  .hz-up-name { grid-area: name; margin: 0; font-size: 16px; }
  .hz-up-price { grid-area: price; justify-self: end; }
  .hz-up-note { grid-area: note; justify-self: end; min-height: 0; margin: 0; text-align: right; }
  .hz-up-words { grid-area: words; margin: 2px 0 0; }
  .hz-up-cta { grid-area: cta; margin-top: 14px; }
  .hz-up-unlock { grid-template-columns: minmax(0, 1fr); }
  /* 16px stops iOS Safari from zooming the page when the field takes focus. */
  .hz-up-code-input { font-size: 16px; }
}

/* Phones: a full-height sheet; only the body scrolls. */
@media (max-width: 480px) {
  .hz-up {
    width: 100%; max-width: none;
    height: 100%; height: 100dvh; max-height: none;
    margin: 0; border: 0; border-radius: 0;
  }
  .hz-up[open] { animation-name: hz-up-sheet; }
  .hz-up-head { padding: 12px 64px 12px 16px; padding-top: calc(12px + env(safe-area-inset-top, 0px)); }
  .hz-up-kicker { margin-bottom: 8px; padding: 3px 10px; font-size: 11px; }
  .hz-up-title { font-size: 19px; }
  .hz-up-close { top: calc(6px + env(safe-area-inset-top, 0px)); right: 6px; }
  .hz-up-body { gap: 18px; padding: 16px 16px calc(24px + env(safe-area-inset-bottom, 0px)); }
  .hz-up-seg { display: flex; width: 100%; }
  .hz-up-seg-btn { padding: 6px 12px; }
  .hz-up-done { width: 100%; }
}
`;
