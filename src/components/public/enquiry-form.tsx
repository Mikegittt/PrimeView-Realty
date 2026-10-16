"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  getEnquiryFieldErrors,
  validateEnquiry,
} from "@/lib/enquiries/validation.mjs";
import type { EnquiryField } from "@/lib/enquiries/validation.mjs";

type FieldErrors = Partial<Record<EnquiryField, string>>;

type EnquiryResponse = {
  ok?: boolean;
  duplicate?: boolean;
  leadId?: string;
  error?: string;
  fieldErrors?: FieldErrors;
};

export function EnquiryForm({
  propertyId,
}: {
  propertyId: string | null;
}) {
  const requestId = useRef<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [duplicate, setDuplicate] = useState(false);

  function handleChange(event: ChangeEvent<HTMLFormElement>) {
    requestId.current = null;
    const field = event.target.name as EnquiryField;
    if (field === "clientName" || field === "email" || field === "phone" || field === "message") {
      setFieldErrors((current) => {
        if (!current[field]) return current;
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
    setFormError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const parsed = validateEnquiry({
      clientName: formData.get("clientName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      propertyId,
      message: formData.get("message"),
      website: formData.get("website"),
    });

    if (!parsed.success) {
      setFieldErrors(getEnquiryFieldErrors(parsed.error) as FieldErrors);
      setFormError("Please correct the highlighted fields.");
      form.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }

    if (parsed.data.website?.trim()) {
      setFormError("Enquiry could not be submitted.");
      return;
    }

    setFieldErrors({});
    setFormError("");
    setSubmitting(true);
    requestId.current ??= crypto.randomUUID();

    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requestId.current,
        },
        body: JSON.stringify(parsed.data),
      });
      const result: EnquiryResponse = await response.json();

      if (!response.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.error ?? "We couldn’t save your enquiry. Please try again.");
        const firstInvalid = Object.keys(result.fieldErrors ?? {})[0];
        if (firstInvalid) {
          form.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
        }
        return;
      }

      if (!result.ok || !result.leadId) {
        setFormError("We couldn’t confirm that your enquiry was saved. Please try again.");
        return;
      }

      setDuplicate(result.duplicate ?? false);
      setSubmitted(true);
    } catch {
      setFormError("We couldn’t reach the enquiry service. Your details are still here; please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="enquiry-success" role="status" aria-live="polite">
        <span className="enquiry-success__mark" aria-hidden="true">✓</span>
        <h2>{duplicate ? "We already have your enquiry." : "Thank you for getting in touch."}</h2>
        <p>
          {duplicate
            ? "Your earlier submission was saved successfully. Our team will be in touch soon."
            : "Your enquiry has been saved. Our team will be in touch soon."}
        </p>
      </div>
    );
  }

  return (
    <form className="enquiry-form" onSubmit={handleSubmit} onChange={handleChange} noValidate>
      <fieldset className="enquiry-fields" disabled={submitting}>
        <div className="form-grid">
          <label className="form-field">
            <span>Full name</span>
            <input
              id="enquiry-client-name"
              name="clientName"
              autoComplete="name"
              maxLength={120}
              required
              aria-invalid={Boolean(fieldErrors.clientName)}
              aria-describedby={fieldErrors.clientName ? "enquiry-client-name-error" : undefined}
            />
            {fieldErrors.clientName && (
              <span className="field-error" id="enquiry-client-name-error" role="alert">
                {fieldErrors.clientName}
              </span>
            )}
          </label>
          <label className="form-field">
            <span>Email address</span>
            <input
              id="enquiry-email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "enquiry-email-error" : undefined}
            />
            {fieldErrors.email && (
              <span className="field-error" id="enquiry-email-error" role="alert">
                {fieldErrors.email}
              </span>
            )}
          </label>
        </div>
        <label className="form-field">
          <span>Phone number</span>
          <input
            id="enquiry-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={32}
            placeholder="0803 123 4567"
            required
            aria-invalid={Boolean(fieldErrors.phone)}
            aria-describedby={`enquiry-phone-help${fieldErrors.phone ? " enquiry-phone-error" : ""}`}
          />
          <small id="enquiry-phone-help">
            Nigerian mobile format: 08031234567 or +234 803 123 4567.
          </small>
          {fieldErrors.phone && (
            <span className="field-error" id="enquiry-phone-error" role="alert">
              {fieldErrors.phone}
            </span>
          )}
        </label>
        <label className="form-field">
          <span>How can we help?</span>
          <textarea
            id="enquiry-message"
            name="message"
            rows={5}
            maxLength={3000}
            required
            aria-invalid={Boolean(fieldErrors.message)}
            aria-describedby={fieldErrors.message ? "enquiry-message-error" : undefined}
          />
          {fieldErrors.message && (
            <span className="field-error" id="enquiry-message-error" role="alert">
              {fieldErrors.message}
            </span>
          )}
        </label>
        <input
          className="honeypot"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
      </fieldset>
      <button className="button button--navy" type="submit" disabled={submitting}>
        {submitting ? "Saving enquiry…" : "Send enquiry"}
        {!submitting && <span aria-hidden="true">→</span>}
      </button>
      {formError && <p className="form-message" role="alert">{formError}</p>}
    </form>
  );
}
