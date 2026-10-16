import { z } from "zod";

const nigerianPhonePattern = /^\+234[789]\d{9}$/;

export function normalizeNigerianPhone(value) {
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (compact.startsWith("0")) {
    return `+234${compact.slice(1)}`;
  }
  if (compact.startsWith("+234")) {
    return compact;
  }
  return compact;
}

export const enquirySchema = z.object({
  clientName: z.string().trim().min(1, "Enter your full name.").max(120, "Name must be 120 characters or fewer."),
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .max(254, "Email address must be 254 characters or fewer.")
    .pipe(z.email("Enter a valid email address."))
    .transform((value) => value.toLowerCase()),
  phone: z
    .string()
    .trim()
    .min(1, "Enter your phone number.")
    .max(32, "Phone number must be 32 characters or fewer.")
    .transform(normalizeNigerianPhone)
    .pipe(
      z
        .string()
        .regex(
          nigerianPhonePattern,
          "Enter a Nigerian number, e.g. 08031234567 or +234 803 123 4567.",
        ),
    ),
  propertyId: z
    .string()
    .uuid("The selected property is invalid.")
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  message: z.string().trim().min(1, "Add a message for our team.").max(3000, "Message must be 3,000 characters or fewer."),
  website: z.string().max(200).optional(),
}).strict();

/**
 * @typedef {import("./validation.d.mts").EnquiryInput} EnquiryInput
 */

/**
 * @param {unknown} input
 */
export function validateEnquiry(input) {
  return enquirySchema.safeParse(input);
}

/**
 * @param {import("zod").ZodError} error
 * @returns {Record<string, string>}
 */
export function getEnquiryFieldErrors(error) {
  const fieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && field !== "website" && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}
