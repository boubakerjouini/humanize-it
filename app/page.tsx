"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, ChevronRight, Clipboard, BarChart2, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

// ---- Fake demo ----

const DEMO_PHRASES = [
  "In today's rapidly evolving landscape",
  "it is important to note that",
  "pivotal",
  "nuanced",
  "comprehensive",
  "Moreover",
];

function fakeScore(text: string): number {
  if (!text.trim()) return 0;
  let score = 20;
  const lower = text.toLowerCase();
  for (const phrase of DEMO_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) score += 12;
  }
  // length factor
  const words = text.trim().split(/\s+/).length;
  if (words > 30) score += 10;
  return Math.min(95, score);
}

function scoreColor(s: number): string {
  if (s >= 75) return "text-red-500";
  if (s >= 50) return "text-orange-500";
  if (s >= 25) return "text-yellow-500";
  return "text-green-500";
}

function scoreBg(s: number): string {
  if (s >= 75) return "bg-red-500";
  if (s >= 50) return "bg-orange-500";
  if (s >= 25) return "bg-yellow-500";
  return "bg-green-500";
}

function scoreLabel(s: number): string {
  if (s >= 75) return "Very likely AI-generated 🔴";
  if (s >= 50) return "Likely AI-generated 🟠";
  if (s >= 25) return "Possibly AI-generated 🟡";
  return "Looks human 🟢";
}

// ---- Pricing ----

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "500 words/day",
      "1 rewrite/day",
      "Standard tone",
      "Basic history",
    ],
    cta: "Get Started",
    ctaHref: "/sign-up",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$9",
    period: "/month",
    features: [
      "50,000 words/month",
      "Unlimited rewrites",
      "All 4 tone options",
      "30-day history",
      "No watermark",
    ],
    cta: "Upgrade to Pro →",
    ctaHref: "/sign-up",
    highlighted: true,
  },
  {
    name: "Team",
    price: "$29",
    period: "/month",
    features: [
      "200,000 words/month",
      "Unlimited rewrites",
      "API access",
      "Unlimited history",
      "Priority support",
    ],
    cta: "Start Team Plan →",
    ctaHref: "/sign-up",
    highlighted: false,
  },
];

// ---- Component ----

