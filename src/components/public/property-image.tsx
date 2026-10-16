"use client";

import Image from "next/image";
import { useState } from "react";

const fallbackImage = "/property-placeholder.svg";

function getSafeImageSource(src?: string | null) {
  if (!src) return fallbackImage;
  if (src.startsWith("/") && !src.startsWith("//")) return src;

  try {
    const parsed = new URL(src);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? src
      : fallbackImage;
  } catch {
    return fallbackImage;
  }
}

export function PropertyImage({
  src,
  alt,
  priority = false,
  className = "",
}: {
  src?: string | null;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  const [imageSrc, setImageSrc] = useState(() => getSafeImageSource(src));

  return (
    <Image
      src={imageSrc}
      alt={alt}
      fill
      sizes="(max-width: 620px) 100vw, (max-width: 1024px) 50vw, 33vw"
      unoptimized
      priority={priority}
      className={className}
      onError={() => setImageSrc(fallbackImage)}
    />
  );
}
