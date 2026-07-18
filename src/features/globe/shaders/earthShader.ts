/* ─────────────────────────────────────────────────
   Earth Day / Night custom ShaderMaterial
   – Blends day texture & night (city-lights)
     emissive texture based on sunlight angle.
   – Includes specular highlights on oceans and
     a smooth, wide terminator band.
   ───────────────────────────────────────────────── */

export const earthVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vViewDirection;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    vec4 worldPos  = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;

    // View direction (camera → fragment)
    vViewDirection = normalize(cameraPosition - worldPos.xyz);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const earthFragmentShader = /* glsl */ `
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uSpecMap;       // optional ocean mask (set to day map if unused)
  uniform vec3      uSunDirection;  // normalised world-space sun direction

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vViewDirection;

  void main() {
    vec3 N   = normalize(vNormal);
    vec3 L   = normalize(uSunDirection);
    vec3 V   = normalize(vViewDirection);
    vec3 H   = normalize(L + V);        // half-vector for specular

    // ── Diffuse sun illumination ──────────────────────────
    float NdotL = dot(N, L);

    // Wide soft terminator (-0.2 â€¦ +0.35)
    float dayBlend = smoothstep(-0.2, 0.35, NdotL);

    // ── Texture samples ──────────────────────────────────
    vec4 dayTex   = texture2D(uDayMap,   vUv);
    vec4 nightTex = texture2D(uNightMap, vUv);

    // Day-lit colour with gentle ambient fill
    vec3 litDay = dayTex.rgb * (0.06 + 0.94 * max(NdotL, 0.0));

    // ── Specular highlight (ocean glint) ─────────────────
    float spec = pow(max(dot(N, H), 0.0), 48.0) * 0.35;
    litDay += vec3(spec);

    // ── Night city-lights (emissive glow) ────────────────
    vec3 litNight = nightTex.rgb * 1.5;

    // ── Blend day / night ────────────────────────────────
    vec3 color = mix(litNight, litDay, dayBlend);

    gl_FragColor = vec4(color, 1.0);
  }
`;
