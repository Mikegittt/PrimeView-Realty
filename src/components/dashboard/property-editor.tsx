"use client";

import { savePropertyAction } from "@/app/dashboard-actions";
import type { Property, UserRole } from "@/lib/supabase/database.types";
import type { FormEvent } from "react";

type AgentOption = { id: string; full_name: string; role: UserRole };

export function PropertyEditor({
  property,
  agents,
  role,
  userId,
}: {
  property?: Property;
  agents: AgentOption[];
  role: UserRole;
  userId: string;
}) {
  const isEditing = Boolean(property);

  function confirmArchive(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const values = new FormData(form);
    if (property && property.status !== "archived" && values.get("status") === "archived") {
      if (!window.confirm("Archive this listing? It will no longer appear in public property searches.")) {
        event.preventDefault();
      }
    }
  }

  return (
    <form className="property-editor" action={savePropertyAction} onSubmit={confirmArchive}>
      <input type="hidden" name="propertyId" value={property?.id ?? ""} />
      <label className="form-field">
        <span>Title</span>
        <input name="title" maxLength={200} defaultValue={property?.title ?? ""} required />
      </label>
      <label className="form-field">
        <span>Location</span>
        <input name="location" maxLength={300} defaultValue={property?.location ?? ""} required />
      </label>
      <label className="form-field">
        <span>Description</span>
        <textarea name="description" rows={4} maxLength={10000} defaultValue={property?.description ?? ""} />
      </label>
      <div className="property-editor__grid">
        <label className="form-field">
          <span>Price (NGN)</span>
          <input name="price" type="number" min="0" max="999999999999.99" step="0.01" defaultValue={property?.price ?? ""} required />
        </label>
        <label className="form-field">
          <span>Purpose</span>
          <select name="purpose" defaultValue={property?.purpose ?? "sale"}>
            <option value="sale">Sale</option>
            <option value="rent">Rent</option>
          </select>
        </label>
        <label className="form-field">
          <span>Property type</span>
          <input name="propertyType" maxLength={100} defaultValue={property?.property_type ?? ""} required />
        </label>
        <label className="form-field">
          <span>Bedrooms</span>
          <input name="bedrooms" type="number" min="0" step="1" defaultValue={property?.bedrooms ?? ""} />
        </label>
        <label className="form-field">
          <span>Bathrooms</span>
          <input name="bathrooms" type="number" min="0" step="1" defaultValue={property?.bathrooms ?? ""} />
        </label>
        <label className="form-field">
          <span>Area (m²)</span>
          <input name="area" type="number" min="0.01" step="0.01" defaultValue={property?.area ?? ""} />
        </label>
      </div>
      <label className="form-field">
        <span>Image URLs (one HTTPS URL per line, up to 30)</span>
        <textarea name="imageUrls" rows={3} maxLength={6000} defaultValue={property?.image_urls.join("\n") ?? ""} />
      </label>
      <div className="property-editor__grid">
        <label className="form-field">
          <span>Publication status</span>
          <select name="status" defaultValue={property?.status ?? "draft"}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        {role === "admin" ? (
          <label className="form-field">
            <span>Assigned agent</span>
            <select name="assignedAgentId" defaultValue={property?.assigned_agent_id ?? ""}>
              <option value="">Unassigned</option>
              {agents.filter((agent) => agent.role === "agent").map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.full_name || "Unnamed agent"}</option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="assignedAgentId" value={userId} />
        )}
      </div>
      <button className="button button--navy" type="submit">
        {isEditing ? "Save property changes" : "Create property"}
      </button>
    </form>
  );
}
