export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "agent";
export type PropertyPurpose = "sale" | "rent";
export type PropertyStatus = "draft" | "published" | "archived";
export type LeadStatus =
  | "New"
  | "Contacted"
  | "Viewing Scheduled"
  | "Negotiation"
  | "Closed"
  | "Lost";

export type DashboardMetrics = {
  publishedPropertyTotal: number;
  totalLeads: number;
  newLeads: number;
  closedLeads: number;
  lostLeads: number;
  leadsByStage: Record<LeadStatus, number>;
  leadsByAgent: Array<{
    id: string | null;
    name: string;
    total: number;
    closed: number;
    lost: number;
  }>;
  recentActivity: Array<{
    id: string;
    lead_id: string | null;
    property_id: string | null;
    actor_user_id: string | null;
    actor_name: string | null;
    action: string;
    description: string;
    change_details: Json;
    created_at: string;
  }>;
};

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
  created_at: string;
};

export type Property = {
  id: string;
  title: string;
  description: string;
  location: string;
  price: number;
  purpose: PropertyPurpose;
  property_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number | null;
  image_urls: string[];
  status: PropertyStatus;
  assigned_agent_id: string | null;
  created_at: string;
  updated_at: string;
};

type Lead = {
  id: string;
  client_name: string;
  email: string;
  phone: string | null;
  property_id: string | null;
  assigned_agent_id: string | null;
  status: LeadStatus;
  message: string | null;
  created_at: string;
  updated_at: string;
};

type ActivityLog = {
  id: string;
  lead_id: string | null;
  property_id: string | null;
  actor_user_id: string | null;
  action: string;
  description: string;
  change_details: Json;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        Profile,
        Pick<Profile, "id" | "full_name"> & { role?: UserRole },
        Partial<Pick<Profile, "full_name" | "role">>
      >;
      properties: Table<
        Property,
        Omit<Property, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Omit<Property, "id" | "created_at">>
      >;
      leads: Table<
        Lead,
        Omit<Lead, "id" | "status" | "created_at" | "updated_at"> & {
          id?: string;
          status?: LeadStatus;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Omit<Lead, "id" | "created_at">>
      >;
      activity_logs: Table<
        ActivityLog,
        Omit<ActivityLog, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        },
        never
      >;
    };
    Views: Record<string, never>;
    Functions: {
      consume_public_enquiry_quota: {
        Args: { p_ip_hash: string };
        Returns: boolean;
      };
      create_public_enquiry: {
        Args: {
          p_request_id: string;
          p_ip_hash: string;
          p_payload_hash: string;
          p_client_name: string;
          p_email: string;
          p_phone: string;
          p_property_id: string | null;
          p_message: string;
        };
        Returns: {
          lead_id: string | null;
          duplicate: boolean;
          rate_limited: boolean;
        }[];
      };
      set_profile_role: {
        Args: { p_user_id: string; p_role: UserRole };
        Returns: undefined;
      };
      record_lead_follow_up: {
        Args: { p_lead_id: string; p_description: string };
        Returns: string;
      };
      get_dashboard_metrics: {
        Args: Record<string, never>;
        Returns: DashboardMetrics;
      };
    };
    Enums: {
      user_role: UserRole;
      property_purpose: PropertyPurpose;
      property_status: PropertyStatus;
      lead_status: LeadStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
