import { buildRenderCtx, reasonFor, renderEmail } from "@/lib/email/render";
import { TEMPLATES, type TemplateKey, type TemplateProps } from "@/lib/email/catalog";
import { LIFECYCLE } from "@/emails/lifecycle";
import { MARKETING } from "@/emails/marketing";
import { ADMIN } from "@/emails/admin";
import { escapeMarkdownText, prepareMarkdown } from "@/emails/admin/markdown-body";
import { REFERRAL_REWARD_WORDS } from "@/lib/growth/referral-rules";

const savedEnv = { ...process.env };

beforeAll(() => {
  process.env.EMAIL_TOKEN_SECRET = "lifecycle-test-secret-0123456789abcdef";
  process.env.NEXT_PUBLIC_APP_URL = "https://humanizeit.app";
  process.env.COMPANY_POSTAL_ADDRESS = "PO Box 42, 1000 Tunis";
  delete process.env.REFERRALS_ENABLED;
});

afterAll(() => {
  process.env = savedEnv;
});

const SENT_AT = new Date("2026-10-07T09:00:00Z");
const IN_14_DAYS = "2026-10-21T09:00:00.000Z";

type D1Key = Exclude<TemplateKey, "magnet_delivery" | "detector_report" | "waitlist_confirm" | "doi_confirm">;

const SAMPLES: { [K in D1Key]: TemplateProps[K] } = {
  welcome: {},
  first_run_nudge: {},
  check_before_submit: {},
  founder_checkin: {},
  what_paid_users_do: { proPrice: 9, proAnnual: 79 },
  limit_hit_menu: { proPrice: 9, proAnnual: 79 },
  trial_offer: { code: "PASS-K7M2P9QR", expiresAt: IN_14_DAYS, days: 7 },
  grant_ending_notice: { plan: "TEAM", expiresAt: IN_14_DAYS },
  grant_keep_offer: {
    plan: "TEAM",
    expiresAt: IN_14_DAYS,
    wordsUsed30d: 61234,
    recommended: "TEAM",
    monthly: 29,
    annual: 249,
  },
  trial_midpoint: { expiresAt: "2026-10-10T09:00:00.000Z" },
  grant_ends_tomorrow: { plan: "PRO", expiresAt: "2026-10-08T09:00:00.000Z" },
  grant_ended: { plan: "TEAM", expiresAt: "2026-10-06T09:00:00.000Z" },
  grant_feedback: { plan: "PRO" },
  winback_one_thing: {
    headline: "Fewer false flags on formal writing",
    body: "We retuned the detector.",
    ctaLabel: "Re-check a past text",
    ctaUrl: "/dashboard",
  },
  winback_ask: {},
  winback_bonus: { words: 3000 },
  checkout_help: { plan: "PRO", monthly: 9, annual: 79 },
  nurture_why_flags: { magnet: "ai-detection-field-guide" },
  nurture_three_pass: {},
  nurture_evidence: { hasAppealKit: false },
  nurture_free_account: {},
  nurture_keep_going: {},
  waitlist_update: {},
  referral_reward: { words: REFERRAL_REWARD_WORDS, role: "referrer" },
  campaign: { subject: "Detector Watch for {{firstName}}", preheader: "What changed", bodyMd: "Hi {{firstName}},\n\nNews." },
  personal_note: { subject: "A quick note", bodyMd: "Hi {{firstName}}, thanks for trying it." },
};

const KEYS = Object.keys(SAMPLES) as D1Key[];

async function renderSample(key: D1Key, firstName: string | null = null, props?: TemplateProps[D1Key]) {
  const ctx = buildRenderCtx({ contactId: "contact_1", template: key, firstName, sentAt: SENT_AT });
  return renderEmail(key, (props ?? SAMPLES[key]) as never, ctx);
}

/** Claims the positioning forbids: beating detectors, pass rates, midnight resets, unlimited history on Free. */
const FORBIDDEN = [
  /undetectable/i,
  /\bbypass/i,
  /pass(es)? (turnitin|gptzero|any detector|ai detection)/i,
  /guaranteed? to pass/i,
  /\d+\s?% (pass|human|success)/i,
  /00:00 UTC/i,
  /midnight/i,
  /history of every check/i,
  /everything you created is still/i,
  /price (is )?locked|lock (in )?(that|the) price/i,
];

