"use client";

import React, { useState } from "react";

interface ArtworkProps {
  src?: string | null;
  alt: string;
  size?: number;
  swatchColor?: string;
  className?: string;
  isDelisted?: boolean;
}

const SWATCH_PALETTE = [
  "#2E4B3C",
  "#2A2A4A",
  "#3A3A22",
  "#52302A",
  "#1E3A4C",
  "#3D2B4A",
  "#4A3B2A",
  "#2B4A45",
  "#4A2B33",
  "#334A2B",
];

export function getFallbackSwatchColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % SWATCH_PALETTE.length;
  return SWATCH_PALETTE[index];
}

export const Artwork: React.FC<ArtworkProps> = ({
  src,
  alt,
  size = 38,
  swatchColor,
  className = "",
  isDelisted = false,
}) => {
  const [hasError, setHasError] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);

  if (prevSrc !== src) {
    setPrevSrc(src);
    setHasError(false);
  }

  if (isDelisted) {
    return (
      <span
        className={`flex flex-none items-center justify-center rounded-none select-none border border-[#222220] bg-[#121211] text-[#444440] ${className}`}
        style={{ width: `${size}px`, height: `${size}px` }}
        title="Track delisted on Spotify"
        aria-label="Track delisted"
      >
        <span className="text-[10px] font-mono select-none">✕</span>
      </span>
    );
  }

  if (!src || hasError) {
    const bgColor = swatchColor || getFallbackSwatchColor(alt || "artwork");
    return (
      <span
        className={`block flex-none rounded-none select-none ${className}`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: bgColor,
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
