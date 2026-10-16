export function dashboardPathForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "agent") return "/agent";
  return "/access-denied";
}

export function hasRequiredRole(role, requiredRole) {
  return role === requiredRole;
}
