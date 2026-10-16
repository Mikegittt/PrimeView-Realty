import assert from "node:assert/strict";
import test from "node:test";
import {
  getEnquiryFieldErrors,
  validateEnquiry,
} from "../src/lib/enquiries/validation.mjs";

const validEnquiry = {
  clientName: "  Ada Okafor  ",
  email: "  Ada@example.com ",
  phone: "0803 123 4567",
  propertyId: null,
  message: "  I would like to arrange a viewing.  ",
  website: "",
};

test("EF-01: required fields are rejected with visible field-level messages", () => {
  const result = validateEnquiry({
    clientName: "   ",
    email: "",
    phone: "",
    propertyId: null,
    message: "  ",
    website: "",
  });

  assert.equal(result.success, false);
  if (result.success) return;

  assert.deepEqual(getEnquiryFieldErrors(result.error), {
    clientName: "Enter your full name.",
    email: "Enter your email address.",
    phone: "Enter your phone number.",
    message: "Add a message for our team.",
  });
});

test("EF-02: invalid email addresses are rejected", () => {
  const result = validateEnquiry({ ...validEnquiry, email: "ada@invalid" });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(getEnquiryFieldErrors(result.error).email, "Enter a valid email address.");
});

test("EF-03: Nigerian local and international mobile numbers are accepted and normalized", () => {
  const local = validateEnquiry(validEnquiry);
  const international = validateEnquiry({
    ...validEnquiry,
    phone: "+234 (803) 123-4567",
  });
  const otherNigerianPrefixes = validateEnquiry({
    ...validEnquiry,
    phone: "0814 123 4567",
  });

  assert.equal(local.success, true);
  assert.equal(international.success, true);
  assert.equal(otherNigerianPrefixes.success, true);
  if (local.success && international.success && otherNigerianPrefixes.success) {
    assert.equal(local.data.phone, "+2348031234567");
    assert.equal(international.data.phone, "+2348031234567");
    assert.equal(otherNigerianPrefixes.data.phone, "+2348141234567");
  }
});

test("EF-03: malformed or non-Nigerian phone numbers are rejected", () => {
  for (const phone of ["12345", "+1 212 555 0100", "0803123456", "080312345678"]) {
    const result = validateEnquiry({ ...validEnquiry, phone });
    assert.equal(result.success, false, `${phone} should be invalid`);
    if (!result.success) {
      assert.match(getEnquiryFieldErrors(result.error).phone, /Nigerian number/);
    }
  }
});

test("EF-01: backend validation trims names, email, phone and message", () => {
  const result = validateEnquiry(validEnquiry);
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.data.clientName, "Ada Okafor");
  assert.equal(result.data.email, "ada@example.com");
  assert.equal(result.data.phone, "+2348031234567");
  assert.equal(result.data.message, "I would like to arrange a viewing.");
});
