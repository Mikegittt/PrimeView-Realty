import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getEnquiryFieldErrors,
  validateEnquiry,
} from "@/lib/enquiries/validation.mjs";

export const runtime = "nodejs";

const maxBodyBytes = 16 * 1024;
const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function readJsonBody(request: NextRequest): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) {
    throw new Error("empty_body");
  }

  const decoder = new TextDecoder();
  let body = "";
  let bytesRead = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytesRead += value.byteLength;
      if (bytesRead > maxBodyBytes) {
        await reader.cancel();
        throw new Error("body_too_large");
      }

      body += decoder.decode(value, { stream: true });
    }

    body += decoder.decode();
    return JSON.parse(body) as unknown;
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: NextRequest) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json." },
      { status: 415 },
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  const requestId = request.headers.get("idempotency-key")?.trim();
  if (!requestId || !requestIdPattern.test(requestId)) {
    return NextResponse.json(
      { error: "Please refresh the form and try again." },
      { status: 400 },
    );
  }

  const ipAddress = request.headers.get("x-real-ip")?.trim();
  const rateLimitSecret = process.env.ENQUIRY_RATE_LIMIT_SECRET;
  if (!ipAddress || isIP(ipAddress) === 0 || !rateLimitSecret || rateLimitSecret.length < 32) {
    console.error("Enquiry endpoint requires a trusted client IP and configured rate-limit secret.");
    return NextResponse.json(
      { error: "Enquiry service is not configured." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    const isTooLarge = error instanceof Error && error.message === "body_too_large";
    return NextResponse.json(
      {
        error: isTooLarge
          ? "Request body is too large."
          : "Request body must be valid JSON.",
      },
      { status: isTooLarge ? 413 : 400 },
    );
  }

  const parsed = validateEnquiry(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Please correct the highlighted fields.",
        fieldErrors: getEnquiryFieldErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  if (parsed.data.website?.trim()) {
    return NextResponse.json(
      { error: "Enquiry could not be submitted." },
      { status: 400 },
    );
  }

  const enquiry = parsed.data;
  const ipHash = createHmac("sha256", rateLimitSecret)
    .update(`primeview-enquiry-ip-v1\0${ipAddress}`)
    .digest("hex");
  const payloadHash = createHmac("sha256", rateLimitSecret)
    .update(
      `primeview-enquiry-payload-v1\0${JSON.stringify({
        clientName: enquiry.clientName,
        email: enquiry.email,
        phone: enquiry.phone,
        propertyId: enquiry.propertyId,
        message: enquiry.message,
      })}`,
    )
    .digest("hex");

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("create_public_enquiry", {
      p_request_id: requestId,
      p_ip_hash: ipHash,
      p_payload_hash: payloadHash,
      p_client_name: enquiry.clientName,
      p_email: enquiry.email,
      p_phone: enquiry.phone,
      p_property_id: enquiry.propertyId,
      p_message: enquiry.message,
    });

    if (error) {
      if (error.code === "22023") {
        return NextResponse.json(
          {
            error: "The selected property is no longer available. Please choose another listing.",
            fieldErrors: { propertyId: "This property is no longer available." },
          },
          { status: 400 },
        );
      }
      if (error.code === "22000") {
        return NextResponse.json(
          { error: "The enquiry changed while sending. Please review it and try again." },
          { status: 409 },
        );
      }
      console.error("Could not persist enquiry:", error.code);
      return NextResponse.json(
        { error: "We couldn’t save your enquiry. Please try again." },
        { status: 503 },
      );
    }

    const result = data?.[0];
    if (result?.rate_limited) {
      return NextResponse.json(
        { error: "Too many enquiries. Please try again later." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    }
    if (!result?.lead_id) {
      console.error("Enquiry RPC completed without a persisted lead ID.");
      return NextResponse.json(
        { error: "We couldn’t confirm that your enquiry was saved. Please try again." },
        { status: 503 },
      );
    }

    const { data: savedLead, error: verificationError } = await supabase
      .from("leads")
      .select("id, status, property_id, created_at")
      .eq("id", result.lead_id)
      .maybeSingle();

    if (verificationError || !savedLead || savedLead.status !== "New") {
      console.error("Could not verify persisted enquiry record:", verificationError?.code ?? "missing_record");
      return NextResponse.json(
        { error: "We couldn’t confirm that your enquiry was saved. Please try again." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        duplicate: result.duplicate,
        leadId: savedLead.id,
        propertyId: savedLead.property_id,
        createdAt: savedLead.created_at,
      },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch {
    console.error("Enquiry service is unavailable while saving a submission.");
    return NextResponse.json(
      { error: "Enquiry service is temporarily unavailable." },
      { status: 503 },
    );
  }
}
