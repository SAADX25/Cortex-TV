/* ─────────────────────────────────────────────────
   Atmosphere.tsx – Fresnel-based glow halo
   Sun-aware: brighter on the lit limb.
   ───────────────────────────────────────────────── */

import { useMemo } from "react";
import * as THREE from "three";
import {
  atmosphereVertexShader,
  atmosphereFragmentShader,
} from "../shaders/atmosphereShader";

interface AtmosphereProps {
  scale?: number;
  glowColor?: string;
  intensity?: number;
  power?: number;
  sunDirection?: [number, number, number];
}

export default function Atmosphere({
  scale = 1.14,
  glowColor = "#4db8ff",
  intensity = 0.65,
  power = 3.5,
  sunDirection = [5, 3, 5],
}: AtmosphereProps) {
  const uniforms = useMemo(
    () => ({
      uGlowColor: { value: new THREE.Color(glowColor) },
      uIntensity: { value: intensity },
      uPower: { value: power },
      uSunDirection: {
        value: new THREE.Vector3(...sunDirection).normalize(),
      },
    }),
    [glowColor, intensity, power, sunDirection]
  );

  return (
    <mesh scale={[scale, scale, scale]}>
      <sphereGeometry args={[1, 64, 32]} />
      <shaderMaterial
        vertexShader={atmosphereVertexShader}
        fragmentShader={atmosphereFragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