export default function LandingPage() {
  const [demoText, setDemoText] = useState("");
  const score = fakeScore(demoText);
  const showScore = demoText.trim().length > 20;

  const detectedPhrases = DEMO_PHRASES.filter((p) =>
    demoText.toLowerCase().includes(p.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Nav */}
      <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-indigo-500" />
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">HumanizeIt</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="#pricing"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 hidden sm:block"
            >
              Pricing
            </Link>
            <Link href="/sign-in">
              <Button variant="outline" size="sm">Sign In</Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Try Free →
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-20 pb-16 text-center">
        <Badge variant="outline" className="mb-4 text-indigo-600 border-indigo-200 bg-indigo-50">
          24 AI detection patterns · No signup required
        </Badge>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-zinc-900 dark:text-zinc-50 leading-tight">
          Is your text{" "}
          <span className="text-indigo-600">obviously AI?</span>
        </h1>
        <p className="mt-4 text-lg text-zinc-500 max-w-xl mx-auto">
          Detect AI-generated text with 24 patterns. Rewrite it to sound human in one click. Score drops from 78 to 12.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link href="/sign-up">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Try Free — No Signup Required
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button variant="outline" size="lg">Sign In</Button>
          </Link>
        </div>
      </section>

      {/* Interactive demo */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-6 shadow-lg">
          <p className="text-sm font-medium text-zinc-500 mb-3">
            ↓ Try it now — paste some text below
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Input */}
            <div>
              <Textarea
                value={demoText}
                onChange={(e) => setDemoText(e.target.value)}
                placeholder={`Paste your text here...\n\nTry pasting something with: "In today's rapidly evolving landscape" or "it is important to note that"`}
                className="min-h-[200px] resize-none bg-white dark:bg-zinc-800 text-sm"
                maxLength={500}
              />
              <p className="text-xs text-zinc-400 mt-1">
                {demoText.length}/500 chars · Demo limited to 500 chars
              </p>
            </div>

            {/* Score display */}
            <div className="flex flex-col justify-center">
              {showScore ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className={`text-5xl font-black ${scoreColor(score)}`}>
                      {score}
                    </div>
                    <div className="text-sm text-zinc-500 mt-1">AI Score / 100</div>
                    <div className="mt-2 w-full bg-zinc-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-500 ${scoreBg(score)}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    <p className={`mt-1.5 text-sm font-medium ${scoreColor(score)}`}>
                      {scoreLabel(score)}
                    </p>
                  </div>

                  {detectedPhrases.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-zinc-500">Detected patterns:</p>
                      {detectedPhrases.map((phrase) => (
                        <div
                          key={phrase}
                          className="text-xs px-2 py-1 bg-red-50 border border-red-200 text-red-700 rounded"
                        >
                          🔴 &ldquo;{phrase}&rdquo;
                        </div>
                      ))}
                    </div>
                  )}

                  <Link href="/sign-up" className="block">
                    <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                      Humanize Text → (Free)
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center text-zinc-400 py-8">
                  <BarChart2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Paste text to see your AI score</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold text-center text-zinc-900 dark:text-zinc-50 mb-10">
          How it works
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              icon: Clipboard,
              step: "1",
              title: "Paste your text",
              desc: "Drop in any text — blog post, essay, email, or report. Up to 10,000 characters.",
            },
            {
              icon: BarChart2,
              step: "2",
              title: "Get your AI score",
              desc: "Instant analysis against 24 AI patterns. See exactly which phrases gave you away.",
            },
            {
              icon: Pencil,
              step: "3",
              title: "Humanize in one click",
              desc: "GPT-4o-mini rewrites targeted to your specific patterns. Watch the score drop.",
            },
          ].map(({ icon: Icon, step, title, desc }) => (
            <Card key={step} className="text-center">
              <CardContent className="pt-6 pb-5">
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-3">
                  <Icon className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="text-xs font-bold text-indigo-600 mb-1">Step {step}</div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-1.5">{title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Before / After */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold text-center text-zinc-900 dark:text-zinc-50 mb-3">
          Before & After
        </h2>
        <p className="text-center text-zinc-500 text-sm mb-8">
          This is the &ldquo;wow moment&rdquo;. Score drops from 78 → 12.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-red-200">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-zinc-500 uppercase">Before</span>
                <Badge className="bg-red-500 text-white border-0">78 / 100</Badge>
              </div>
              <p className="text-sm text-zinc-600 leading-relaxed italic">
                &ldquo;In today&apos;s rapidly evolving landscape, it is important to note that the paradigm of
                artificial intelligence has shifted significantly. This comprehensive analysis delves into
                the multifaceted nature of the technology...&rdquo;
              </p>
              <Progress value={78} className="mt-3 h-2 [&>div]:bg-red-500" />
            </CardContent>
          </Card>
          <Card className="border-green-200">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-zinc-500 uppercase">After</span>
                <Badge className="bg-green-500 text-white border-0">12 / 100</Badge>
              </div>
              <p className="text-sm text-zinc-600 leading-relaxed italic">
                &ldquo;AI has moved fast. What used to take months now takes days — and that&apos;s changing how
                teams work. This piece breaks down the shift, what caused it, and what it means
                for the people building these systems...&rdquo;
              </p>
              <Progress value={12} className="mt-3 h-2 [&>div]:bg-green-500" />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-5xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold text-center text-zinc-900 dark:text-zinc-50 mb-10">
          Pricing
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={`relative ${
                plan.highlighted
                  ? "border-indigo-400 shadow-lg ring-2 ring-indigo-500 ring-offset-2"
                  : ""
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-indigo-600 text-white border-0">Most Popular ⭐</Badge>
                </div>
              )}
              <CardContent className="pt-6 pb-5">
                <div className="text-sm font-semibold text-zinc-500 mb-1">{plan.name}</div>
                <div className="flex items-baseline gap-0.5 mb-4">
                  <span className="text-3xl font-black text-zinc-900 dark:text-zinc-50">{plan.price}</span>
                  <span className="text-sm text-zinc-500">{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.ctaHref}>
                  <Button
                    className={`w-full ${
                      plan.highlighted
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                        : ""
                    }`}
                    variant={plan.highlighted ? "default" : "outline"}
                    size="sm"
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">HumanizeIt</span>
          </div>
          <div className="flex gap-4 text-xs text-zinc-500">
            <Link href="/sign-in" className="hover:text-zinc-900">Sign In</Link>
            <Link href="/sign-up" className="hover:text-zinc-900">Sign Up</Link>
            <a href="mailto:hello@humanizeit.app" className="hover:text-zinc-900">Contact</a>
          </div>
          <p className="text-xs text-zinc-400">© 2026 HumanizeIt. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
