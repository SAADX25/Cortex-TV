import { useState } from "react";
import type { ImgHTMLAttributes } from "react";

/** A failed source is never retried recursively; source changes reset the fallback. */
export default function SafeImage({
  src,
  alt = "",
  className = "",
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const [failedSource, setFailedSource] = useState<string>();

  if (!src || failedSource === src) {
    return (
      <span
        className={`image-fallback ${className}`}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={!alt}
      >
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <rect x="6" y="10" width="28" height="22" rx="6" stroke="currentColor" strokeWidth="1.5" />
          <path d="m15 5 5 5 5-5M17 17l9 4-9 5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  return (
    <img
      {...props}
      src={src}
      alt={alt}
      className={className}
      decoding="async"
      onError={() => setFailedSource(src)}
    />
  );
}
