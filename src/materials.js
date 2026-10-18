/**
 * SOLARIS — GLSL atelier
 * Every material is a custom shader so light, rim, atmosphere and the final
 * filmic grade form one coherent image. All color math is linear until the
 * final pass, which applies ACES and sRGB encoding.
 */
import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  FrontSide,
  NormalBlending,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';

const NOISE = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p = rot * p * 2.03;
      a *= 0.5;
    }
    return v;
  }
`;

export function makeSharedUniforms() {
  return {
    uSunPos: { value: new Vector3(0, 0, 0) },
    uSunColor: { value: new Color('#fff0d2') },
    uSunIntensity: { value: 1.9 },
    uAmbient: { value: new Color().setRGB(0.016, 0.022, 0.042) },
    uTime: { value: 0 },
  };
}

const WORLD_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWPos;
  varying vec3 vWNormal;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWPos = wp.xyz;
    vWNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

/* ------------------------------------------------------------------ planets */

export function createPlanetMaterial(opts, shared) {
  const {
    map, nightMap, specularMap,
    tint = '#ffffff', roughness = 0.85,
    atmosphereColor = '#ffffff', atmosphereStrength = 0,
    isGasGiant = false, seed = 0,
  } = opts;

  return new ShaderMaterial({
    uniforms: {
      ...shared,
      uMap: { value: map ?? null },
      uNightMap: { value: nightMap ?? null },
      uSpecularMap: { value: specularMap ?? null },
      uHasNight: { value: nightMap ? 1 : 0 },
      uHasSpecular: { value: specularMap ? 1 : 0 },
      uTint: { value: new Color(tint) },
      uRoughness: { value: roughness },
      uAtmoColor: { value: new Color(atmosphereColor) },
      uAtmoStrength: { value: atmosphereStrength },
      uSeed: { value: seed },
      uGasGiant: { value: isGasGiant ? 1 : 0 },
    },
    vertexShader: WORLD_VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform sampler2D uNightMap;
      uniform sampler2D uSpecularMap;
      uniform float uHasNight;
      uniform float uHasSpecular;
      uniform vec3 uSunPos;
      uniform vec3 uSunColor;
      uniform float uSunIntensity;
      uniform vec3 uAmbient;
      uniform vec3 uTint;
      uniform float uRoughness;
      uniform vec3 uAtmoColor;
      uniform float uAtmoStrength;
      uniform float uSeed;
      uniform float uGasGiant;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWPos;
      varying vec3 vWNormal;

      ${NOISE}

      void main() {
        vec3 N = normalize(vWNormal);
        vec3 V = normalize(cameraPosition - vWPos);
        vec3 L = normalize(uSunPos - vWPos);
        float ndl = dot(N, L);
        float ndv = clamp(dot(N, V), 0.0, 1.0);

        // a little atmospheric wobble on the texture coordinates for gas giants
        vec2 uv = vUv;
        if (uGasGiant > 0.5) {
          float wob = fbm(vec2(vUv.x * 6.0 + uSeed, vUv.y * 18.0 + uTime * 0.006));
          uv.x += (wob - 0.5) * 0.0022;
          uv.y += sin(vUv.x * 40.0 + uTime * 0.008 + uSeed) * 0.0008;
        }

        vec3 albedo = texture2D(uMap, uv).rgb;
        albedo *= uTint;

        // soft wrap terminator — sunlight scatters around the limb
        float lambert = max(ndl, 0.0);
        float scatter = smoothstep(-0.16, 0.62, ndl) * 0.64 + lambert * 0.36;

        vec3 sun = uSunColor * uSunIntensity;
        vec3 col = albedo * sun * scatter;

        // shadow-side ambient: a cold, faint fill
        col += albedo * uAmbient * (0.45 + 0.8 * ndv);

        // broad rim light (atmosphere on the lit limb)
        float rim = pow(1.0 - ndv, 3.4) * smoothstep(-0.2, 0.7, ndl);
        col += uAtmoColor * rim * uAtmoStrength * 0.42;

        // city lights
        if (uHasNight > 0.5) {
          vec3 night = texture2D(uNightMap, vUv).rgb;
          float lamps = max(max(night.r, night.g), night.b);
          float nightMask = smoothstep(0.08, -0.34, ndl);
          float flicker = 0.94 + 0.06 * sin(uTime * 2.3 + vUv.x * 90.0 + vUv.y * 40.0);
          col += vec3(1.0, 0.55, 0.22) * pow(lamps, 1.4) * 1.55 * nightMask * flicker;
        }

        // ocean glint
        if (uHasSpecular > 0.5) {
          float ocean = texture2D(uSpecularMap, vUv).r;
          vec3 H = normalize(L + V);
          float spec = pow(max(dot(N, H), 0.0), 90.0) * ocean;
          col += uSunColor * spec * 1.35 * smoothstep(-0.02, 0.30, ndl);
        }

        // limb darkening for the sphere read
        col *= 0.76 + 0.24 * pow(ndv, 0.5);

        // faint atmospheric scattering across the disc, strongest at the limb
        float haze = pow(1.0 - ndv, 2.2) * smoothstep(-0.25, 0.55, ndl);
        col += uAtmoColor * haze * uAtmoStrength * 0.16;

        // extremely subtle film grain-like microbump on gas giants
        if (uGasGiant > 0.5) {
          float bandNoise = fbm(vec2(vUv.x * 3.0, vUv.y * 90.0)) - 0.5;
          col *= 1.0 + bandNoise * 0.035;
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export function createCloudMaterial(map, shared) {
  return new ShaderMaterial({
    uniforms: {
      ...shared,
      uMap: { value: map },
      uOpacity: { value: 0.92 },
    },
    vertexShader: WORLD_VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uOpacity;
      uniform vec3 uSunPos;
      uniform vec3 uSunColor;
      uniform float uSunIntensity;
      uniform vec3 uAmbient;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWPos;
      varying vec3 vWNormal;
      void main() {
        vec3 N = normalize(vWNormal);
        vec3 L = normalize(uSunPos - vWPos);
        float ndl = dot(N, L);
        vec2 uv = vUv + vec2(uTime * 0.0011, 0.0);
        float clouds = texture2D(uMap, uv).r;
        float light = smoothstep(-0.12, 0.55, ndl);
        vec3 col = vec3(0.94, 0.965, 1.0) * (uSunColor * uSunIntensity * (0.06 + 1.02 * light) + uAmbient * 2.2);
        float alpha = smoothstep(0.06, 0.62, clouds) * uOpacity * (0.22 + 0.78 * light);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: FrontSide,
  });
}

export function createAtmosphereMaterial(color, strength, shared, variant = 1.0) {
  return new ShaderMaterial({
    uniforms: {
      ...shared,
      uColor: { value: new Color(color) },
      uStrength: { value: strength },
      uVariant: { value: variant },
    },
    vertexShader: WORLD_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      uniform float uVariant;
      uniform vec3 uSunPos;
      uniform vec3 uSunColor;
      uniform float uSunIntensity;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWPos;
      varying vec3 vWNormal;
      void main() {
        vec3 N = normalize(vWNormal);
        vec3 V = normalize(cameraPosition - vWPos);
        vec3 L = normalize(uSunPos - vWPos);
        float fres = pow(1.0 - abs(dot(N, V)), 3.6);
        float lit = smoothstep(-0.35, 0.55, dot(N, L));
        float forward = pow(max(dot(-V, L), 0.0), 2.0) * 0.18;
        vec3 col = uColor * (fres * (0.22 + 1.5 * lit) + forward) * (0.55 + uStrength);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: FrontSide,
  });
}

/* --------------------------------------------------------------------- sun */

export function createSunMaterial(map, shared) {
  return new ShaderMaterial({
    uniforms: {
      ...shared,
      uMap: { value: map },
      uCoronaColor: { value: new Color('#ff9a3c') },
    },
    vertexShader: WORLD_VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime;
      uniform vec3 uCoronaColor;
      varying vec2 vUv;
      varying vec3 vWPos;
      varying vec3 vWNormal;

      ${NOISE}

      void main() {
        vec3 N = normalize(vWNormal);
        vec3 V = normalize(cameraPosition - vWPos);
        float ndv = clamp(dot(N, V), 0.0, 1.0);

        vec2 p = vUv * vec2(7.0, 4.0);
        float n1 = fbm(p + vec2(uTime * 0.010, uTime * 0.006));
        float n2 = fbm(p * 2.4 - vec2(uTime * 0.014, 0.0));
        vec2 uv = vUv + (n1 - 0.5) * 0.0045;
        vec3 tex = texture2D(uMap, uv).rgb;

        // At grazing angles the limb must be fire, never a stray texture mip.
        float limbWarm = smoothstep(0.58, 0.03, ndv);
        tex = mix(tex, vec3(0.95, 0.30, 0.055), limbWarm * 0.72);

        // molten gold, with darker granules
        vec3 col = tex * vec3(1.58, 0.84, 0.31);
        col *= 0.77 + 0.47 * n2;
        col += uCoronaColor * pow(n2, 2.6) * 0.22;

        // per-channel limb darkening: the edge reddens before it fades
        vec3 limb = 1.0 - vec3(0.40, 0.54, 0.70) * (1.0 - ndv);
        col *= limb;
        float edge = pow(1.0 - ndv, 3.6);
        col += vec3(1.0, 0.30, 0.04) * edge * 0.72;
        col += vec3(1.0, 0.80, 0.52) * pow(ndv, 2.2) * 0.10;

        gl_FragColor = vec4(col * 1.08, 1.0);
      }
    `,
  });
}

