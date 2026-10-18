/**
 * SOLARIS — orchestration
 * Renderer, ephemeris loop, camera, UI, sound, and the small rituals between them.
 */
import {
  Color,
  HalfFloatType,
  NoToneMapping,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SolarWorld } from './world.js';
import { SolarUI } from './ui.js';
import { CameraDirector } from './camera.js';
import { AmbientAudio } from './audio.js';
import { FinalGradeShader, makeSharedUniforms } from './materials.js';
import { BODIES, PLANETS } from './data.js';
import { initI18n, onLangChange, t, toggleLang } from './i18n.js';
import {
  julianDateToDate,
  nowJulianDate,
  orbitalSpeedKms,
  stateAt,
  toDisplay,
} from './ephemeris.js';

initI18n();

const canvas = document.getElementById('stage');
const fatal = document.getElementById('fatal');
const fatalMsg = document.getElementById('fatal-msg');
const targetDpr = Math.min(window.devicePixelRatio || 1, 1.75);
let renderDpr = Math.min(targetDpr, 1.5);
const quality = { acc: 0, frames: 0, timer: 0, good: 0, lastFps: 0 };

function showFatal(err) {
  console.error(err);
  if (fatal) {
    fatal.hidden = false;
    if (fatalMsg) fatalMsg.textContent = err?.message ? String(err.message) : t('fatal.msg');
  }
  const intro = document.getElementById('intro');
  if (intro) intro.style.display = 'none';
}

/* ------------------------------------------------------------------ renderer */

let renderer;
try {
  renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    stencil: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(renderDpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.setClearColor(0x030409, 1);
} catch (err) {
  showFatal(err);
  throw err;
}

const scene = new Scene();
scene.background = new Color('#030409');
const camera = new PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 30000);
const controls = new OrbitControls(camera, canvas);

const shared = makeSharedUniforms();
const director = new CameraDirector(camera, controls);
director.startIntro();

const audio = new AmbientAudio();

/* ------------------------------------------------------------------ state */

const startJd = nowJulianDate();
let simJd = startJd;
let entered = false;
let focusKey = null;
let hoveredKey = null;
let simStates = new Map();
let elapsedReal = 0;
let frameCount = 0;
let firstFrame = false;

const state = {
  playing: true,
  speed: 1,
  soundOn: true,
  orbitsOn: true,
  labelsOn: true,
  uiHidden: false,
};

/* --------------------------------------------------------------------- UI */

const ui = new SolarUI({
  onEnter: (opts) => enterObservatory(opts),
  onFocus: (key) => {
    stopTour(true);
    focusBody(key);
  },
  onOverview: () => {
    stopTour(true);
    goOverview();
  },
  onNext: () => focusRelative(1),
  onTourToggle: (on) => toggleTour(on),
  onSpeedChange: (days, resume) => {
    state.speed = days;
    if (resume) state.playing = true;
    if (entered && state.playing) world.simDaysPerSecond = days;
  },
  onPlayToggle: (playing) => {
    state.playing = playing;
    world.simDaysPerSecond = entered && playing ? state.speed : 0;
  },
  onNow: () => returnToNow(),
  onSoundToggle: (on) => {
    state.soundOn = on;
    toggleSound(on);
  },
  onOrbitsToggle: (on) => {
    state.orbitsOn = on;
    world.setOrbitOpacity(on ? 1 : 0);
    if (on) world.highlightOrbit(focusKey);
  },
  onLabelsToggle: (on) => {
    state.labelsOn = on;
  },
  onAboutToggle: (open) => {
    if (open) {
      stopTour(true);
      director.suspendAutoRotate();
    } else {
      director.resumeAutoRotate();
    }
  },
  onUIToggle: (hidden) => {
    state.uiHidden = hidden;
    if (hidden) ui.hideCursorTip();
  },
});

onLangChange(() => ui.refreshLanguage());
document.querySelectorAll('[data-lang-toggle]').forEach((btn) => {
  btn.addEventListener('click', () => toggleLanguage());
});

/* ------------------------------------------------------------------ world */

let readyAssets = false;
let readyFonts = false;
let minUptime = false;

const world = new SolarWorld(
  scene,
  renderer,
  shared,
  (p) => ui.setProgress(p),
  () => {
    readyAssets = true;
    maybeReady();
  }
);
world.setStartJd(startJd);
world.refreshOrbits(startJd);
world.simDaysPerSecond = 0;
updatePositions(startJd);
ui.setDate(julianDateToDate(simJd));

