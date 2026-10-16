"use client";

import { useActionState } from "react";
import { inviteStaffAction, type InviteState } from "@/app/dashboard-actions";

const initialState: InviteState = { error: "", success: "" };

export function StaffInvitationForm() {
  const [state, action, pending] = useActionState(inviteStaffAction, initialState);

  return (
    <form className="staff-invitation-form" action={action}>
      <label className="form-field" htmlFor="staff-name">
        <span>Full name</span>
        <input id="staff-name" name="fullName" maxLength={120} autoComplete="name" required />
      </label>
      <label className="form-field" htmlFor="staff-email">
        <span>Work email</span>
        <input
          id="staff-email"
          name="email"
          type="email"
          maxLength={254}
          autoComplete="email"
          required
        />
      </label>
      <label className="form-field" htmlFor="staff-role">
        <span>Role</span>
        <select id="staff-role" name="role" defaultValue="agent">
          <option value="agent">Agent</option>
          <option value="admin">Administrator</option>
        </select>
      </label>
      {state.error && <p className="form-message" role="alert">{state.error}</p>}
      {state.success && <p className="auth-notice" role="status">{state.success}</p>}
      <button className="button button--navy" type="submit" disabled={pending}>
        {pending ? "Sending invitation…" : "Invite staff member"}
      </button>
    </form>
  );
}
