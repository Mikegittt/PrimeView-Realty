import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import test from "node:test";

const enabled = process.env.RUN_SUPABASE_RBAC_TESTS === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = enabled && Boolean(url && anonKey && serviceRoleKey);

test(
  "RBAC: anonymous and agent sessions cannot access private records or change roles",
  { skip: !configured && "Set RUN_SUPABASE_RBAC_TESTS=1 and use a disposable configured Supabase project." },
  async () => {
    const service = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const suffix = randomUUID();
    const users = [];
    const propertyIds = [];
    const leadIds = [];
    const { count: existingAdminCount, error: adminCountError } = await service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    assert.ifError(adminCountError);

    async function createStaff(role = "agent") {
      const email = `rbac-${role}-${randomUUID()}@example.com`;
      const password = `${randomUUID()}Aa9!`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `RBAC test ${role}` },
      });
      assert.ifError(error);
      assert.ok(data.user);
      users.push(data.user.id);

      if (role === "admin") {
        const { error: roleError } = await service
          .from("profiles")
          .update({ role: "admin" })
          .eq("id", data.user.id);
        assert.ifError(roleError);
      }

      const client = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const invalidSession = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: invalidSignInError } = await invalidSession.auth.signInWithPassword({
        email,
        password: "invalid-password",
      });
      assert.ok(invalidSignInError, "Invalid credentials must not create an authenticated session.");
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      assert.ifError(signInError);
      return { id: data.user.id, client };
    }

    async function addProperty(agentId, title) {
      const { data, error } = await service
        .from("properties")
        .insert({
          title: `${title} ${suffix}`,
          description: "Temporary RBAC test record.",
          location: "RBAC test",
          price: 1,
          purpose: "sale",
          property_type: "RBAC test",
          status: title.startsWith("Agent A") ? "published" : "draft",
          assigned_agent_id: agentId,
        })
        .select("id")
        .single();
      assert.ifError(error);
      propertyIds.push(data.id);
      return data.id;
    }

    try {
      const agentA = await createStaff();
      const agentB = await createStaff();
      const administrator = await createStaff("admin");
      const propertyA = await addProperty(agentA.id, "Agent A property");
      const propertyB = await addProperty(agentB.id, "Agent B property");

      const { data: createdProperty, error: createPropertyError } = await agentA.client
        .from("properties")
        .insert({
          title: `Agent-created draft ${suffix}`,
          description: "First draft.",
          location: "Draft location",
          price: 500000,
          purpose: "rent",
          property_type: "Apartment",
          status: "draft",
          assigned_agent_id: agentA.id,
          image_urls: [],
        })
        .select("id")
        .single();
      assert.ifError(createPropertyError);
      propertyIds.push(createdProperty.id);
      const { data: editedProperty, error: editPropertyError } = await agentA.client
        .from("properties")
        .update({
          title: `Agent-edited listing ${suffix}`,
          location: "Updated location",
          description: "Edited before publication.",
          price: 650000,
          image_urls: ["https://example.com/primeview-test.jpg"],
        })
        .eq("id", createdProperty.id)
        .select("title, location, status, price, image_urls")
        .single();
      assert.ifError(editPropertyError);
      assert.equal(editedProperty.title, `Agent-edited listing ${suffix}`);
      assert.equal(editedProperty.location, "Updated location");
      assert.equal(editedProperty.status, "draft");
      assert.deepEqual(editedProperty.image_urls, ["https://example.com/primeview-test.jpg"]);
      const { error: publishPropertyError } = await agentA.client
        .from("properties").update({ status: "published" }).eq("id", createdProperty.id);
      assert.ifError(publishPropertyError);
      const anonymousClient = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: publicListing, error: publicListingError } = await anonymousClient
        .from("properties").select("id").eq("id", createdProperty.id).maybeSingle();
      assert.ifError(publicListingError);
      assert.equal(publicListing?.id, createdProperty.id);
      const { error: archivePropertyError } = await agentA.client
        .from("properties").update({ status: "archived" }).eq("id", createdProperty.id);
      assert.ifError(archivePropertyError);
      const { data: archivedListing, error: archivedListingError } = await anonymousClient
        .from("properties").select("id").eq("id", createdProperty.id).maybeSingle();
      assert.ifError(archivedListingError);
      assert.equal(archivedListing, null);

      const { data: metricsBefore, error: metricsBeforeError } =
        await administrator.client.rpc("get_dashboard_metrics");
      assert.ifError(metricsBeforeError);

      for (const [propertyId, label] of [
        [propertyA, "A"],
        [propertyB, "B"],
      ]) {
        const { data, error } = await service
          .from("leads")
          .insert({
            client_name: `RBAC test client ${label}`,
            email: `client-${label.toLowerCase()}-${suffix}@example.com`,
            phone: "+2348031234567",
            message: "Temporary RBAC test.",
            property_id: propertyId,
            status: "New",
          })
          .select("id")
          .single();
        assert.ifError(error);
        leadIds.push(data.id);
      }

      const { error: assignAError } = await administrator.client
        .from("leads").update({ assigned_agent_id: agentA.id }).eq("id", leadIds[0]);
      assert.ifError(assignAError);
      const { error: assignBError } = await administrator.client
        .from("leads").update({ assigned_agent_id: agentB.id }).eq("id", leadIds[1]);
      assert.ifError(assignBError);

      const { data: anonymousLeads, error: anonymousLeadError } = await createClient(
        url,
        anonKey,
        { auth: { autoRefreshToken: false, persistSession: false } },
      ).from("leads").select("id");
      assert.ok(anonymousLeadError || anonymousLeads?.length === 0);

      const { data: anonymousProfiles, error: anonymousProfileError } = await createClient(
        url,
        anonKey,
        { auth: { autoRefreshToken: false, persistSession: false } },
      ).from("profiles").select("id");
      assert.ok(anonymousProfileError || anonymousProfiles?.length === 0);

      const { data: agentLeads, error: agentLeadError } = await agentA.client
        .from("leads").select("id");
      assert.ifError(agentLeadError);
      assert.deepEqual(agentLeads.map((lead) => lead.id), [leadIds[0]]);

      const { data: agentProperties, error: agentPropertyError } = await agentA.client
        .from("properties").select("id").in("id", propertyIds);
      assert.ifError(agentPropertyError);
      assert.deepEqual(agentProperties.map((property) => property.id), [propertyA]);

      const { data: followUpId, error: followUpError } = await agentA.client.rpc(
        "record_lead_follow_up",
        { p_lead_id: leadIds[0], p_description: "Confirmed viewing preferences." },
      );
      assert.ifError(followUpError);
      assert.ok(followUpId);

      const { error: forbiddenFollowUpError } = await agentA.client.rpc(
        "record_lead_follow_up",
        { p_lead_id: leadIds[1], p_description: "Should not be allowed." },
      );
      assert.equal(forbiddenFollowUpError?.code, "42501");
      const { data: agentActivity, error: agentActivityError } = await agentA.client
        .from("activity_logs").select("id").eq("id", followUpId);
      assert.ifError(agentActivityError);
      assert.equal(agentActivity.length, 1);

      const { data: anonymousActivity, error: anonymousActivityError } = await createClient(
        url,
        anonKey,
        { auth: { autoRefreshToken: false, persistSession: false } },
      ).from("activity_logs").select("id");
      assert.ok(anonymousActivityError || anonymousActivity?.length === 0);

      const { error: roleRpcError } = await agentA.client.rpc("set_profile_role", {
        p_user_id: agentA.id,
        p_role: "admin",
      });
      assert.ok(roleRpcError, "Agents must not be able to use the role assignment RPC.");

      const { error: profileEditError } = await agentA.client
        .from("profiles").update({ role: "admin" }).eq("id", agentA.id);
      assert.ok(profileEditError, "Profile role must not be writable through the table API.");

      const { data: unauthorizedLeadUpdate, error: unauthorizedLeadError } = await agentA.client
        .from("leads")
        .update({ status: "Closed" })
        .eq("id", leadIds[1])
        .select("id");
      assert.ok(unauthorizedLeadError || unauthorizedLeadUpdate?.length === 0);

      for (const status of [
        "Contacted",
        "Viewing Scheduled",
        "Negotiation",
        "Closed",
        "Lost",
      ]) {
        const { data: updatedLead, error: stageError } = await agentA.client
          .from("leads")
          .update({ status })
          .eq("id", leadIds[0])
          .select("status")
          .single();
        assert.ifError(stageError);
        assert.equal(updatedLead.status, status);
      }

      const { data: adminLeads, error: adminLeadError } = await administrator.client
        .from("leads").select("id");
      assert.ifError(adminLeadError);
      assert.ok(adminLeads.some((lead) => lead.id === leadIds[0]));
      assert.ok(adminLeads.some((lead) => lead.id === leadIds[1]));

      const { error: invalidAssignmentError } = await administrator.client
        .from("leads")
        .update({ assigned_agent_id: administrator.id })
        .eq("id", leadIds[1]);
      assert.equal(invalidAssignmentError?.code, "23514");

      const { error: assignmentError } = await administrator.client
        .from("leads")
        .update({ assigned_agent_id: agentA.id })
        .eq("id", leadIds[1]);
      assert.ifError(assignmentError);
      const { data: assignedLead, error: assignedLeadError } = await service
        .from("leads").select("assigned_agent_id").eq("id", leadIds[1]).single();
      assert.ifError(assignedLeadError);
      assert.equal(assignedLead.assigned_agent_id, agentA.id);
      const { error: reassignBackError } = await administrator.client
        .from("leads").update({ assigned_agent_id: agentB.id }).eq("id", leadIds[1]);
      assert.ifError(reassignBackError);

      const { data: agentMetrics, error: agentMetricsError } =
        await agentA.client.rpc("get_dashboard_metrics");
      assert.ifError(agentMetricsError);
      assert.equal(agentMetrics.publishedPropertyTotal, 1);
      assert.equal(agentMetrics.totalLeads, 1);
      assert.equal(agentMetrics.newLeads, 0);
      assert.equal(agentMetrics.closedLeads, 0);
      assert.equal(agentMetrics.lostLeads, 1);
      assert.equal(agentMetrics.leadsByStage.Lost, 1);
      assert.equal(agentMetrics.leadsByAgent.length, 1);
      assert.equal(agentMetrics.leadsByAgent[0].total, 1);
      assert.equal(agentMetrics.leadsByAgent[0].lost, 1);
      assert.ok(agentMetrics.recentActivity.length > 0);

      const { data: adminMetrics, error: adminMetricsError } =
        await administrator.client.rpc("get_dashboard_metrics");
      assert.ifError(adminMetricsError);
      assert.equal(adminMetrics.totalLeads, metricsBefore.totalLeads + 2);
      assert.equal(
        Object.values(adminMetrics.leadsByStage).reduce((sum, total) => sum + total, 0),
        adminMetrics.totalLeads,
      );
      assert.ok(adminMetrics.leadsByAgent.some((agent) => agent.id === agentA.id && agent.lost === 1));
      assert.ok(adminMetrics.leadsByAgent.some((agent) => agent.id === agentB.id && agent.total === 1));
      assert.ok(
        adminMetrics.recentActivity.filter((activity) => activity.lead_id === leadIds[0]
          && activity.action === "lead.stage_changed").length >= 5,
      );

      if (existingAdminCount === 0) {
        const { error: lastAdminError } = await administrator.client.rpc("set_profile_role", {
          p_user_id: administrator.id,
          p_role: "agent",
        });
        assert.equal(lastAdminError?.code, "23514");
      }

      const { data: verifiedRole, error: verifyRoleError } = await service
        .from("profiles").select("role").eq("id", agentA.id).single();
      assert.ifError(verifyRoleError);
      assert.equal(verifiedRole.role, "agent");
    } finally {
      if (leadIds.length) {
        await service.from("activity_logs").delete().in("lead_id", leadIds);
        const { error } = await service.from("leads").delete().in("id", leadIds);
        assert.ifError(error);
      }
      if (propertyIds.length) {
        await service.from("activity_logs").delete().in("property_id", propertyIds);
        const { error } = await service.from("properties").delete().in("id", propertyIds);
        assert.ifError(error);
      }
      for (const userId of users) {
        const { error } = await service.auth.admin.deleteUser(userId);
        assert.ifError(error);
      }
    }
  },
);