if (document.fonts?.ready) {
  document.fonts.ready.then(() => {
    readyFonts = true;
    maybeReady();
  });
} else {
  readyFonts = true;
}
setTimeout(() => {
  minUptime = true;
  maybeReady();
}, 1500);

function maybeReady() {
  if (readyAssets && readyFonts && minUptime) ui.markReady();
}
// A quiet safety net for exotic loaders / cached pages.
setTimeout(() => {
  if (!readyAssets) {
    readyAssets = true;
    maybeReady();
  }
}, 12000);

/* --------------------------------------------------------------- composer */

const params = new URLSearchParams(window.location.search);
const initialDpr = renderDpr;
const renderTarget = new WebGLRenderTarget(
  Math.max(1, window.innerWidth),
  Math.max(1, window.innerHeight),
  { type: HalfFloatType, samples: params.has('nomsaa') ? 0 : params.has('samples2') ? 2 : (window.devicePixelRatio > 1.5 ? 2 : 4) }
);
let composer;
try {
  composer = new EffectComposer(renderer, renderTarget);
  composer.setPixelRatio(initialDpr);
  composer.setSize(window.innerWidth, window.innerHeight);
} catch (err) {
  showFatal(err);
  throw err;
}
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(
  new Vector2(window.innerWidth, window.innerHeight),
  0.52,
  0.46,
  0.92
);
if (params.has('nobloom')) bloom.enabled = false;
composer.addPass(bloom);

const grade = new ShaderPass(FinalGradeShader);
composer.addPass(grade);
grade.uniforms.uResolution.value.set(
  window.innerWidth * initialDpr,
  window.innerHeight * initialDpr
);

/* ------------------------------------------------------------------ helpers */

const raycaster = new Raycaster();
const ndc = new Vector2();
const sunNdc = new Vector3();
const clock = { last: performance.now() };
let focusShift = 0;
let lastDateUpdate = 0;
let lastLiveUpdate = 0;
let lastHoverTest = 0;

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function updatePositions(jd) {
  const map = new Map();
  const states = new Map();
  for (const planet of PLANETS) {
    const s = stateAt(planet, jd);
    states.set(planet.key, s);
    map.set(planet.key, { position: toDisplay(s) });
  }
  world.setPositions(map);
  simStates = states;
}

function enterObservatory({ sound }) {
  if (entered) return;
  entered = true;
  document.body.dataset.view = 'system';
  director.enter(world);
  world.simDaysPerSecond = state.playing ? state.speed : 0;
  ui.setDate(julianDateToDate(simJd));
  if (sound) {
    audio
      .enable()
      .then(() => {
        state.soundOn = true;
      })
      .catch(() => {
        state.soundOn = false;
        ui.toggleSound(false);
      });
  } else {
    state.soundOn = false;
  }
}

function focusBody(key) {
  const body = BODIES.find((b) => b.key === key);
  if (!body) return;
  if (!entered) return;
  if (ui.aboutOpen) ui.closeAbout();
  focusKey = key;
  director.focus(world, key);
  world.highlightOrbit(key);
  world.setMoonsVisible(key, true);
  if (world.asteroids) world.asteroids.visible = false;
  if (world.beltDust) world.beltDust.visible = false;
  ui.showDetail(key);
  ui.setHovered(null);
  ui.hideCursorTip();
  document.body.classList.remove('is-hovering');
  if (state.soundOn) audio.focusChime(key);
}

function goOverview() {
  focusKey = null;
  director.overview(world);
  world.highlightOrbit(null);
  world.setMoonsVisible(null, false);
  if (world.asteroids) world.asteroids.visible = true;
  if (world.beltDust) world.beltDust.visible = true;
  ui.hideDetail();
}

function focusRelative(dir) {
  stopTour(true);
  const order = ['sun', ...PLANETS.map((p) => p.key)];
  const current = focusKey ?? 'sun';
  let idx = order.indexOf(current);
  if (idx < 0) idx = 0;
  const next = order[(idx + dir + order.length) % order.length];
  focusBody(next);
}

const TOUR = ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
const tour = { active: false, index: -1, timer: null };

function startTour() {
  if (tour.active) return;
  tour.active = true;
  tour.index = -1;
  ui.setTour(true);
  ui.showToast(t('toast.tourStart'), 2200);
  stepTour();
}

