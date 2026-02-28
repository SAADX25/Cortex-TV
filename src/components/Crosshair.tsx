/* ──────────────────────────────────────────────
   Crosshair.tsx – Minimal red crosshair (+) for
   "Sniper Mode" country targeting on the Globe.
   ────────────────────────────────────────────── */

import { memo } from "react";

interface CrosshairProps {
  /** Brief pulse animation on successful lock */
  active?: boolean;
  /** Name of the country currently under the crosshair */
  targetName?: string | null;
}

function CrosshairInner({ active = false, targetName }: CrosshairProps) {
  return (
    <div className="fixed top-1/2 left-1/2 z-50 pointer-events-none -translate-x-1/2 -translate-y-1/2">
      {/* ── Live target label ── */}
      {targetName && (
        <div
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap"
          style={{
            bottom: "calc(100% + 10px)",
            color: "#00ffff",
            textShadow: "0 0 6px rgba(0,255,255,0.8)",
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 600,
            padding: "3px 10px",
            background: "rgba(0,0,0,0.7)",
            border: "1px solid rgba(0,255,255,0.35)",
            borderRadius: 4,
          }}
        >
          {targetName}
        </div>
      )}

      {/* ── Red crosshair (+) ── */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        className={`text-red-600 transition-transform duration-150 ${
          active ? "scale-125" : "scale-100"
        }`}
      >
        {/* Vertical bar */}
        <line
          x1="12" y1="2"
          x2="12" y2="22"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Horizontal bar */}
        <line
          x1="2" y1="12"
          x2="22" y2="12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export default memo(CrosshairInner);
