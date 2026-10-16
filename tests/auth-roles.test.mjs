import assert from "node:assert/strict";
import test from "node:test";
import {
  dashboardPathForRole,
  hasRequiredRole,
} from "../src/lib/auth/roles.mjs";

test("sign-in destination is selected from the trusted profile role", () => {
  assert.equal(dashboardPathForRole("admin"), "/admin");
  assert.equal(dashboardPathForRole("agent"), "/agent");
  assert.equal(dashboardPathForRole(null), "/access-denied");
  assert.equal(dashboardPathForRole("client"), "/access-denied");
});

test("role matching does not grant administrator access to agents or unknown roles", () => {
  assert.equal(hasRequiredRole("admin", "admin"), true);
  assert.equal(hasRequiredRole("agent", "admin"), false);
  assert.equal(hasRequiredRole(null, "agent"), false);
});