function stepTour() {
  if (!tour.active) return;
  tour.index++;
  if (tour.index >= TOUR.length) {
    finishTour();
    return;
  }
  focusBody(TOUR[tour.index]);
  tour.timer = setTimeout(stepTour, 8600);
}

function finishTour() {
  tour.active = false;
  clearTimeout(tour.timer);
  tour.timer = null;
  ui.setTour(false);
  goOverview();
  ui.showToast(t('toast.tourEnd'), 2600);
}

function stopTour(quiet = false) {
  if (!tour.active) return;
  tour.active = false;
  clearTimeout(tour.timer);
  tour.timer = null;
  ui.setTour(false);
  if (!quiet) ui.showToast(t('toast.tourStop'), 1800);
}

function toggleTour(on) {
  if (on) startTour();
  else stopTour();
}

function returnToNow() {
  simJd = nowJulianDate();
  updatePositions(simJd);
  ui.setDate(julianDateToDate(simJd));
  ui.showToast(t('toast.now'));
}

function toggleLanguage() {
  toggleLang();
  if (entered) ui.showToast(t('toast.lang'), 1600);
}

function toggleSound(on) {
  if (on) {
    audio.enable().catch(() => {
      state.soundOn = false;
      ui.toggleSound(false);
    });
  } else {
    audio.disable();
  }
}

/* ------------------------------------------------------------------ picking */

function pick(clientX, clientY) {
  if (!entered || state.uiHidden) return null;
  ndc.x = (clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(world.hits, false);
  return hits.length ? hits[0].object.userData.bodyKey : null;
}

let pointerDown = null;
canvas.addEventListener('pointerdown', (e) => {
  if (tour.active) stopTour(true);
  pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
});
canvas.addEventListener('wheel', () => {
  if (tour.active) stopTour(true);
}, { passive: true });
canvas.addEventListener('pointerup', (e) => {
  if (!pointerDown) return;
  const dx = e.clientX - pointerDown.x;
  const dy = e.clientY - pointerDown.y;
  const dt = performance.now() - pointerDown.t;
  pointerDown = null;
  if (dx * dx + dy * dy > 30 || dt > 850) return;
  const key = pick(e.clientX, e.clientY);
  if (key) focusBody(key);
  else if (focusKey) goOverview();
});
canvas.addEventListener('pointerleave', () => {
  hoveredKey = null;
  document.body.classList.remove('is-hovering');
  ui.setHovered(null);
  ui.hideCursorTip();
  document.body.classList.remove('is-hovering');
});

window.addEventListener('pointermove', (e) => {
  if (!entered || e.target !== canvas) {
    if (hoveredKey) {
      hoveredKey = null;
      document.body.classList.remove('is-hovering');
      ui.setHovered(null);
      ui.hideCursorTip();
    }
    return;
  }
  const now = performance.now();
  if (now - lastHoverTest < 24) return;
  lastHoverTest = now;
  const key = pick(e.clientX, e.clientY);
  if (key !== hoveredKey) {
    hoveredKey = key;
    document.body.classList.toggle('is-hovering', !!key);
    ui.setHovered(key);
  }
  if (key) ui.showCursorTip(key, e.clientX, e.clientY);
  else ui.hideCursorTip();
});

/* ----------------------------------------------------------------- keyboard */

window.addEventListener('keydown', (e) => {
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
  // The About dialog owns the keyboard while open; its own listener closes it on Esc.
  if (ui.aboutOpen) return;
  // Let a focused button/link receive its native Space/Enter activation.
  if (e.target?.closest?.('button, a') && (e.key === ' ' || e.key === 'Enter')) return;
  const k = e.key.toLowerCase();

  if (tour.active && k !== 'h') stopTour(true);

  if (e.key === 'Escape') {
    if (state.uiHidden) {
      ui.toggleUI(false);
      return;
    }
    if (focusKey) {
      goOverview();
      return;
    }
  }
  if (!entered) {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btn-enter')?.click();
    }
    return;
  }
  if (e.key === ' ' || k === 'spacebar') {
    e.preventDefault();
    ui.togglePlay();
  } else if (k === 'o') {
    ui.toggleOrbits();
  } else if (k === 'l') {
    ui.toggleLabels();
  } else if (k === 's' || k === 'm') {
    ui.toggleSound();
  } else if (k === 'h') {
    ui.toggleUI();
  } else if (k === 'n') {
    returnToNow();
  } else if (k === 'e') {
    toggleLanguage();
  } else if (e.key === '?' || e.key === '/') {
    ui.openAbout();
  } else if (/^[0-8]$/.test(k)) {
    const key = k === '0' ? 'sun' : PLANETS[Number(k) - 1]?.key;
    if (key) focusBody(key);
  } else if (e.key === 'ArrowRight' && focusKey) {
    focusRelative(1);
  } else if (e.key === 'ArrowLeft' && focusKey) {
    focusRelative(-1);
  }
});

