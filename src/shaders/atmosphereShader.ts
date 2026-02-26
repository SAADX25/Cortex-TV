/* ─────────────────────────────────────────────────
   Atmospheric Fresnel glow shader
   – Additive-blend halo around the globe edges.
   – Sun-aware: glow is brighter on the sun-lit limb,
     dimmer on the dark side for realism.
   ───────────────────────────────────────────────── */

export const atmosphereVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldNormal;

  void main() {
    vNormal      = normalize(normalMatrix * normal);
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPosition.xyz);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const atmosphereFragmentShader = /* glsl */ `
  uniform vec3  uGlowColor;
  uniform float uIntensity;
  uniform float uPower;
  uniform vec3  uSunDirection;

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldNormal;

  void main() {
    float fresnel = 1.0 - dot(vNormal, vViewDir);
    fresnel = pow(fresnel, uPower) * uIntensity;

    // Sun-aware brightness: brighter on the sun-lit limb
    float sunFactor = dot(normalize(vWorldNormal), normalize(uSunDirection));
    sunFactor = 0.4 + 0.6 * smoothstep(-0.3, 0.6, sunFactor);

    float alpha = fresnel * sunFactor;

    gl_FragColor = vec4(uGlowColor, alpha);
  }
`;
