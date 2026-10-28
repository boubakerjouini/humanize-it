import { SignIn } from "@clerk/nextjs";
import { AuthShell, signInAppearance } from "@/components/auth/auth-shell";
import { afterAuthPath, authPageUrl } from "@/lib/checkout-intent";

type Props = { searchParams: Promise<{ redirect_url?: string | string[] }> };

export default async function SignInPage({ searchParams }: Props) {
  // A same-origin ?redirect_url= (e.g. a plan picked on the pricing page, carried over from
  // /sign-up) is where the account lands; anything else lands on the dashboard.
  const afterSignIn = afterAuthPath((await searchParams).redirect_url);
  return (
    <AuthShell tagline="Welcome back. Pick up where you left off.">
      <SignIn
        appearance={signInAppearance} routing="path" path="/sign-in"
        signUpUrl={authPageUrl("/sign-up", afterSignIn)}
        forceRedirectUrl={afterSignIn} fallbackRedirectUrl={afterSignIn}
        signUpForceRedirectUrl={afterSignIn}
      />
    </AuthShell>
  );
}
