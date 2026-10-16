"use client";

import { useActionState } from "react";
import { signInAction, type SignInState } from "@/app/auth/actions";

const initialState: SignInState = { error: "" };

export function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, initialState);

  return (
    <form className="auth-form" action={action}>
      <label className="form-field" htmlFor="sign-in-email">
        <span>Work email</span>
        <input
          id="sign-in-email"
          name="email"
          type="email"
          autoComplete="username"
          maxLength={254}
          required
        />
      </label>
      <label className="form-field" htmlFor="sign-in-password">
        <span>Password</span>
        <input
          id="sign-in-password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={1024}
          required
        />
      </label>
      {state.error && <p className="form-message" role="alert">{state.error}</p>}
      <button className="button button--navy" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