document.addEventListener('visibilitychange', () => {
  clock.last = performance.now();
});

/* ------------------------------------------------------------------ resize */

let resizeRaf = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    const dpr = renderDpr;
    grade.uniforms.uResolution.value.set(w * dpr, h * dpr);
    if (world.starMat) {
      world.starMat.uniforms.uPixelRatio.value = dpr;
    }
    quality.acc = 0;
    quality.frames = 0;
    quality.timer = 0;
    if (focusShift > 0 && w > 900) {
      camera.setViewOffset(w, h, w * 0.072 * focusShift, 0, w, h);
    } else if (focusShift > 0 && h > 520) {
      camera.setViewOffset(w, h, 0, -h * 0.18 * focusShift, w, h);
    } else if (focusShift > 0) {
      // short landscape phone: the dossier is a right column, keep the body left of it
      camera.setViewOffset(w, h, w * 0.23 * focusShift, 0, w, h);
    } else {
      camera.clearViewOffset();
    }
  });
});

/* --------------------------------------------------------------- main loop */

function updateFocusShift(dt) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const target = focusKey ? 1 : 0;
  const k = 1 - Math.exp(-dt * 5.2);
  focusShift += (target - focusShift) * k;
  if (focusShift < 0.002) focusShift = 0;
  if (focusShift > 0.998) focusShift = 1;
  if (focusShift > 0) {
    if (w > 900) {
      // landscape/desktop: make room for the dossier on the right
      camera.setViewOffset(w, h, w * 0.072 * focusShift, 0, w, h);
    } else if (h > 520) {
      // portrait: lift the frame so the planet falls below the top sheet
      camera.setViewOffset(w, h, 0, -h * 0.18 * focusShift, w, h);
    } else {
      // short landscape: center the body in the space left of the dossier column
      camera.setViewOffset(w, h, w * 0.23 * focusShift, 0, w, h);
    }
  } else {
    camera.clearViewOffset();
  }
}

function updateSunFlare() {
  sunNdc.set(0, 0, 0).project(camera);
  const onScreen =
    sunNdc.z < 1
      ? 1 - smoothstep(0.85, 1.3, Math.max(Math.abs(sunNdc.x), Math.abs(sunNdc.y)))
      : 0;
  grade.uniforms.uSunUV.value.set(sunNdc.x * 0.5 + 0.5, sunNdc.y * 0.5 + 0.5);
  grade.uniforms.uSunVis.value = onScreen * (focusKey ? 0.72 : 1.0);
  grade.uniforms.uTime.value = elapsedReal;
}

function setRenderDpr(dpr) {
  dpr = Math.max(1, Math.min(targetDpr, dpr));
  if (Math.abs(dpr - renderDpr) < 0.01) return;
  renderDpr = dpr;
  renderer.setPixelRatio(dpr);
  composer.setPixelRatio(dpr);
  composer.setSize(window.innerWidth, window.innerHeight);
  grade.uniforms.uResolution.value.set(window.innerWidth * dpr, window.innerHeight * dpr);
  if (world.starMat) world.starMat.uniforms.uPixelRatio.value = dpr;
  if (world.beltDust) world.beltDust.material.uniforms.uPixelRatio.value = dpr;
  quality.acc = 0;
  quality.frames = 0;
  quality.timer = 0;
  quality.good = 0;
}

