import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import test from "node:test";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(supabaseUrl && serviceRoleKey);

test(
  "EF-04/05/06: database persists new enquiries and deduplicates concurrent retries",
  { skip: !configured && "Requires Supabase URL, service-role key and applied migrations." },
  async () => {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const ipHash = randomBytes(32).toString("hex");
    const requestId = randomUUID();
    const payloadHash = createHash("sha256")
      .update(`primeview-integration-${randomUUID()}`)
      .digest("hex");
    let propertyId = null;
    const payload = {
      p_ip_hash: ipHash,
      p_payload_hash: payloadHash,
      p_client_name: "PrimeView integration test",
      p_email: `primeview-test-${randomUUID()}@example.com`,
      p_phone: "+2348031234567",
      p_property_id: null,
      p_message: "Automated persistence and retry test.",
    };
    const leadIds = new Set();

    async function submit(id) {
      const { data, error } = await supabase.rpc("create_public_enquiry", {
        ...payload,
        p_request_id: id,
      });
      assert.ifError(error);
      assert.equal(data?.length, 1);
      return data[0];
    }

    try {
      const { data: property, error: propertyError } = await supabase
        .from("properties")
        .insert({
          title: `Integration test ${randomUUID()}`,
          description: "Temporary property for the enquiry persistence test.",
          location: "Integration test location",
          price: 1,
          purpose: "sale",
          property_type: "Integration test",
          status: "published",
        })
        .select("id")
        .single();

      assert.ifError(propertyError);
      assert.ok(property);
      propertyId = property.id;
      payload.p_property_id = propertyId;

      const [first, retry] = await Promise.all([
        submit(requestId),
        submit(requestId),
      ]);

      if (first.lead_id) leadIds.add(first.lead_id);
      if (retry.lead_id) leadIds.add(retry.lead_id);
      assert.ok(first.lead_id);
      assert.equal(first.lead_id, retry.lead_id);
      assert.deepEqual(
        [first.duplicate, retry.duplicate].sort(),
        [false, true],
      );

      const independent = await submit(randomUUID());
      if (independent.lead_id) leadIds.add(independent.lead_id);
      assert.ok(independent.lead_id);
      assert.notEqual(independent.lead_id, first.lead_id);
      assert.equal(independent.duplicate, false);

      const { data: savedLeads, error: verificationError } = await supabase
        .from("leads")
        .select("id, status, property_id, created_at")
        .in("id", [...leadIds]);

      assert.ifError(verificationError);
      assert.equal(savedLeads.length, 2);
      for (const lead of savedLeads) {
        assert.equal(lead.status, "New");
        assert.equal(lead.property_id, propertyId);
        assert.ok(Date.parse(lead.created_at));
      }
    } finally {
      if (leadIds.size) {
        const { error: activityError } = await supabase
          .from("activity_logs")
          .delete()
          .in("lead_id", [...leadIds]);
        assert.ifError(activityError);
        const { error } = await supabase.from("leads").delete().in("id", [...leadIds]);
        assert.ifError(error);
      }
      if (propertyId) {
        const { error: activityError } = await supabase
          .from("activity_logs")
          .delete()
          .eq("property_id", propertyId);
        assert.ifError(activityError);
        const { error } = await supabase.from("properties").delete().eq("id", propertyId);
        assert.ifError(error);
      }
    }
  },
);
