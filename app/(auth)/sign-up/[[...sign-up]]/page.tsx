// ===========================================================
// /sign-up — Clerk sign-up, plus what we'll email (account mail only; tips
// are opt-in later) and, while the referral program is on, a note for
// visitors who arrive with a valid ?ref= code. A same-origin ?redirect_url=
// (a plan picked on the pricing page, /lifetime) is where the new account
// lands; anything else lands on the dashboard (lib/checkout-intent.ts).
// ===========================================================

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { THEME } from "@/lib/theme";
import { AuthShell, signUpAppearance } from "@/components/auth/auth-shell";
import { afterAuthPath, authPageUrl } from "@/lib/checkout-intent";
import { normalizeRef } from "@/lib/growth/attribution";
import { referralsEnabled } from "@/lib/growth/flags";
import { REFERRAL_REWARD_WORDS } from "@/lib/growth/referral-rules";
import { PLANS } from "@/lib/plans";

type Props = { searchParams: Promise<{ ref?: string | string[]; redirect_url?: string | string[] }> };

export default async function SignUpPage({ searchParams }: Props) {
  const { ref, redirect_url } = await searchParams;
  const invited = referralsEnabled() && normalizeRef(typeof ref === "string" ? ref : null) !== undefined;
  // Validated here and passed as forceRedirectUrl, which Clerk prefers over its own query params.
  const afterSignUp = afterAuthPath(redirect_url);
  return (
    <AuthShell
      tagline={`Free: ${PLANS.FREE.wordsLimit.toLocaleString("en-US")} words a day. No card needed.`}
      footnote={
        <>
          We only email you about your account; tips are opt-in.{" "}
          <Link href="/privacy" style={{ color: THEME.brandHi }}>Privacy</Link>
        </>
      }
    >
      {invited ? (
        <div
          role="note"
          style={{
            width: "100%", maxWidth: "400px", margin: "0 0 14px", padding: "12px 16px",
            background: THEME.accentDim, border: `1px solid ${THEME.border}`, borderRadius: THEME.radius,
            fontSize: "14px", color: THEME.text, lineHeight: 1.5, textAlign: "center",
          }}
        >
          {`You were invited: you and your friend each get ${REFERRAL_REWARD_WORDS.toLocaleString("en-US")} bonus words after your first document.`}
        </div>
      ) : null}
      <SignUp
        appearance={signUpAppearance} routing="path" path="/sign-up"
        signInUrl={authPageUrl("/sign-in", afterSignUp)}
        forceRedirectUrl={afterSignUp} fallbackRedirectUrl={afterSignUp}
        // An existing account that signs in from here (Google) goes to the same place.
        signInForceRedirectUrl={afterSignUp}
      />
    </AuthShell>
  );
}
