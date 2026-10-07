// ===========================================================
// lib/growth/magnets.ts — The free lead magnets: landing copy, SEO, FAQs and
// where each one is promoted. The PDFs are committed at
// public/lead-magnets/<slug>.pdf; this copy describes what is actually in
// them, so update both together. Pure: safe in client and server code.
//
// Positioning: these help honest writers understand detectors, show their
// process and sound like themselves. Nothing here promises a detector result.
// ===========================================================

import type { MagnetSlug } from "@/lib/growth/constants";

export type MagnetFaq = { q: string; a: string };

export type Magnet = {
  slug: MagnetSlug;
  title: string;
  shortTitle: string;
  /** Kind of resource, for the kicker and buttons ("kit", "guide", "checklist"). */
  noun: string;
  subtitle: string;
  promise: string;
  bullets: string[];
  forWho: string[];
  pages: number;
  /** Where to start reading, used by the delivery email and the thanks page. */
  firstSection: string;
  /** Optional honesty line shown on the landing page. */
  guardrail?: string;
  relatedPostSlugs: string[];
  seo: { title: string; description: string; keywords: string[] };
  faqs: MagnetFaq[];
  nextStep: { label: string; href: string; body: string };
};

const SHARED_FAQS: MagnetFaq[] = [
  {
    q: "Is it really free?",
    a: "Yes. Enter your email and the PDF download appears right away. Writing tips by email are a separate, optional box that starts unticked.",
  },
];

