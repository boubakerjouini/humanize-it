// ===========================================================
// emails/transactional/detector-report.tsx — The emailed AI-detector report.
// Built from scores, a confidence level and catalog pattern labels only: the
// person's text never reaches our server for this email, and no string the
// requester typed is rendered in it.
// ===========================================================

import { Link, Text } from "react-email";
import type { TemplateComponentProps, TemplateDef } from "@/emails/registry";
import { EmailLayout } from "@/emails/components/layout";
import { BRAND, Bullets, Button, Callout, Greeting, H1, P, Signature } from "@/emails/components/primitives";
import { fixForPattern } from "@/lib/growth/pattern-fixes";

/** How many patterns the report explains (the client sends them strongest first). */
export const REPORT_TOP_PATTERNS = 3;

function headlineScore(p: { instantScore: number; deepScore?: number }): number {
  return Math.round(p.deepScore ?? p.instantScore);
}

const scoreLine = { fontSize: 15, lineHeight: "24px", color: BRAND.text, margin: "0 0 4px" } as const;
const linkStyle = { color: BRAND.color, textDecorationLine: "underline" } as const;

function DetectorReport({ p, ctx }: TemplateComponentProps<"detector_report">) {
  const top = p.patterns.filter((x) => x.hits > 0).slice(0, REPORT_TOP_PATTERNS);
  const words = p.wordCount ? ` (${p.wordCount} words)` : "";
  return (
    <EmailLayout ctx={ctx} preview="Your scores, the patterns that raised them, and a fix for each one.">
      <H1>Your AI-detection report</H1>
      <Greeting ctx={ctx} />
      <P>{"Here's the report you asked for from the free AI detector at humanizeit.app."}</P>
      <Callout>
        <Text style={scoreLine}>{`Instant check: ${Math.round(p.instantScore)}/100 AI-likelihood${words}`}</Text>
        {p.deepScore !== undefined ? (
          <Text style={scoreLine}>
            {`Deep scan: ${Math.round(p.deepScore)}/100${p.confidence ? ` (${p.confidence} confidence)` : ""}`}
          </Text>
        ) : null}
      </Callout>
      {top.length > 0 ? (
        <>
          <P>
            <strong>The patterns that raised it most</strong>
          </P>
          <Bullets items={top.map((x) => `${x.label} (found ${x.hits}×): ${fixForPattern(x.id)}`)} />
        </>
      ) : (
        <P>The instant check found no strong AI patterns in your text.</P>
      )}
      <P>A score estimates how predictable the writing looks. It is not proof, and detectors often disagree.</P>
      <P>Your text was not stored or included in this email.</P>
      <Button href={ctx.link("/ai-detector")}>Check your revised draft</Button>
      {p.confirmUrl ? (
        <P muted>
          {"You also asked for writing tips. Nothing is sent until you confirm: "}
          <Link href={ctx.link(p.confirmUrl)} style={linkStyle}>
            Yes, send me tips
          </Link>
        </P>
      ) : null}
      <P>
        {"P.S. Worried about a false flag on work you wrote yourself? The free "}
        <Link href={ctx.link("/free/false-ai-flag-appeal-kit")} style={linkStyle}>
          False AI Flag Appeal Kit
        </Link>
        {" walks you through the first 24 hours."}
      </P>
      <Signature />
    </EmailLayout>
  );
}

export const detectorReport: TemplateDef<"detector_report"> = {
  subject: (p) => `Your AI-detection report: ${headlineScore(p)}/100 AI-likelihood`,
  Component: DetectorReport,
};