describe("D1 email templates", () => {
  it("implements every lifecycle, marketing and admin template in the catalog", () => {
    const implemented = new Set([...Object.keys(LIFECYCLE), ...Object.keys(MARKETING), ...Object.keys(ADMIN)]);
    const expected = (Object.keys(TEMPLATES) as TemplateKey[]).filter((k) => TEMPLATES[k].stream !== "transactional");
    expect([...implemented].sort()).toEqual(expected.sort());
    for (const key of Object.keys(LIFECYCLE)) expect(TEMPLATES[key as TemplateKey].stream).toBe("lifecycle");
    for (const key of Object.keys(MARKETING)) expect(TEMPLATES[key as TemplateKey].stream).toBe("marketing");
  });

  it.each(KEYS)("%s renders a subject, the reason line, the preferences link and no placeholders", async (key) => {
    const { subject, html, text } = await renderSample(key);
    expect(subject.trim().length).toBeGreaterThan(5);
    expect(subject).not.toMatch(/undefined|NaN|null|\{\{/);
    const meta = TEMPLATES[key];
    const topic = key === "campaign" ? null : meta.topic;
    expect(html).toContain(reasonFor(meta.stream, topic).replace(/'/g, "&#x27;"));
    expect(html).toContain("https://humanizeit.app/email/preferences?t=v1.");
    expect(html).toContain("Hi there");
    expect(html).not.toMatch(/undefined|NaN|\{\{/);
    expect(text).not.toMatch(/undefined|NaN|\{\{/);
    if (meta.stream === "marketing") expect(html).toContain("PO Box 42, 1000 Tunis");
  });

  it.each(KEYS)("%s makes no claim the positioning forbids", async (key) => {
    const { subject, text } = await renderSample(key);
    for (const pattern of FORBIDDEN) {
      expect(`${subject}\n${text}`).not.toMatch(pattern);
    }
  });

  it("uses the recipient's first name when there is one", async () => {
    const { html } = await renderSample("welcome", "Amira");
    expect(html).toContain("Hi Amira,");
  });

  it("quotes plan prices and limits from the plan config", async () => {
    const { text } = await renderSample("what_paid_users_do");
    expect(text).toContain("$9 a month, or $79 for the year (about $6.58 a month)");
    expect(text).toContain("50,000 words a month");
    expect(text).toContain("14-day money-back guarantee");
  });

  it("describes the Free reset as rolling, never midnight UTC", async () => {
    const { text } = await renderSample("limit_hit_menu");
    expect(text).toContain("resets 24 hours after it last reset");
  });

  it("shows the referral line in limit_hit_menu only while referrals are enabled", async () => {
    expect((await renderSample("limit_hit_menu")).text).not.toMatch(/invite a friend/i);
    process.env.REFERRALS_ENABLED = "true";
    try {
      const { text } = await renderSample("limit_hit_menu");
      expect(text).toContain(`you both get ${REFERRAL_REWARD_WORDS.toLocaleString("en-US")} bonus words`);
    } finally {
      delete process.env.REFERRALS_ENABLED;
    }
  });

  it("tells a lapsing grant that only the newest 5 documents stay visible", async () => {
    expect((await renderSample("grant_ending_notice")).text).toContain("newest 5 documents");
    expect((await renderSample("grant_ended")).text).toContain("newest 5 documents");
    expect((await renderSample("grant_ending_notice")).subject).toBe("Your Team access ends in 14 days");
  });

  it("puts the pass code and its real expiry in trial_offer", async () => {
    const { text } = await renderSample("trial_offer");
    expect(text).toContain("PASS-K7M2P9QR");
    expect(text).toContain("October 21, 2026");
  });

  it("writes the referral notice for each side without naming the other person", async () => {
    const referrer = await renderSample("referral_reward");
    expect(referrer.subject).toBe("3,000 bonus words added to your account");
    expect(referrer.text).toContain("A friend you invited");
    const referee = await renderSample("referral_reward", null, { words: 3000, role: "referee" });
    expect(referee.text).toContain("because a friend invited you");
  });

  it("points people who already have the Appeal Kit at their PDF", async () => {
    const { html } = await renderSample("nurture_evidence", null, { hasAppealKit: true });
    expect(html).toContain("/lead-magnets/false-ai-flag-appeal-kit.pdf");
    expect(html).toContain("Open your Appeal Kit");
  });

  it("makes the unsubscribe link the button of the re-permission email", async () => {
    const { html } = await renderSample("nurture_keep_going");
    expect(html.match(/email\/preferences\?t=v1\./g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("fills {{firstName}} in campaigns and escapes a hostile name", async () => {
    const plain = await renderSample("campaign", "Sam");
    expect(plain.subject).toBe("Detector Watch for Sam");
    expect(plain.html).toContain("Hi Sam,");

    const hostile = await renderSample("campaign", "<img src=x onerror=alert(1)>");
    expect(hostile.html).not.toContain("<img src=x");
    expect(hostile.html).toContain("&lt;img");
  });

  it("neutralizes raw HTML in an admin body and tags our own links", () => {
    const ctx = buildRenderCtx({ contactId: "contact_1", template: "campaign", firstName: "A_B", sentAt: SENT_AT });
    const md = prepareMarkdown("<script>x</script> [Try it](/ai-detector) [Out](https://example.com)", ctx);
    expect(md).not.toContain("<script>");
    expect(md).toContain("utm_source=email");
    expect(md).toContain("[Out](https://example.com/)");
    expect(escapeMarkdownText("A_B*")).toBe("A\\_B\\*");
  });
});
