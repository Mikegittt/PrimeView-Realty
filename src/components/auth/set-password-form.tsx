"use client";

import { useActionState } from "react";
import { setPasswordAction, type PasswordState } from "@/app/account/actions";

const initialState: PasswordState = { error: "", success: "" };

export function SetPasswordForm() {
  const [state, action, pending] = useActionState(setPasswordAction, initialState);

  return (
    <form className="auth-form" action={action}>
      <label className="form-field" htmlFor="new-password">
        <span>New password</span>
        <input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
      </label>
      <label className="form-field" htmlFor="confirm-password">
        <span>Confirm password</span>
        <input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
      </label>
      <p className="auth-password-hint">Use at least 12 characters, including uppercase, lowercase and a number.</p>
      {state.error && <p className="form-message" role="alert">{state.error}</p>}
      <button className="button button--navy" type="submit" disabled={pending}>
        {pending ? "Updating password…" : "Set password"}
      </button>
    </form>
  );
}