export function createCoronaMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new Color().setRGB(1.0, 0.46, 0.14) },
      uIntensity: { value: 0.44 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec2 vUv;

      ${NOISE}

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float ang = atan(p.y, p.x);

        float n = fbm(vec2(ang * 3.4 + uTime * 0.035, r * 5.0 - uTime * 0.06));
        float n2 = fbm(vec2(ang * 9.0 - uTime * 0.02, r * 11.0 + 2.0));
        float streamers = 0.45 + 0.9 * n * (0.4 + 0.6 * n2);

        float core = exp(-r * 8.5) * 1.35;
        float halo = exp(-r * 2.9) * 0.22;
        float rays = pow(max(0.0, 1.0 - r), 5.0) * streamers * 0.65;
        float edgeFade = smoothstep(1.0, 0.72, r);
        float a = (core + halo + rays) * edgeFade;

        vec3 col = uColor * a * uIntensity;
        col += vec3(1.0, 0.85, 0.6) * pow(max(0.0, 1.0 - r * 2.4), 3.0) * 0.7;

        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
}

/* ------------------------------------------------------------------- rings */

export function createRingMaterial(map, inner, outer, planetRadius, opts = {}) {
  return new ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uInner: { value: inner },
      uOuter: { value: outer },
      uPlanetRadius: { value: planetRadius },
      uPlanetPos: { value: new Vector3() },
      uSunPos: { value: new Vector3() },
      uSunColor: { value: new Color('#fff0d2') },
      uSunIntensity: { value: 2.2 },
      uOpacity: { value: opts.opacity ?? 1.0 },
      uTint: { value: new Color(opts.tint ?? '#f0e0c0') },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uInner;
      uniform float uOuter;
      varying vec2 vUv;
      varying vec3 vWPos;
      varying float vRing;
      void main() {
        vUv = uv;
        vRing = (length(position.xy) - uInner) / (uOuter - uInner);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uPlanetPos;
      uniform vec3 uSunPos;
      uniform vec3 uSunColor;
      uniform float uSunIntensity;
      uniform float uPlanetRadius;
      uniform float uOpacity;
      uniform vec3 uTint;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWPos;
      varying float vRing;

      ${NOISE}

      void main() {
        float r = clamp(vRing, 0.0, 1.0);
        vec4 tex = texture2D(uMap, vec2(r, 0.5));
        if (tex.a < 0.008) discard;

        vec3 sunDir = normalize(uSunPos - uPlanetPos);
        vec3 rel = vWPos - uPlanetPos;
        float away = -dot(rel, sunDir);
        vec3 perpVec = rel - sunDir * dot(rel, sunDir);
        float perp = length(perpVec);
        float inShadow = smoothstep(-0.02, 0.06, away) *
                         (1.0 - smoothstep(uPlanetRadius * 0.92, uPlanetRadius * 1.12, perp));
        float shadow = mix(1.0, 0.16, inShadow);

        // dust bands catch light differently across their width
        float grain = fbm(vec2(r * 240.0, vUv.y * 6.0)) - 0.5;
        float light = 0.88 + grain * 0.1;

        vec3 V = normalize(cameraPosition - vWPos);
        float forward = pow(max(dot(-V, sunDir), 0.0), 2.0) * 0.7;

        vec3 col = tex.rgb * uTint * (uSunColor * uSunIntensity * light * shadow * 0.52 + forward * uSunColor * 0.35);
        float alpha = tex.a * uOpacity * (0.78 + 0.22 * shadow);
        float edge = smoothstep(0.0, 0.025, r) * smoothstep(1.0, 0.965, r);
        gl_FragColor = vec4(col, alpha * edge);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: NormalBlending,
    toneMapped: false,
  });
}

