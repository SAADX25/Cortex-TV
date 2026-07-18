/* ------------------------------------------------------------------------------------------------------------------------------------------
   Crosshair.tsx --- High-precision neon blue dot
   for country targeting on the Globe.
   ------------------------------------------------------------------------------------------------------------------------------------------ */

import { memo } from "react";

interface CrosshairProps {
  /** Brief pulse animation on successful lock */
  active?: boolean;
}

function CrosshairInner({ active = false }: CrosshairProps) {
  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center hidden [@media(pointer:coarse)]:flex [will-change:transform]">
      {/* ------ Neon blue precision dot ------ */}
      <div
        className={`rounded-full transition-transform duration-150 ${
          active ? "scale-[1.8]" : "scale-100"
        }`}
        style={{
          width: 7,
          height: 7,
          backgroundColor: "#00d2ff",
          boxShadow:
            "0 0 4px 1px rgba(0,210,255,0.9), " +
            "0 0 10px 3px rgba(0,210,255,0.45), " +
            "0 0 20px 6px rgba(0,210,255,0.15)",
        }}
      />
    </div>
  );
}

export default memo(CrosshairInner);
