"use client";

import React, { useState } from "react";

interface ArtworkProps {
  src?: string | null;
  alt: string;
  size?: number;
  swatchColor?: string;
  className?: string;
}

export const Artwork: React.FC<ArtworkProps> = ({
  src,
  alt,
  size = 38,
  swatchColor,
  className = "",
}) => {
  const [hasError, setHasError] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);

  if (prevSrc !== src) {
    setPrevSrc(src);
    setHasError(false);
  }

  if (!src || hasError) {
    return (
      <span
        className={`block flex-none rounded-none select-none ${className}`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: swatchColor || "#1C1C1A",
        }}
        aria-hidden="true"
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`block object-cover flex-none rounded-none select-none ${className}`}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
};
