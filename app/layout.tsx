import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Suspense } from "react";
import { Providers } from "./providers";
import { PostHogPageview } from "@/components/posthog-pageview";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HumanizeIt — Detect & Humanize AI Text",
  description: "Score your text against 24 AI detection patterns and rewrite it to sound 100% human. Free to start.",
  openGraph: {
    title: "HumanizeIt — Detect & Humanize AI Text",
    description: "Score your text against 24 AI detection patterns and rewrite it to sound 100% human.",
    url: "https://humanizeit.app",
    siteName: "HumanizeIt",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HumanizeIt — Detect & Humanize AI Text",
    description: "Score your text against 24 AI detection patterns and rewrite it to sound 100% human.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <Providers>
            <Suspense fallback={null}>
              <PostHogPageview />
            </Suspense>
            {children}
          </Providers>
          <Toaster richColors position="bottom-center" />
        </body>
      </html>
    </ClerkProvider>
  );
}
