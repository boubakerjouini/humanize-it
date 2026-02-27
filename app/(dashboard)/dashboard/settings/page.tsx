"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { ExternalLink, Zap, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface UsageData {
  plan: string;
  wordsUsed: number;
  wordsLimit: number;
  rewriteCount: number;
  rewriteLimit: number;
  quotaResetAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function SettingsPage() {
  const { user } = useUser();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d: UsageData) => setUsage(d))
      .catch(() => undefined);
  }, []);

  const handleUpgrade = async (planId: "PRO" | "TEAM") => {
    setLoadingCheckout(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json() as { url?: string; error?: { message: string } };
      if (!res.ok || !data.url) {
        toast.error(data.error?.message ?? "Failed to open checkout.");
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error("Network error.");
    } finally {
      setLoadingCheckout(false);
    }
  };

  const handleBillingPortal = async () => {
    setLoadingPortal(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json() as { url?: string; error?: { message: string } };
      if (!res.ok || !data.url) {
        toast.error(data.error?.message ?? "Failed to open billing portal.");
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error("Network error.");
    } finally {
      setLoadingPortal(false);
    }
  };

  const isFree = !usage || usage.plan === "FREE";
  const wordsPercent = usage
    ? Math.min(100, Math.round((usage.wordsUsed / usage.wordsLimit) * 100))
    : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Manage your plan and account.</p>
      </div>

      {/* Current plan + usage */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Current Plan</CardTitle>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                isFree
                  ? "bg-zinc-100 text-zinc-600"
                  : "bg-indigo-100 text-indigo-700"
              }`}
            >
              {usage?.plan ?? "FREE"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {usage ? (
            <>
              {/* Words */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Words used</span>
                  <span className="text-sm font-mono">
                    {usage.wordsUsed.toLocaleString()} / {usage.wordsLimit.toLocaleString()}
                  </span>
                </div>
                <Progress
                  value={wordsPercent}
                  className={`h-2 ${wordsPercent > 80 ? "[&>div]:bg-orange-500" : "[&>div]:bg-indigo-500"}`}
                />
                {wordsPercent > 80 && (
                  <p className="text-xs text-orange-500 mt-1">
                    ⚠ You&apos;ve used {wordsPercent}% of your limit.
                  </p>
                )}
              </div>

              {/* Rewrites */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Rewrites used</span>
                <span className="font-mono">
                  {usage.rewriteCount} / {usage.rewriteLimit === -1 ? "∞" : usage.rewriteLimit}
                </span>
              </div>

              {/* Reset date */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Quota resets</span>
                <span className="text-zinc-700 dark:text-zinc-300">
                  {formatDate(usage.quotaResetAt)}
                </span>
              </div>
            </>
          ) : (
            <div className="h-16 bg-zinc-100 animate-pulse rounded" />
          )}
        </CardContent>
      </Card>

      {/* Upgrade card (FREE only) */}
      {isFree && (
        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
          <CardContent className="py-5">
            <div className="flex items-start gap-3">
              <Star className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                  Upgrade to Pro — $9/month
                </h3>
                <ul className="text-xs text-indigo-700 dark:text-indigo-300 mt-1.5 space-y-0.5">
                  <li>✓ 50,000 words/month</li>
                  <li>✓ Unlimited rewrites</li>
                  <li>✓ All 4 tone options</li>
                  <li>✓ 30-day document history</li>
                  <li>✓ No watermark</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                size="sm"
                onClick={() => handleUpgrade("PRO")}
                disabled={loadingCheckout}
              >
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                Upgrade to Pro →
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUpgrade("TEAM")}
                disabled={loadingCheckout}
              >
                Team $29/mo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manage billing (paid users) */}
      {!isFree && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Billing</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBillingPortal}
              disabled={loadingPortal}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Manage Billing →
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Profile */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                {user?.fullName ?? "—"}
              </p>
              <p className="text-xs text-zinc-500">
                {user?.primaryEmailAddress?.emailAddress ?? "—"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("https://accounts.clerk.com", "_blank")}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Edit via Clerk
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
