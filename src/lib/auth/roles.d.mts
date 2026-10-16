import type { UserRole } from "../supabase/database.types";

export function dashboardPathForRole(role: UserRole | null | undefined): string;
export function hasRequiredRole(role: UserRole | null | undefined, requiredRole: UserRole): boolean;