function adaptQuality(dt) {
  if (!entered || document.hidden || director.mode === 'intro' || director.mode === 'transition') {
    quality.acc = 0;
    quality.frames = 0;
    quality.timer = 0;
    return;
  }
  quality.acc += dt;
  quality.frames++;
  quality.timer += dt;
  if (quality.timer < 2.5) return;
  const fps = quality.frames / Math.max(quality.acc, 0.001);
  quality.lastFps = fps;
  quality.acc = 0;
  quality.frames = 0;
  quality.timer = 0;
  if (fps < 44 && renderDpr > 1.001) {
    quality.good = 0;
    setRenderDpr(renderDpr - 0.25);
  } else if (fps > 56) {
    quality.good++;
    if (quality.good >= 3 && renderDpr < targetDpr - 0.01) {
      quality.good = 0;
      setRenderDpr(renderDpr + 0.25);
    }
  } else {
    quality.good = 0;
  }
}

function tick() {
  requestAnimationFrame(tick);
  const now = performance.now();
  const dt = Math.min((now - clock.last) / 1000, 0.05);
  clock.last = now;
  elapsedReal += dt;
  frameCount++;

  if (entered && state.playing) {
    simJd += dt * state.speed;
    updatePositions(simJd);
  }

  world.simDaysPerSecond = entered && state.playing ? state.speed : 0;
  world.update(simJd, dt, startJd, camera);

  director.update(dt, world);
  updateFocusShift(dt);
  scene.updateMatrixWorld();
  camera.updateMatrixWorld();

  updateSunFlare();

  if (entered) {
    ui.updateLabels(world, camera, focusKey, entered);
    const nowMs = now;
    if (nowMs - lastDateUpdate > 100) {
      lastDateUpdate = nowMs;
      ui.setDate(julianDateToDate(simJd));
    }
    if (focusKey && nowMs - lastLiveUpdate > 180) {
      lastLiveUpdate = nowMs;
      updateLive();
    }
  }

  composer.render(dt);
  adaptQuality(dt);

  if (!firstFrame) {
    firstFrame = true;
    window.__SOLARIS_READY__ = true;
    document.body.classList.add('has-rendered');
  }
}

function updateLive() {
  if (!focusKey) return;
  if (focusKey === 'sun') {
    ui.updateLive([
      { value: t('detail.live.planetCount') },
      { value: '99.86%' },
      { value: 'G2V' },
    ]);
    return;
  }
  const s = simStates.get(focusKey);
  if (!s) return;
  const lam = ((Math.atan2(s.y, s.x) * 180) / Math.PI + 360) % 360;
  ui.updateLive([
    { value: `${s.rAu.toFixed(2)} AU` },
    { value: `${orbitalSpeedKms(s).toFixed(2)} km/s` },
    { value: `${lam.toFixed(1)}°` },
  ]);
}

/* -------------------------------------------------------------------- start */

tick();

/* --------------------------------------------------------------------- api */

window.__SOLARIS__ = {
  bloom,
  toggleStars: (on) => { world.stars.visible = on; },
  toggleMilkyWay: (on) => { if (world.nebula) world.nebula.visible = on; },
  toggleBelt: (on) => { world.asteroids.visible = on; world.beltDust.visible = on; if (world.kuiper) world.kuiper.visible = on; },
  toggleKuiper: (on) => { if (world.kuiper) world.kuiper.visible = on; },
  get ready() {
    return !!window.__SOLARIS_READY__;
  },
  get entered() {
    return entered;
  },
  get view() {
    return director.mode;
  },
  focus: (key) => focusBody(key),
  overview: () => goOverview(),
  next: () => focusRelative(1),
  tour: (on) => toggleTour(on),
  enter: () => document.getElementById('btn-enter')?.click(),
  now: () => returnToNow(),
  setSpeed: (days) => ui.setSpeed(days),
  setTime: (jd) => {
    simJd = jd;
    updatePositions(jd);
    ui.setDate(julianDateToDate(jd));
  },
  play: () => ui.setPlaying(true),
  pause: () => ui.setPlaying(false),
  hideUI: () => ui.toggleUI(true),
  showUI: () => ui.toggleUI(false),
  labels: (on) => ui.toggleLabels(on),
  orbits: (on) => ui.toggleOrbits(on),
  about: (on = true) => (on ? ui.openAbout() : ui.closeAbout()),
  setDpr: (dpr) => setRenderDpr(dpr),
  sound: (on) => ui.toggleSound(on),
  state,
  ui,
  world,
  director,
  camera,
  renderer,
  composer,
  get jd() {
    return simJd;
  },
  get stats() {
    return {
      focused: focusKey,
      mode: director.mode,
      frames: frameCount,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      dpr: renderDpr,
      fps: quality.lastFps,
    };
  },
};
