"use client";

import { useEffect, useRef, useState } from "react";
import { FALLBACK_LOGO } from "../lib/constants";

/**
 * ChannelLogo — 3-stage image loader
 *   1. Try loading the URL directly (fastest, works for most logos)
 *   2. On CORP/403/network error → retry through /api/proxy (server-side fetch)
 *   3. If proxy also fails → show the SVG fallback icon
 */
export default function ChannelLogo({
  src,
  alt = "",
  className = "",
}: {
  src?: string;
  alt?: string;
  className?: string;
}) {
  const [imgSrc, setImgSrc] = useState(src || FALLBACK_LOGO);
  const triedProxyRef = useRef(false);

  useEffect(() => {
    triedProxyRef.current = false;
    setImgSrc(src || FALLBACK_LOGO);
  }, [src]);

  const handleError = () => {
    if (!triedProxyRef.current && src && !src.startsWith("data:")) {
      triedProxyRef.current = true;
      setImgSrc(`/api/proxy?url=${encodeURIComponent(src)}`);
    } else {
      setImgSrc(FALLBACK_LOGO);
    }
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
      referrerPolicy="no-referrer"
      loading="lazy"
    />
  );
}
