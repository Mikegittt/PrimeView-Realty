import Link from "next/link";
import type { Property } from "@/lib/supabase/database.types";
import { PropertyImage } from "./property-image";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export function formatPropertyPrice(price: number, purpose: Property["purpose"]) {
  return `${naira.format(price)}${purpose === "rent" ? " / year" : ""}`;
}

export function PropertyCard({ property }: { property: Property }) {
  return (
    <article className="property-card">
      <Link
        className="property-card__image"
        href={`/properties/${property.id}`}
        aria-label={`View details for ${property.title}`}
      >
        <PropertyImage
          src={property.image_urls[0]}
          alt={`${property.property_type} in ${property.location}`}
        />
        <span className="property-card__badge">
          {property.purpose === "rent" ? "For rent" : "For sale"}
        </span>
      </Link>
      <div className="property-card__body">
        <p className="property-card__location">{property.location}</p>
        <h3>
          <Link href={`/properties/${property.id}`}>{property.title}</Link>
        </h3>
        <p className="property-card__price">
          {formatPropertyPrice(property.price, property.purpose)}
        </p>
        <div className="property-card__meta">
          <span>{property.property_type}</span>
          {property.bedrooms !== null && <span>{property.bedrooms} beds</span>}
          {property.bathrooms !== null && <span>{property.bathrooms} baths</span>}
          {property.area !== null && <span>{property.area} area</span>}
        </div>
        <Link className="property-card__link" href={`/properties/${property.id}`}>
          View details <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