/* ------------------------------------------------------------ belt + rocks */

export function createAsteroidMaterial(shared) {
  return new ShaderMaterial({
    uniforms: { ...shared },
    vertexShader: /* glsl */ `
      attribute float aOrbit;
      attribute float aAngle;
      attribute float aSpeed;
      attribute float aY;
      attribute float aSize;
      attribute float aSpin;
      attribute float aIncl;
      attribute vec3 aStretch;
      attribute vec3 aColor;

      uniform float uTime;

      varying vec3 vWPos;
      varying vec3 vWNormal;
      varying vec3 vColor;
      varying float vRim;

      void main() {
        float ang = aAngle + uTime * aSpeed;
        vec3 center = vec3(
          cos(ang) * aOrbit,
          aY + sin(ang + aSpin) * aOrbit * sin(aIncl) * 0.055,
          sin(ang) * aOrbit
        );

        vec3 p = position * aSize * aStretch;
        vec3 n = normal * aStretch;

        float ca = cos(aSpin + uTime * aSpeed * 3.0);
        float sa = sin(aSpin + uTime * aSpeed * 3.0);
        p = vec3(ca * p.x - sa * p.z, p.y, sa * p.x + ca * p.z);
        n = vec3(ca * n.x - sa * n.z, n.y, sa * n.x + ca * n.z);

        float cb = cos(aSpin * 2.7);
        float sb = sin(aSpin * 2.7);
        p = vec3(p.x, cb * p.y - sb * p.z, sb * p.y + cb * p.z);
        n = vec3(n.x, cb * n.y - sb * n.z, sb * n.y + cb * n.z);

        // Rocks very close to the camera are visual noise, not drama: shrink them away.
        float camDistance = length(cameraPosition - center);
        float nearFade = smoothstep(16.0, 70.0, camDistance);
        p *= nearFade;

        vec4 wp = modelMatrix * vec4(center + p, 1.0);
        vWPos = wp.xyz;
        vWNormal = normalize(mat3(modelMatrix) * n);
        vColor = aColor;
        vRim = aIncl;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunPos;
      uniform vec3 uSunColor;
      uniform float uSunIntensity;
      uniform vec3 uAmbient;
      uniform float uTime;
      varying vec3 vWPos;
      varying vec3 vWNormal;
      varying vec3 vColor;

      ${NOISE}

      void main() {
        vec3 N = normalize(vWNormal);
        vec3 V = normalize(cameraPosition - vWPos);
        vec3 L = normalize(uSunPos - vWPos);
        float ndl = dot(N, L);
        float diff = smoothstep(-0.2, 0.55, ndl);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        float grain = hash21(floor(vWPos.xz * 18.0 + vWPos.y * 9.0));
        vec3 col = vColor * (uAmbient * 2.4 + uSunColor * uSunIntensity * (0.16 + diff * 0.72));
        col *= 0.78 + grain * 0.44;
        col += vColor * fres * 0.18;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/* --------------------------------------------------------------- star field */

export function createStarMaterial(pixelRatio) {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uOpacity: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aPhase;
      attribute vec3 aColor;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.86 + 0.14 * sin(uTime * 0.8 + aPhase);
        vTwinkle = tw;
        vColor = aColor;
        gl_PointSize = aSize * uPixelRatio * (0.93 + 0.10 * tw);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.02, d);
        float halo = exp(-d * 10.0) * 0.55;
        float a = (core * core + halo * 0.5) * uOpacity;
        vec3 col = vColor * (0.62 + 0.65 * vTwinkle);
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

/* -------------------------------------------------------------------- dust */

export function createDustMaterial(range, color, opacity = 0.5, speedScale = 1) {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new Color(color) },
      uOpacity: { value: opacity },
      uSpeed: { value: speedScale },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    },
    vertexShader: /* glsl */ `
      attribute float aRadius;
      attribute float aAngle;
      attribute float aSpeed;
      attribute float aY;
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uSpeed;
      uniform float uPixelRatio;
      varying float vAlpha;
      void main() {
        float ang = aAngle + uTime * aSpeed * uSpeed;
        vec3 p = vec3(cos(ang) * aRadius, aY, sin(ang) * aRadius);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 0.5 + aPhase));
        gl_PointSize = aSize * uPixelRatio;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.0, d) * uOpacity * vAlpha;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

/* ------------------------------------------------------------------ galaxy */



/* ------------------------------------------------------------------- sky */

export function createNebulaMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0.78 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      varying vec3 vDir;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }
      float noise3(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
                      mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y);
        float b = mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                      mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y);
        return mix(a, b, f.z);
      }
      float fbm3(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
          v += a * noise3(p);
          p = p * 2.03 + vec3(9.2, 4.7, 2.1);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 d = normalize(vDir);
        // the galactic plane is the local equator; the sky group is tilted.
        float lat = d.y;
        float band = exp(-pow(lat / 0.215, 2.0));
        float broad = fbm3(d * 3.4 + vec3(1.7, 0.4, 2.8) + vec3(0.0, 0.0, uTime * 0.0025));
        float fine = fbm3(d * 11.0 + vec3(4.2, 1.1, 0.3) + vec3(uTime * 0.0018));
        float dust = smoothstep(0.40, 0.72, broad);
        float lanes = smoothstep(0.55, 0.78, fine) * band;

        vec3 deep = vec3(0.0022, 0.0032, 0.0080);
        vec3 violet = vec3(0.028, 0.024, 0.054);
        vec3 warm = vec3(0.085, 0.052, 0.028);
        vec3 coreDir = normalize(vec3(-0.78, 0.06, -0.62));
        float core = pow(max(dot(d, coreDir), 0.0), 10.0);

        vec3 col = deep;
        col += band * violet * (0.22 + 0.75 * broad) * (0.68 + 0.32 * fine);
        col += band * warm * core * 0.5;
        col += band * band * vec3(0.016, 0.014, 0.028) * fine;
        col *= 1.0 - lanes * 0.42;
        col += vec3(0.0018, 0.0022, 0.0045) * (0.35 + 0.65 * fine);
        col *= uIntensity;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: BackSide,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
}

