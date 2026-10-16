import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { getAuthenticatedProfile } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Set your staff password" };
export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  const profile = await getAuthenticatedProfile();
  if (!profile) redirect("/sign-in");

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="set-password-title">
        <Link className="brand" href="/" aria-label="PrimeView Realty home">
          PrimeView<span className="brand__accent">.</span>
          <span className="brand__realty">Realty</span>
        </Link>
        <p className="eyebrow eyebrow--muted">Invitation accepted</p>
        <h1 id="set-password-title">Secure your account.</h1>
        <p>Create a private password before opening your agency workspace.</p>
        <SetPasswordForm />
      </section>
    </main>
  );
}
