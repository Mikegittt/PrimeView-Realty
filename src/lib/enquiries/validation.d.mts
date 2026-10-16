export type EnquiryField = "clientName" | "email" | "phone" | "message";
export type EnquiryInput = {
  clientName: string;
  email: string;
  phone: string;
  propertyId: string | null;
  message: string;
  website?: string;
};

export type ValidatedEnquiry = {
  clientName: string;
  email: string;
  phone: string;
  propertyId: string | null;
  message: string;
  website?: string;
};

export function normalizeNigerianPhone(value: string): string;
export function validateEnquiry(input: unknown):
  | { success: true; data: ValidatedEnquiry }
  | { success: false; error: import("zod").ZodError };
export function getEnquiryFieldErrors(
  error: import("zod").ZodError,
): Record<string, string>;