export const MAGNETS: Record<MagnetSlug, Magnet> = {
  "false-ai-flag-appeal-kit": {
    slug: "false-ai-flag-appeal-kit",
    title: "The False AI Flag Appeal Kit",
    shortTitle: "False AI Flag Appeal Kit",
    noun: "kit",
    subtitle:
      "What to do when your own writing is flagged as AI: a 24-hour plan, an evidence checklist, three email templates and a meeting script.",
    promise: "Wrote it yourself and still got flagged? Respond calmly, with evidence, within 24 hours.",
    bullets: [
      "A 24-hour plan: what to do first, and what not to touch",
      "An evidence checklist: version history, drafts, notes, sources and the people who saw your work",
      "Why detectors misfire, on one page, citing Liang et al. (2023) and Turnitin's own guidance",
      "Three email templates: to an instructor, a client or an employer",
      "A meeting script with good questions to ask and things to avoid",
      "Prevention habits and a simple writing log for next time",
    ],
    forWho: [
      "Students, especially people writing in a second language",
      "Freelancers whose client ran a detector on their work",
      "Job seekers and employees asked whether they used AI",
    ],
    pages: 15,
    firstSection: "the 24-hour plan at the start",
    guardrail:
      "This kit helps you show your real writing process. It won't help you hide AI use, and we don't recommend trying.",
    relatedPostSlugs: [],
    seo: {
      title: "False AI Flag Appeal Kit: What to Do If You're Wrongly Flagged",
      description:
        "Flagged as AI for writing you did yourself? Free kit: a 24-hour plan, an evidence checklist, email templates and a meeting script.",
      keywords: [
        "falsely flagged for ai",
        "false positive ai detector",
        "turnitin false positive what to do",
        "appeal ai detection",
        "accused of using ai",
        "ai detector wrong",
      ],
    },
    faqs: [
      ...SHARED_FAQS,
      {
        q: "Will this help me beat Turnitin or GPTZero?",
        a: "No. No tool can promise what a detector will say. The kit helps you do the thing that settles these cases: show how you wrote the work, calmly and with evidence.",
      },
      {
        q: "I used some AI help. Is this kit for me?",
        a: "Only if your rules allowed it. If you used AI in a way your course, client or employer didn't allow, the honest path is to say so and ask what can be done. The kit is for people who did the work and need to show it.",
      },
      {
        q: "Does it work outside school?",
        a: "Yes. It includes email templates for a client or editor and for an employer or recruiter, not only for an instructor.",
      },
      {
        q: "Is a detector score proof that I used AI?",
        a: "No. Detectors estimate a probability. Turnitin itself says its AI score should not be used as the sole basis for action against a student.",
      },
    ],
    nextStep: {
      label: "Check your own writing free",
      href: "/ai-detector",
      body: "See which passages read as formulaic before someone else checks them. The instant scan runs in your browser.",
    },
  },

  "ai-detection-field-guide": {
    slug: "ai-detection-field-guide",
    title: "The AI Detection Field Guide (2026)",
    shortTitle: "AI Detection Field Guide",
    noun: "guide",
    subtitle:
      "How AI detectors work, why honest writing gets flagged, and how to write in a way that sounds like you. No hype, no tricks.",
    promise: "Understand what AI detectors measure, and why they disagree, in 15 minutes.",
    bullets: [
      "The short version: five facts about detectors on one page",
      "How the three families of detectors work: trained classifiers, perplexity and burstiness, and watermarks",
      "What the research says about accuracy, and why non-native writers get flagged more",
      "The patterns that commonly trigger flags, in five groups, with what to write instead",
      "Seven habits for writing naturally, with a before-and-after paragraph",
      "A 15-point self-check to run before you submit",
    ],
    forWho: [
      "Students and teachers who want to understand a score",
      "Writers, editors and marketers who use AI for drafts",
      "Anyone writing in a second language",
    ],
    pages: 12,
    firstSection: "\"The short version\" at the start",
    relatedPostSlugs: ["ai-detection-how-it-works", "best-ai-humanizer-tools"],
    seo: {
      title: "AI Detection Field Guide 2026: How Detectors Work (Free PDF)",
      description:
        "Free guide: what AI detectors measure, why they disagree, why honest writing gets flagged, and how to write naturally. 12 pages, no hype.",
      keywords: [
        "how do ai detectors work",
        "ai detection guide",
        "perplexity and burstiness",
        "why ai detectors flag human writing",
        "ai detector accuracy",
        "write naturally ai detection",
      ],
    },
    faqs: [
      ...SHARED_FAQS,
      {
        q: "Does the guide tell me how to make AI text undetectable?",
        a: "No. It explains what detectors measure and how to write in your own voice. Anyone who promises \"100% undetectable\" is selling you a risk: detectors change often.",
      },
      {
        q: "Where do the patterns in the guide come from?",
        a: "From the pattern library our free AI detector uses. Commercial detectors don't publish what they look for; ours shows every pattern it finds.",
      },
      {
        q: "Is a low score a guarantee?",
        a: "No. A low score means one tool, on one day, didn't find strong signals. Different detectors often disagree.",
      },
    ],
    nextStep: {
      label: "Try the free AI detector",
      href: "/ai-detector",
      body: "Paste a paragraph and see which of the guide's patterns show up in it. No signup.",
    },
  },

  "linkedin-humanizer-checklist": {
    slug: "linkedin-humanizer-checklist",
    title: "The LinkedIn & Cover Letter Humanizing Checklist",
    shortTitle: "LinkedIn & Cover Letter Checklist",
    noun: "checklist",
    subtitle:
      "Started with an AI draft? Make your posts and cover letters sound like you, with before-and-after examples and a 15-point checklist.",
    promise: "Make AI-assisted posts and cover letters sound like you in 10 to 15 minutes.",
    bullets: [
      "The tells that make posts and cover letters read as generic AI text, with what to do instead",
      "A before-and-after LinkedIn post",
      "A before-and-after cover-letter paragraph",
      "A 15-point checklist for any AI-assisted post, letter, email or bio",
      "How to use AI drafts honestly at work",
    ],
    forWho: [
      "Job seekers writing cover letters",
      "Creators and consultants posting on LinkedIn",
      "Anyone who starts from an AI draft and wants it to sound like them",
    ],
    pages: 8,
    firstSection: "the table of tells near the start",
    relatedPostSlugs: ["humanize-chatgpt-text"],
    seo: {
      title: "LinkedIn & Cover Letter Humanizing Checklist (Free PDF)",
      description:
        "Free checklist to make AI-assisted LinkedIn posts and cover letters sound like you: the tells to cut, before-and-after examples, 15 checks.",
      keywords: [
        "humanize linkedin post",
        "ai cover letter sounds generic",
        "make ai writing sound human",
        "linkedin post checklist",
        "cover letter checklist",
      ],
    },
    faqs: [
      ...SHARED_FAQS,
      {
        q: "Is it OK to use AI for a cover letter?",
        a: "That depends on the employer. Some ask whether AI was used; answer truthfully. Either way, every fact must be yours and true, and the checklist helps you replace generic claims with your own details.",
      },
      {
        q: "Will this make my post pass an AI detector?",
        a: "No tool can guarantee how a reader or a detector will judge your text. The goal is a post or letter that is true, specific and sounds like you.",
      },
    ],
    nextStep: {
      label: "Check a draft with the free detector",
      href: "/ai-detector",
      body: "Paste your post or letter to see which phrases read as generic, then rewrite them with your own details.",
    },
  },
};

export const MAGNET_LIST: Magnet[] = Object.values(MAGNETS);

export function getMagnet(slug: string): Magnet | null {
  return Object.prototype.hasOwnProperty.call(MAGNETS, slug) ? MAGNETS[slug as MagnetSlug] : null;
}

export function magnetPath(slug: MagnetSlug): string {
  return `/free/${slug}`;
}

export function magnetPdfPath(slug: MagnetSlug): string {
  return `/lead-magnets/${slug}.pdf`;
}

/** Which magnet each blog post promotes. Posts without an entry get the field guide. */
const POST_MAGNET: Record<string, MagnetSlug> = {
  "ai-detection-how-it-works": "ai-detection-field-guide",
  "best-ai-humanizer-tools": "ai-detection-field-guide",
  "humanize-chatgpt-text": "linkedin-humanizer-checklist",
};

export function magnetForPost(postSlug: string): MagnetSlug {
  return POST_MAGNET[postSlug] ?? "ai-detection-field-guide";
}
