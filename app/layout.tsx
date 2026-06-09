import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import { Suspense } from "react";
import { Sora, Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import { PostHogPageview } from "@/components/posthog-pageview";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import "./globals.css";
import { PATTERN_COUNT } from "@/lib/algorithms/patterns";

// Aurora type system — self-hosted via next/font (no render-blocking @import)
const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HumanizeIt — AI Humanizer That Bypasses GPTZero & Turnitin",
  description: "Paste your ChatGPT text and get an undetectable, naturally human version in seconds. Beats GPTZero, Turnitin & Originality.ai. Free plan available — no credit card required.",
  metadataBase: new URL("https://humanizeit.app"),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  openGraph: {
    title: "HumanizeIt — AI Text Humanizer That Bypasses GPTZero & Turnitin",
    description: `Score your text against ${PATTERN_COUNT} AI detection patterns and rewrite it to sound 100% human.`,
    url: "https://humanizeit.app",
    siteName: "HumanizeIt",
    type: "website",
    // Images are auto-wired from app/opengraph-image.tsx (dynamic generator).
  },
  twitter: {
    card: "summary_large_image",
    title: "HumanizeIt — AI Text Humanizer That Bypasses GPTZero & Turnitin",
    description: `Score your text against ${PATTERN_COUNT} AI detection patterns and rewrite it to sound 100% human.`,
    // Image auto-wired from app/twitter-image.tsx.
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://humanizeit.app",
  },
  verification: {
    // GSC verified via DNS — no meta tag needed
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        suppressHydrationWarning
        className={`${sora.variable} ${inter.variable} ${jetbrainsMono.variable}`}
      >
        <head>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebApplication",
                name: "HumanizeIt",
                url: "https://humanizeit.app",
                description: `Detect AI-generated text with ${PATTERN_COUNT}-pattern analysis and humanize it to read naturally against GPTZero, Turnitin, and Originality.ai`,
                applicationCategory: "WritingApplication",
                operatingSystem: "Web",
                offers: [
                  {
                    "@type": "Offer",
                    name: "Free",
                    price: "0",
                    priceCurrency: "USD",
                  },
                  {
                    "@type": "Offer",
                    name: "Pro",
                    price: "9",
                    priceCurrency: "USD",
                  },
                  {
                    "@type": "Offer",
                    name: "Team",
                    price: "29",
                    priceCurrency: "USD",
                  },
                ],
              }),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Organization",
                "@id": "https://humanizeit.app/#organization",
                name: "HumanizeIt",
                url: "https://humanizeit.app",
                logo: "https://humanizeit.app/icon.png",
                description:
                  "AI text humanizer that rewrites AI-generated text to read naturally and bypass AI detectors like GPTZero, Turnitin, and Originality.ai.",
                sameAs: [
                  "https://www.linkedin.com/in/boubakerjouini/",
                  "https://github.com/boubakerjouini/humanize-it-extension",
                ],
              }),
            }}
          />
          {/* FAQPage JSON-LD is emitted per-page (homepage, /bypass/*, /faq) from
              that page's *visible* FAQ — Google requires the markup to match
              visible content, so it must not live in the global <head>. */}
        </head>
        <body className="antialiased">
          {process.env.NEXT_PUBLIC_GA_ID && (
            <>
              <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
                strategy="afterInteractive"
              />
              <Script id="google-analytics" strategy="afterInteractive">
                {`
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
                `}
              </Script>
            </>
          )}
          <Providers>
            <Suspense fallback={null}>
              <PostHogPageview />
            </Suspense>
            {children}
          </Providers>
          <Toaster richColors position="bottom-center" />
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