/* ------------------------------------------------------------ final grading */

export const FinalGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new Vector2(1, 1) },
    uSunUV: { value: new Vector2(0.5, 0.5) },
    uSunVis: { value: 0 },
    uExposure: { value: 0.98 },
    uIntro: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec2 uSunUV;
    uniform float uSunVis;
    uniform float uExposure;
    uniform float uIntro;
    varying vec2 vUv;

    vec3 aces(vec3 x) {
      const float a = 2.51;
      const float b = 0.03;
      const float c = 2.43;
      const float d = 0.59;
      const float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }
    vec3 toSRGB(vec3 c) {
      return mix(1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, c * 12.92, step(c, vec3(0.0031308)));
    }

    void main() {
      vec2 uv = vUv;
      vec2 centered = uv - 0.5;
      float r2 = dot(centered, centered);

      // gentle lateral chromatic aberration, strongest at edges
      vec2 ca = centered * r2 * 0.0011;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - ca).b;

      col *= uExposure;

      // anamorphic warmth around the sun
      vec2 sd = uv - uSunUV;
      sd.y *= 1.35;
      float veil = exp(-length(sd) * 8.0) * 0.095
                 + exp(-abs(sd.y) * 48.0) * exp(-abs(sd.x) * 2.8) * 0.045;
      col += vec3(1.0, 0.60, 0.28) * veil * uSunVis;

      // filmic opacities in the shadow toe
      col = mix(col, col * vec3(0.90, 0.96, 1.12), 0.18);

      col = aces(col);

      // subtle film print contrast + saturation
      vec3 luma = vec3(dot(col, vec3(0.2126, 0.7152, 0.0722)));
      col = mix(luma, col, 1.07);
      col = pow(col, vec3(0.985));

      // optical vignette
      float vig = smoothstep(0.98, 0.24, length(centered * vec2(1.0, 0.82)));
      col *= mix(0.52, 1.0, vig);

      col = toSRGB(clamp(col, 0.0, 1.0));

      // fine grain
      float n = fract(sin(dot(uv * uResolution + uTime * 60.0, vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * 0.018;

      // cool shadow lift
      col = mix(col, col * vec3(0.985, 0.992, 1.025) + vec3(0.003, 0.004, 0.008), 0.22);

      // 8-bit dithering, hidden under the grain, keeps deep skies from banding
      float dither = fract(sin(dot(uv * uResolution, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      col += dither / 255.0;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
