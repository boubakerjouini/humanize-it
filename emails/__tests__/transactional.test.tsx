import { render } from "react-email";
import { createElement } from "react";
import { TRANSACTIONAL } from "@/emails/transactional";
import { foundingConfirm } from "@/emails/transactional/founding-confirm";
import { describeTopics } from "@/emails/transactional/doi-confirm";
import { buildRenderCtx, renderEmail } from "@/lib/email/render";
import type { TemplateKey, TemplateProps } from "@/lib/email/catalog";

const savedEnv = { ...process.env };

beforeAll(() => {
  process.env.EMAIL_TOKEN_SECRET = "transactional-test-secret-0123456789";
  process.env.NEXT_PUBLIC_APP_URL = "https://humanizeit.app";
});

afterAll(() => {
  process.env = savedEnv;
});

const SAMPLES: { [K in "magnet_delivery" | "detector_report" | "waitlist_confirm" | "doi_confirm"]: TemplateProps[K][] } = {
  magnet_delivery: [
    {
      magnet: "false-ai-flag-appeal-kit",
      confirmUrl: "https://humanizeit.app/free/false-ai-flag-appeal-kit/thanks?t=v1.abc.def",
      downloadUrl: "https://humanizeit.app/lead-magnets/false-ai-flag-appeal-kit.pdf",
      consentPending: true,
    },
    {
      firstName: "Amira",
      magnet: "linkedin-humanizer-checklist",
      confirmUrl: "https://humanizeit.app/free/linkedin-humanizer-checklist/thanks?t=v1.abc.def",
      downloadUrl: "https://humanizeit.app/lead-magnets/linkedin-humanizer-checklist.pdf",
      consentPending: false,
    },
  ],
  detector_report: [
    {
      instantScore: 62.4,
      deepScore: 71,
      verdict: "Likely AI-assisted",
      confidence: "medium",
      wordCount: 340,
      patterns: [
        { id: "low-burstiness", label: "Low Burstiness", hits: 1 },
        { id: "filler", label: "Filler Phrases", hits: 4 },
        { id: "made-up-id", label: "Something New", hits: 2 },
        { id: "hedging", label: "Hedging Language", hits: 2 },
      ],
      confirmUrl: "https://humanizeit.app/free/confirmed?t=v1.abc.def",
    },
    { instantScore: 8, patterns: [] },
  ],
  waitlist_confirm: [{ confirmUrl: "https://humanizeit.app/extension/confirmed?t=v1.abc.def" }],
  doi_confirm: [{ confirmUrl: "https://humanizeit.app/free/confirmed?t=v1.abc.def", topics: ["tips", "extension_launch"] }],
};

async function renderSample<K extends keyof typeof SAMPLES>(key: K, props: TemplateProps[K]) {
  const ctx = buildRenderCtx({ contactId: "contact_1", template: key as TemplateKey, firstName: props.firstName ?? null });
  return renderEmail(key, props, ctx);
}

function expectClean(out: { subject: string; html: string; text: string }) {
  expect(out.subject.trim().length).toBeGreaterThan(5);
  for (const part of [out.subject, out.html, out.text]) {
    expect(part).not.toContain("undefined");
    expect(part).not.toContain("null");
    expect(part).not.toMatch(/\{[a-z_]+\}/i);
  }
  expect(out.text).toContain("You requested this at humanizeit.app.");
  expect(out.html).toContain("https://humanizeit.app/email/preferences?t=v1.");
}

describe("transactional registry", () => {
  it("registers the four transactional templates", () => {
    expect(Object.keys(TRANSACTIONAL).sort()).toEqual(["detector_report", "doi_confirm", "magnet_delivery", "waitlist_confirm"]);
  });

  for (const key of Object.keys(SAMPLES) as (keyof typeof SAMPLES)[]) {
    it(`renders ${key} with every sample`, async () => {
      for (const props of SAMPLES[key]) expectClean(await renderSample(key, props as never));
    });
  }
});

describe("magnet_delivery", () => {
  it("links to the thanks page, keeps a direct PDF link and mentions tips only when pending", async () => {
    const [pending, plain] = SAMPLES.magnet_delivery;
    const a = await renderSample("magnet_delivery", pending);
    expect(a.subject).toBe("Here's your False AI Flag Appeal Kit");
    expect(a.html).toContain("/free/false-ai-flag-appeal-kit/thanks?t=v1.abc.def");
    expect(a.html).toContain("/lead-magnets/false-ai-flag-appeal-kit.pdf");
    expect(a.text).toContain("Yes, send me tips");
    expect(a.text).toContain("Hi there,");

    const b = await renderSample("magnet_delivery", plain);
    expect(b.text).toContain("Hi Amira,");
    expect(b.text).not.toContain("send me tips");
  });
});

describe("detector_report", () => {
  it("shows both scores, the top three patterns with fixes, and never claims proof", async () => {
    const out = await renderSample("detector_report", SAMPLES.detector_report[0]);
    expect(out.subject).toBe("Your AI-detection report: 71/100 AI-likelihood");
    expect(out.text).toContain("Instant check: 62/100 AI-likelihood (340 words)");
    expect(out.text).toContain("Deep scan: 71/100 (medium confidence): Likely AI-assisted");
    expect(out.text).toContain("Low Burstiness");
    expect(out.text).toContain("Something New");
    expect(out.text).not.toContain("Hedging Language");
    expect(out.text).toContain("It is not proof");
    expect(out.text).toContain("Your text was not stored or included in this email.");
    expect(out.text).toContain("Yes, send me tips");
  });

  it("handles a clean instant-only result", async () => {
    const out = await renderSample("detector_report", SAMPLES.detector_report[1]);
    expect(out.subject).toBe("Your AI-detection report: 8/100 AI-likelihood");
    expect(out.text).toContain("found no strong AI patterns");
    expect(out.text).not.toContain("Deep scan");
  });
});

describe("confirmation emails", () => {
  it("doi_confirm stays neutral and names the topics", async () => {
    const out = await renderSample("doi_confirm", SAMPLES.doi_confirm[0]);
    expect(out.text).toContain("HumanizeIt writing tips and offers and Chrome extension launch updates");
    expect(out.text).toContain("ignore this email");
    expect(out.text).not.toMatch(/pro plan|\$\d/i);
    expect(describeTopics([])).toBe("emails from HumanizeIt");
  });

  it("waitlist_confirm says the extension isn't released", async () => {
    const out = await renderSample("waitlist_confirm", SAMPLES.waitlist_confirm[0]);
    expect(out.text).toContain("Confirm my spot");
    expect(out.text).toContain("no launch date yet");
  });

  it("the founding confirmation renders for when its catalog key lands", async () => {
    const ctx = buildRenderCtx({ contactId: "contact_1", template: "doi_confirm" });
    const el = createElement(foundingConfirm.Component, { p: { confirmUrl: "https://humanizeit.app/free/confirmed?t=x" }, ctx });
    const text = await render(el, { plainText: true });
    expect(foundingConfirm.subject({ confirmUrl: "x" }, ctx)).toContain("Founding 100");
    expect(text).toContain("Confirm my place on the list");
    expect(text).not.toContain("undefined");
  });
});
