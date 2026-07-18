/* ------------------------------------------------------------------------------------------------------------------------------------------
   Loading.tsx --- Fallback loading indicator
   Displayed while textures and assets load.
   ------------------------------------------------------------------------------------------------------------------------------------------ */

import { Html } from "@react-three/drei";

export default function Loading() {
  return (
    <Html center>
      <div style={{
        color: "#00ffff",
        fontSize: "24px",
        fontWeight: "bold",
        textAlign: "center",
        textShadow: "0 0 10px rgba(0, 255, 255, 0.8)",
      }}>
        Loading Earth Textures...
      </div>
    </Html>
  );
}
