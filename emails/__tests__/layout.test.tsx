import { render } from "react-email";
import { EmailLayout, PlainLayout } from "@/emails/components/layout";
import { Button, Greeting, P } from "@/emails/components/primitives";
import { TemplateNotImplementedError, buildRenderCtx, reasonFor, renderEmail } from "@/lib/email/render";
import { TEMPLATE_KEYS } from "@/lib/email/catalog";

const savedEnv = { ...process.env };

beforeAll(() => {
  process.env.EMAIL_TOKEN_SECRET = "layout-test-secret-0123456789abcdef";
  process.env.NEXT_PUBLIC_APP_URL = "https://humanizeit.app";
  process.env.COMPANY_POSTAL_ADDRESS = "PO Box 42, 1000 Tunis";
});

afterAll(() => {
  process.env = savedEnv;
});

describe("EmailLayout", () => {
  it("renders the brand shell, the body and the full footer", async () => {
    const ctx = buildRenderCtx({ contactId: "contact_1", template: "nurture_why_flags", firstName: null });
    const element = (
      <EmailLayout ctx={ctx} preview="Why honest writing gets flagged">
        <Greeting ctx={ctx} />
        <P>Detectors score how predictable text looks.</P>
        <Button href={ctx.link("/ai-detector")}>Check your own writing</Button>
      </EmailLayout>
    );
    const html = await render(element);
    const text = await render(element, { plainText: true });

    expect(html).toContain('lang="en"');
    expect(html).toContain("https://humanizeit.app/icon.png");
    expect(html).toContain("Hi there,");
    expect(html).toContain("utm_source=email");
    expect(html).toContain("You&#x27;re receiving this because you subscribed to HumanizeIt writing tips and offers.");
    expect(html).toContain("https://humanizeit.app/email/preferences?t=v1.");
    expect(html).toContain("u=1");
    expect(html).toContain("PO Box 42, 1000 Tunis");
    expect(html).not.toContain("undefined");

    expect(text).toContain("Unsubscribe");
    expect(text).toContain("Email preferences");
    expect(text).toContain("Check your own writing");
  });
});

describe("PlainLayout", () => {
  it("has no images and signs as the founder", async () => {
    const ctx = buildRenderCtx({ contactId: "contact_1", template: "founder_checkin", firstName: "Sam" });
    const html = await render(
      <PlainLayout ctx={ctx}>
        <Greeting ctx={ctx} />
        <P>What are you using HumanizeIt for?</P>
      </PlainLayout>
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("Hi Sam,");
    expect(html).toContain("Boubaker, founder of HumanizeIt");
    expect(html).toContain(reasonFor("lifecycle", null).replace("'", "&#x27;"));
  });
});

describe("render context", () => {
  it("tags our own links with UTMs and leaves external links alone", () => {
    const ctx = buildRenderCtx({ contactId: "c1", template: "welcome" });
    expect(ctx.link("/dashboard")).toBe("https://humanizeit.app/dashboard?utm_source=email&utm_medium=lifecycle&utm_campaign=welcome");
    expect(ctx.link("https://arxiv.org/abs/2304.02819")).toBe("https://arxiv.org/abs/2304.02819");
    expect(ctx.link("/blog/x?utm_source=reddit")).toBe("https://humanizeit.app/blog/x?utm_source=reddit");
  });

  it("omits per-contact links when there is no contact", () => {
    const ctx = buildRenderCtx({ contactId: null, template: "campaign", topic: "extension_launch" });
    expect(ctx.unsubscribeUrl).toBeNull();
    expect(ctx.preferencesUrl).toBeNull();
    expect(ctx.reason).toBe("You're receiving this because you subscribed to HumanizeIt Chrome extension launch updates.");
  });

  it("states a reason for every stream", () => {
    expect(reasonFor("transactional", null)).toBe("You requested this at humanizeit.app.");
    expect(reasonFor("personal", null)).toBe("A personal note from the founder of HumanizeIt.");
  });
});

describe("renderEmail", () => {
  it("throws TemplateNotImplementedError until a stream registers the template", async () => {
    const ctx = buildRenderCtx({ contactId: "c1", template: "welcome" });
    await expect(renderEmail("welcome", {}, ctx)).rejects.toBeInstanceOf(TemplateNotImplementedError);
    expect(TEMPLATE_KEYS.length).toBeGreaterThan(20);
  });
});
