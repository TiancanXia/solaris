/**
 * SOLARIS — world builder
 * Constructs the solar system, moons, orbital traces, belts and sky.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Line,
  LineBasicMaterial,
  LoadingManager,
  Mesh,
  MeshBasicMaterial,
  NoColorSpace,
  PlaneGeometry,
  Points,
  RepeatWrapping,
  RingGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  LinearFilter,
} from 'three';
import { DISPLAY_DISTANCE, MOONS, PLANETS, SUN } from './data.js';
import {
  moonNode,
  moonPhase,
  moonRelativePosition,
  orbitPoints,
} from './ephemeris.js';
import {
  createAsteroidMaterial,
  createAtmosphereMaterial,
  createCloudMaterial,
  createCoronaMaterial,
  createDustMaterial,
  createNebulaMaterial,
  createPlanetMaterial,
  createRingMaterial,
  createStarMaterial,
  createSunMaterial,
} from './materials.js';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeMoonTexture(spec) {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rnd = mulberry32(spec.seed);

  ctx.fillStyle = spec.base;
  ctx.fillRect(0, 0, w, h);

  // broad albedo provinces
  for (let i = 0; i < 90; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 8 + rnd() * 46;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = rnd() > 0.5 ? spec.accent : spec.dark;
    g.addColorStop(0, c + 'cc');
    g.addColorStop(1, c + '00');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // craters
  for (let i = 0; i < 240; i++) {
    const x = rnd() * w;
    const y = 22 + rnd() * (h - 44);
    const r = 1 + rnd() * 8;
    ctx.globalAlpha = 0.12 + rnd() * 0.25;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = spec.dark;
    ctx.fill();
    ctx.globalAlpha = 0.18 + rnd() * 0.3;
    ctx.beginPath();
    ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.72, 0, TAU);
    ctx.strokeStyle = spec.accent;
    ctx.lineWidth = Math.max(0.5, r * 0.18);
    ctx.stroke();
  }

  // fine grain
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 14;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.anisotropy = 4;
  return tex;
}


function createOrbitLine(points, color, opacity) {
  const geo = new BufferGeometry().setFromPoints(points);
  const mat = new LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const line = new Line(geo, mat);
  line.frustumCulled = false;
  return line;
}

function createMoonOrbitLine(moon, color) {
  const pts = [];
  const node = moonNode(moon);
  for (let i = 0; i <= 128; i++) {
    const ang = (i / 128) * TAU;
    const inc = (moon.inclinationDeg || 0) * DEG;
    const x = Math.cos(ang) * moon.orbitRadius;
    const z = Math.sin(ang) * moon.orbitRadius;
    const y = z * Math.sin(inc);
    const zz = z * Math.cos(inc);
    pts.push(new Vector3(x * Math.cos(node) + zz * Math.sin(node), y, -x * Math.sin(node) + zz * Math.cos(node)));
  }
  return createOrbitLine(pts, color, 0.16);
}

export class SolarWorld {
  constructor(scene, renderer, shared, onProgress, onReady) {
    this.scene = scene;
    this.renderer = renderer;
    this.shared = shared;
    this.bodies = [];
    this.planets = [];
    this.moonRecords = [];
    this.orbitLines = [];
    this.hits = [];
    this.time = 0;

    this.manager = new LoadingManager();
    this.manager.onProgress = (url, loaded, total) => onProgress?.(loaded / Math.max(total, 1));
    this.manager.onLoad = () => setTimeout(() => onReady?.(), 250);
    this.manager.onError = (url) => console.warn('[SOLARIS] texture failed:', url);

    this.loader = new TextureLoader(this.manager);
    this.maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    this.texCache = new Map();

    this.sphere = new SphereGeometry(1, 128, 72);
    this.hitGeo = new SphereGeometry(1, 20, 14);

    this.buildSky();
    this.buildSun();
    this.buildPlanets();
    this.buildBelts();
    this.buildStarField();
  }

  texture(url, { srgb = true, wrap = RepeatWrapping, clamp = false } = {}) {
    const cacheKey = `${url}|${srgb}|${wrap}`;
    if (this.texCache.has(cacheKey)) return this.texCache.get(cacheKey);
    const tex = this.loader.load(url);
    tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
    tex.wrapS = wrap;
    tex.wrapT = ClampToEdgeWrapping;
    tex.anisotropy = this.maxAniso;
    tex.generateMipmaps = true;
    tex.minFilter = 1008; // LinearMipmapLinearFilter
    if (clamp) tex.wrapS = ClampToEdgeWrapping;
    this.texCache.set(cacheKey, tex);
    return tex;
  }

  buildSky() {
    this.skyGroup = new Group();
    this.skyGroup.rotation.set(0.42, 0.32, 0.78);
    this.scene.add(this.skyGroup);

    // A procedural galactic dust band. No photographs, no cube seams.
    const sphere = new Mesh(
      new SphereGeometry(9000, 64, 40),
      createNebulaMaterial()
    );
    sphere.renderOrder = -1000;
    sphere.frustumCulled = false;
    this.skyGroup.add(sphere);
    this.nebula = sphere;
    this.milkyWay = sphere;
    this.scene.background = new Color('#030409');
  }

  buildSun() {
    const pivot = new Group();
    this.scene.add(pivot);

    const sunTex = this.texture(SUN.map);
    // The photosphere is a limelight surface: mip filtering at grazing angles
    // can produce driver-level color ghosts, so the sun samples its base level.
    sunTex.generateMipmaps = false;
    sunTex.minFilter = LinearFilter;
    sunTex.anisotropy = 1;
    const mat = createSunMaterial(sunTex, this.shared);
    const mesh = new Mesh(new SphereGeometry(1, 160, 96), mat);
    mesh.scale.setScalar(SUN.displayRadius);
    mesh.rotation.z = 0.1;
    pivot.add(mesh);

    const corona = new Mesh(
      new PlaneGeometry(1, 1),
      createCoronaMaterial()
    );
    corona.scale.setScalar(SUN.displayRadius * 8.5);
    corona.renderOrder = 5;
    corona.frustumCulled = false;
    corona.material.depthTest = false;
    this.scene.add(corona);

    const hit = new Mesh(
      this.hitGeo,
      new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
    );
    hit.scale.setScalar(SUN.displayRadius * 1.35);
    hit.userData.bodyKey = 'sun';
    pivot.add(hit);
    this.hits.push(hit);

    const record = {
      data: SUN,
      pivot,
      mesh,
      hit,
      clouds: null,
      atmosphere: null,
      rings: null,
      radius: SUN.displayRadius,
      spin: 0,
      spinSpeed: 0.012,
    };
    this.sun = record;
    this.bodies.push(record);
    this.corona = corona;
  }

  buildPlanets() {
    const rng = mulberry32(811);
    for (const planet of PLANETS) {
      const pivot = new Group();
      this.scene.add(pivot);

      const tilt = new Group();
      tilt.rotation.z = planet.axialTilt * DEG;
      pivot.add(tilt);

      const map = this.texture(planet.map);
      const nightMap = planet.nightMap ? this.texture(planet.nightMap) : null;
      const specMap = planet.specularMap ? this.texture(planet.specularMap, { srgb: false }) : null;
      const isGas = planet.key === 'jupiter' || planet.key === 'saturn' || planet.key === 'uranus' || planet.key === 'neptune';

      const material = createPlanetMaterial(
        {
          map,
          nightMap,
          specularMap: specMap,
          tint: planet.key === 'earth' ? '#ffffff' : new Color(planet.color).lerp(new Color('#ffffff'), isGas ? 0.45 : 0.72).getStyle(),
          roughness: 0.8,
          atmosphereColor: planet.atmosphere?.color ?? '#ffffff',
          atmosphereStrength: planet.atmosphere?.strength ?? 0,
          isGasGiant: isGas,
          seed: rng() * 10,
        },
        this.shared
      );

      const mesh = new Mesh(this.sphere, material);
      mesh.scale.setScalar(planet.displayRadius);
      mesh.rotation.y = rng() * TAU;
      tilt.add(mesh);

      let clouds = null;
      if (planet.cloudsMap) {
        const cloudTex = this.texture(planet.cloudsMap, { srgb: false });
        clouds = new Mesh(this.sphere, createCloudMaterial(cloudTex, this.shared));
        clouds.scale.setScalar(planet.displayRadius * 1.012);
        clouds.rotation.y = mesh.rotation.y + 0.4;
        clouds.renderOrder = 2;
        tilt.add(clouds);
      }

      let atmosphere = null;
      if (planet.atmosphere) {
        atmosphere = new Mesh(
          this.sphere,
          createAtmosphereMaterial(
            planet.atmosphere.color,
            planet.atmosphere.strength,
            this.shared,
            1.0
          )
        );
        atmosphere.scale.setScalar(planet.displayRadius * (planet.atmosphere.scale ?? 1.03));
        atmosphere.renderOrder = 3;
        tilt.add(atmosphere);
      }

      let rings = null;
      if (planet.rings) {
        const ringTex = this.texture(planet.rings.map, { clamp: true });
        const inner = planet.displayRadius * planet.rings.inner;
        const outer = planet.displayRadius * planet.rings.outer;
        const ringGeo = new RingGeometry(inner, outer, 320, 4);
        const ringMat = createRingMaterial(ringTex, inner, outer, planet.displayRadius);
        ringMat.uniforms.uPlanetPos.value = new Vector3();
        rings = new Mesh(ringGeo, ringMat);
        rings.rotation.x = -Math.PI / 2;
        rings.renderOrder = 1;
        tilt.add(rings);
      }

      const hit = new Mesh(
        this.hitGeo,
        new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
      );
      hit.scale.setScalar(Math.max(planet.displayRadius * 2.9, 4.2));
      hit.userData.bodyKey = planet.key;
      pivot.add(hit);
      this.hits.push(hit);

      const orbit = createOrbitLine(
        orbitPoints(planet, this.startJd ?? 2461000, 512),
        new Color('#cdd6e6'),
        planet.key === 'mercury' || planet.key === 'venus' || planet.key === 'earth' || planet.key === 'mars' ? 0.19 : 0.13
      );
      orbit.material.color.set(planet.key === 'saturn' ? '#e0cfb0' : '#cdd6e6');
      this.scene.add(orbit);

      const record = {
        data: planet,
        pivot,
        tilt,
        mesh,
        clouds,
        atmosphere,
        rings,
        hit,
        radius: planet.displayRadius,
        orbitLine: orbit,
        baseOrbitOpacity: orbit.material.opacity,
        spin: rng() * TAU,
        spinSpeed: planet.rotationHours ? (TAU / (planet.rotationHours / 24 || 1)) : 0,
        moons: [],
        rngSeed: rng(),
      };

      if (MOONS[planet.key]) {
        record.moons = this.buildMoons(planet, pivot, rng);
      }

      this.planets.push(record);
      this.bodies.push(record);
    }
  }

  buildMoons(planet, pivot, rng) {
    const records = [];
    for (const moon of MOONS[planet.key]) {
      const map = moon.map
        ? this.texture(moon.map)
        : makeMoonTexture(moon.proc);
      const mat = createPlanetMaterial(
        {
          map,
          tint: '#ffffff',
          atmosphereColor: moon.glow ?? '#ffffff',
          atmosphereStrength: planet.key === 'saturn' && moon.key === 'titan' ? 0.4 : 0,
          isGasGiant: false,
          seed: rng() * 10,
        },
        this.shared
      );
      const mesh = new Mesh(this.sphere, mat);
      mesh.scale.setScalar(moon.displayRadius);
      mesh.rotation.y = rng() * TAU;

      // a tiny atmosphere for Titan
      if (moon.key === 'titan') {
        const atm = new Mesh(
          this.sphere,
          createAtmosphereMaterial('#e8a652', 0.55, this.shared)
        );
        atm.scale.setScalar(moon.displayRadius * 1.08);
        atm.renderOrder = 3;
        mesh.add(atm);
      }

      // Moons orbit either the planet's equatorial plane or the ecliptic.
      // Titan rides in the ring plane, the Galileans and Triton follow their
      // planet's equator, and only the Moon is anchored to the ecliptic.
      const moonFrame = new Group();
      moonFrame.rotation.z = (moon.frame === 'ecliptic' ? 0 : planet.axialTilt) * DEG;
      pivot.add(moonFrame);
      moonFrame.add(mesh);
      const orbitLine = createMoonOrbitLine(moon, new Color(moon.glow ?? '#a7b6cc'));
      orbitLine.visible = false;
      orbitLine.material.opacity = 0.14;
      moonFrame.add(orbitLine);

      records.push({
        data: moon,
        mesh,
        orbitLine,
        parentKey: planet.key,
        radius: moon.displayRadius,
        phase: moonPhase(moon),
      });
      this.moonRecords.push(records[records.length - 1]);
    }
    return records;
  }

  buildBelts() {
    const rng = mulberry32(20261018);
    const count = 1500;
    const base = new IcosahedronGeometry(1, 1);
    // roughen the shared rock
    const pos = base.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const n = 0.78 + 0.42 * Math.abs(Math.sin(x * 12.1 + y * 7.7 + z * 5.3));
      pos.setXYZ(i, x * n, y * n, z * n);
    }
    base.computeVertexNormals();
    const geo = new InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('normal', base.attributes.normal);
    geo.setAttribute('uv', base.attributes.uv);
    geo.instanceCount = count;

    const orbit = new Float32Array(count);
    const angle = new Float32Array(count);
    const speed = new Float32Array(count);
    const yoff = new Float32Array(count);
    const size = new Float32Array(count);
    const spin = new Float32Array(count);
    const incl = new Float32Array(count);
    const stretch = new Float32Array(count * 3);
    const color = new Float32Array(count * 3);
    const palette = ['#8b8479', '#a29583', '#6d675f', '#b3a58f', '#7a7064', '#c0b29a'];
    const col = new Color();

    const rMin = DISPLAY_DISTANCE(2.08);
    const rMax = DISPLAY_DISTANCE(3.42);
    for (let i = 0; i < count; i++) {
      const t = Math.pow(rng(), 0.7);
      const r = rMin + t * (rMax - rMin);
      orbit[i] = r;
      angle[i] = rng() * TAU;
      const aAu = 2.7;
      speed[i] = (TAU / (365.25 * Math.pow(aAu, 1.5))) * (0.8 + rng() * 0.5);
      yoff[i] = (rng() - 0.5) * (2.0 + r * 0.018);
      size[i] = 0.03 + Math.pow(rng(), 3.3) * 0.27;
      spin[i] = rng() * TAU;
      incl[i] = (rng() - 0.5) * 0.12;
      stretch[i * 3] = 0.65 + rng() * 0.75;
      stretch[i * 3 + 1] = 0.55 + rng() * 0.8;
      stretch[i * 3 + 2] = 0.65 + rng() * 0.7;
      col.set(palette[Math.floor(rng() * palette.length)]);
      const shade = 0.55 + rng() * 0.6;
      color[i * 3] = col.r * shade;
      color[i * 3 + 1] = col.g * shade;
      color[i * 3 + 2] = col.b * shade;
    }

    const attr = (name, arr, itemSize = 1) => new InstancedBufferAttribute(arr, itemSize);
    geo.setAttribute('aOrbit', attr('aOrbit', orbit));
    geo.setAttribute('aAngle', attr('aAngle', angle));
    geo.setAttribute('aSpeed', attr('aSpeed', speed));
    geo.setAttribute('aY', attr('aY', yoff));
    geo.setAttribute('aSize', attr('aSize', size));
    geo.setAttribute('aSpin', attr('aSpin', spin));
    geo.setAttribute('aIncl', attr('aIncl', incl));
    geo.setAttribute('aStretch', attr('aStretch', stretch, 3));
    geo.setAttribute('aColor', attr('aColor', color, 3));

    const mat = createAsteroidMaterial(this.shared);
    this.asteroids = new Mesh(geo, mat);
    this.asteroids.frustumCulled = false;
    this.scene.add(this.asteroids);

    // dust in the main belt
    this.beltDust = this.makeDustBand({
      count: 2600,
      rMin: rMin * 0.96,
      rMax: rMax * 1.04,
      thickness: 2.2,
      sizeMin: 0.4,
      sizeMax: 1.0,
      color: '#c5b69f',
      opacity: 0.13,
      speed: 0.55,
      seed: 7,
    });

    this.kuiper = null;
  }

  makeDustBand({ count, rMin, rMax, thickness, sizeMin, sizeMax, color, opacity, speed, seed }) {
    const rng = mulberry32(seed);
    const geo = new BufferGeometry();
    const pos = new Float32Array(count * 3);
    const radius = new Float32Array(count);
    const angle = new Float32Array(count);
    const spd = new Float32Array(count);
    const yoff = new Float32Array(count);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = rMin + (rMax - rMin) * Math.pow(rng(), 0.8);
      radius[i] = r;
      angle[i] = rng() * TAU;
      spd[i] = (TAU / (365.25 * Math.pow(2.7, 1.5))) * (0.5 + rng());
      yoff[i] = (rng() - 0.5) * thickness;
      size[i] = sizeMin + rng() * (sizeMax - sizeMin);
      phase[i] = rng() * TAU;
    }
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aRadius', new BufferAttribute(radius, 1));
    geo.setAttribute('aAngle', new BufferAttribute(angle, 1));
    geo.setAttribute('aSpeed', new BufferAttribute(spd, 1));
    geo.setAttribute('aY', new BufferAttribute(yoff, 1));
    geo.setAttribute('aSize', new BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new BufferAttribute(phase, 1));
    const mat = createDustMaterial(null, color, opacity, speed);
    const points = new Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    return points;
  }

  buildStarField() {
    const rng = mulberry32(9106);
    const count = 12500;
    const pos = new Float32Array(count * 3);
    const color = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const palette = [
      ['#aebfff', 2],
      ['#d7e2ff', 6],
      ['#eef2ff', 24],
      ['#fff6e8', 38],
      ['#ffe4c0', 18],
      ['#ffcf9a', 8],
      ['#ffb37f', 3],
    ];
    const flat = [];
    for (const [hex, w] of palette) for (let i = 0; i < w; i++) flat.push(hex);
    const c = new Color();

    for (let i = 0; i < count; i++) {
      const galactic = rng() < 0.4;
      let y;
      if (galactic) {
        const lat = (rng() - 0.5) * 0.30;
        y = Math.sin(lat);
      } else {
        y = rng() * 2 - 1;
      }
      const phi = rng() * TAU;
      const rr = Math.sqrt(Math.max(0, 1 - y * y));
      const radius = 6400 + rng() * 1200;
      pos[i * 3] = Math.cos(phi) * rr * radius;
      pos[i * 3 + 1] = y * radius;
      pos[i * 3 + 2] = Math.sin(phi) * rr * radius;

      c.set(flat[Math.floor(rng() * flat.length)]);
      const hero = rng() < 0.003;
      const bright = hero ? 1.05 + rng() * 0.55 : 0.34 + Math.pow(rng(), 1.8) * 0.55;
      color[i * 3] = c.r * bright;
      color[i * 3 + 1] = c.g * bright;
      color[i * 3 + 2] = c.b * bright;
      sizes[i] = hero ? 1.9 + rng() * 1.2 : 0.55 + Math.pow(rng(), 2.6) * 1.05;
      phases[i] = rng() * TAU;
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new BufferAttribute(color, 3));
    geo.setAttribute('aSize', new BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new BufferAttribute(phases, 1));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.starMat = createStarMaterial(pixelRatio);
    const stars = new Points(geo, this.starMat);
    stars.frustumCulled = false;
    stars.renderOrder = -900;
    this.skyGroup.add(stars);
    this.stars = stars;
  }

  /** Called every frame. */
  update(jd, dtReal, simStartJd, camera) {
    const t = jd - simStartJd;
    this.time = t;
    this.shared.uTime.value = t;
    if (this.sun) {
      this.sun.mesh.rotation.y = t * 0.0012;
      this.sun.mesh.material.uniforms.uTime.value = t;
    }
    if (this.corona) {
      this.corona.quaternion.copy(camera.quaternion);
      this.corona.material.uniforms.uTime.value = t;
    }
    this.starMat.uniforms.uTime.value = performance.now() * 0.001;
    if (this.nebula) this.nebula.material.uniforms.uTime.value = performance.now() * 0.001;

    for (const body of this.planets) {
      const record = body;
      const data = record.data;
      const state = this.positions?.get(data.key);
      if (state) record.pivot.position.copy(state.position);

      // spin: visually damped so fast time does not strobe
      const hours = data.rotationHours;
      if (hours && hours !== 0) {
        const omegaSimDay = TAU / (Math.abs(hours) / 24);
        let omegaReal = omegaSimDay * 0.021 * (this.simDaysPerSecond ?? 0);
        // A pole beyond 90° already reverses the apparent spin; don't apply the
        // retrograde sign a second time for Venus and Uranus.
        const axisFlip = (data.axialTilt ?? 0) > 90 ? -1 : 1;
        omegaReal = Math.sign(hours) * axisFlip * Math.min(Math.abs(omegaReal), 0.6);
        record.spin += omegaReal * dtReal;
        record.mesh.rotation.y = record.spin;
      }
      if (record.clouds) {
        record.clouds.rotation.y = record.spin * 1.14 + 0.4;
      }
      if (record.rings) {
        record.rings.material.uniforms.uPlanetPos.value.copy(record.pivot.position);
        record.rings.material.uniforms.uTime.value = t;
      }
    }

    for (const rec of this.moonRecords) {
      const parent = this.planets.find((p) => p.data.key === rec.parentKey);
      if (!parent) continue;
      const local = moonRelativePosition(rec.data, jd, simStartJd);
      rec.mesh.position.copy(local);
      // tidal lock: face the planet
      rec.mesh.rotation.y = Math.atan2(local.x, local.z) + Math.PI;
    }

    if (this.asteroids) this.asteroids.material.uniforms.uTime.value = t;
    if (this.beltDust) this.beltDust.material.uniforms.uTime.value = t;
    if (this.kuiper) this.kuiper.material.uniforms.uTime.value = t;
  }

  refreshOrbits(jd) {
    this.startJd = jd;
    for (const p of this.planets) {
      p.orbitLine.geometry.dispose();
      p.orbitLine.geometry = new BufferGeometry().setFromPoints(orbitPoints(p.data, jd, 512));
    }
  }

  setPositions(map) {
    this.positions = map;
    for (const [key, { position }] of map) {
      const body = this.planets.find((p) => p.data.key === key);
      if (body) body.pivot.position.copy(position);
    }
    if (this.sun) this.sun.pivot.position.set(0, 0, 0);
  }

  setMoonsVisible(parentKey, visible) {
    for (const rec of this.moonRecords) {
      if (rec.parentKey === parentKey) rec.orbitLine.visible = visible;
      else rec.orbitLine.visible = false;
    }
  }

  setOrbitOpacity(mult) {
    for (const p of this.planets) {
      p.orbitLine.material.opacity = p.baseOrbitOpacity * mult;
      p.orbitLine.visible = mult > 0.01;
    }
  }

  highlightOrbit(key) {
    for (const p of this.planets) {
      const on = p.data.key === key;
      p.orbitLine.material.opacity = on ? 0.55 : p.baseOrbitOpacity * (key ? 0.35 : 1);
      p.orbitLine.material.color.set(on ? '#e8c186' : '#cdd6e6');
    }
  }

  /** Start angle values are filled by the controller once the epoch is known. */
  setStartJd(jd) {
    this.startJd = jd;
  }
}

