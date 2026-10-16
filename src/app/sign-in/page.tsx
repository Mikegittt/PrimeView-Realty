import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getAuthenticatedProfile } from "@/lib/auth/server";
import { dashboardPathForRole } from "@/lib/auth/roles.mjs";

export const metadata: Metadata = { title: "Staff sign in" };
export const dynamic = "force-dynamic";

type SignInPageProps = {
  searchParams: Promise<{ signedOut?: string; error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const [profile, params] = await Promise.all([getAuthenticatedProfile(), searchParams]);
  if (profile) redirect(dashboardPathForRole(profile.role));

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="sign-in-title">
        <Link className="brand" href="/" aria-label="PrimeView Realty home">
          PrimeView<span className="brand__accent">.</span>
          <span className="brand__realty">Realty</span>
        </Link>
        <p className="eyebrow eyebrow--muted">Staff access</p>
        <h1 id="sign-in-title">Welcome back.</h1>
        <p>Sign in with the staff account invited by your agency administrator.</p>
        {params.signedOut === "1" && (
          <p className="auth-notice" role="status">You have been signed out.</p>
        )}
        {params.error === "sign-out" && (
          <p className="form-message" role="alert">
            Your session could not be revoked. Close this browser session and contact an administrator.
          </p>
        )}
        <SignInForm />
        <Link className="text-link auth-back-link" href="/">
          Return to PrimeView Realty
        </Link>
      </section>
    </main>
  );
}
