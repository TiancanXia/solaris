/**
 * SOLARIS — camera direction
 * A small cinematic director: overview, fly-to, follow, and idle drift.
 */
import { Vector3 } from 'three';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
const easeInOutQuint = (t) => (t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2);

export class CameraDirector {
  constructor(camera, controls, opts = {}) {
    this.camera = camera;
    this.controls = controls;
    this.mode = 'intro';
    this.focusKey = null;
    this.transition = null;
    this.followOffset = new Vector3();
    this.lastFocusPos = new Vector3();
    this.lastInteraction = performance.now();
    this.overviewPos = new Vector3(0, 470, 930);
    this.overviewTarget = new Vector3(0, 0, 0);

    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.045;
    this.controls.rotateSpeed = 0.52;
    this.controls.zoomSpeed = 0.65;
    this.controls.panSpeed = 0.4;
    this.controls.enablePan = false;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 0.22;
    this.controls.minPolarAngle = 0.09;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 26;
    this.controls.maxDistance = 2800;
    this.controls.enabled = false;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

    this.controls.addEventListener('start', () => {
      this.lastInteraction = performance.now();
      if (this.mode === 'overview') this.controls.autoRotate = false;
    });
    this.controls.addEventListener('end', () => {
      this.lastInteraction = performance.now();
    });

    this.camera.position.set(0, 560, 2350);
    this.controls.target.set(0, 0, 0);
    this.camera.lookAt(0, 0, 0);
  }

  getBody(world, key) {
    if (!world) return null;
    if (key === 'sun') return world.sun;
    return world.planets.find((p) => p.data.key === key) ?? null;
  }

  startIntro() {
    this.mode = 'intro';
    this.controls.enabled = false;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    this.controls.autoRotate = false;
    this.camera.position.set(0, 560, 2350);
    this.controls.target.set(0, 0, 0);
    this.camera.lookAt(0, 0, 0);
  }

  enter(world) {
    if (this.mode !== 'intro') return;
    this.startOverviewTransition(this.reducedMotion ? 0.25 : 3.8);
  }

  skip() {
    if (this.transition) {
      const tr = this.transition;
      if (tr.kind === 'focus') this.finishFocus(tr.world);
      else this.finishOverview();
    }
  }

  startOverviewTransition(duration = 2.6) {
    this.focusKey = null;
    this.mode = 'transition';
    this.controls.enabled = false;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    this.controls.autoRotate = false;
    this.transition = {
      kind: 'overview',
      fromPos: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      elapsed: 0,
      duration,
    };
  }

  overview(world, immediate = false) {
    this.focusKey = null;
    if (immediate) {
      this.camera.position.copy(this.overviewPos);
      this.controls.target.copy(this.overviewTarget);
      this.controls.enabled = true;
      this.controls.minDistance = 26;
      this.controls.maxDistance = 2800;
      this.controls.autoRotate = true;
      this.controls.update();
      this.mode = 'overview';
      this.transition = null;
      return;
    }
    this.startOverviewTransition(this.reducedMotion ? 0.2 : 2.4);
  }

  focus(world, key, immediate = false) {
    const body = this.getBody(world, key);
    if (!body) return;
    if (this.focusKey === key && this.mode === 'focus') return;

    const pos = body.pivot.position.clone();
    const radius = body.radius;
    const out = key === 'sun'
      ? new Vector3(0.25, 0.5, 1).normalize()
      : pos.clone().setY(0).normalize();
    const up = new Vector3(0, 1, 0);
    const tangent = new Vector3().crossVectors(out, up).normalize();
    // bias the tangent with a per-body sign so successive visits feel varied
    if (key.length % 2 === 0) tangent.multiplyScalar(-1);
    const dir = out.clone()
      .multiplyScalar(0.5)
      .addScaledVector(tangent, 0.92)
      .addScaledVector(up, 0.42)
      .normalize();

    let distance;
    if (key === 'sun') distance = radius * 4.3;
    else if (key === 'saturn') distance = radius * 6.6;
    else distance = radius * 5.0;

    this.focusKey = key;
    this.focusRadius = radius;
    this.transition = {
      kind: 'focus',
      key,
      world,
      dir,
      distance,
      fromPos: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      elapsed: 0,
      duration: immediate ? 0 : (this.reducedMotion ? 0.2 : 2.35),
    };
    this.mode = 'transition';
    this.controls.enabled = false;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    this.controls.autoRotate = false;
    this.controls.minDistance = Math.max(radius * 1.25, 1.4);
    this.controls.maxDistance = Math.max(radius * 52, 80);

    if (immediate) this.finishFocus(world);
  }

  finishFocus(world) {
    const key = this.focusKey;
    const body = this.getBody(world, key);
    if (!body) return;
    const pos = body.pivot.position.clone();
    this.controls.target.copy(pos);
    this.lastFocusPos.copy(pos);
    this.controls.enabled = true;
    this.controls.autoRotate = false;
    this.controls.update();
    this.mode = 'focus';
    this.transition = null;
  }

  finishOverview() {
    this.camera.position.copy(this.overviewPos);
    this.controls.target.copy(this.overviewTarget);
    this.controls.enabled = true;
    this.controls.minDistance = 26;
    this.controls.maxDistance = 2800;
    this.controls.autoRotate = true;
    this.controls.update();
    this.mode = 'overview';
    this.transition = null;
    this.focusKey = null;
  }

  update(dt, world) {
    const now = performance.now();

    if (this.mode === 'intro' && !this.reducedMotion) {
      const t = now * 0.000035;
      this.camera.position.set(Math.sin(t) * 130, 560 + Math.cos(t * 0.7) * 24, 2320 + Math.cos(t) * 90);
      this.camera.lookAt(0, 0, 0);
      return;
    }

    if (this.transition) {
      const tr = this.transition;
      tr.elapsed += dt;
      const raw = clamp01(tr.elapsed / Math.max(tr.duration, 0.0001));
      const p = easeInOutQuint(raw);

      if (tr.kind === 'overview') {
        this.camera.position.lerpVectors(tr.fromPos, this.overviewPos, p);
        this.controls.target.lerpVectors(tr.fromTarget, this.overviewTarget, p);
        this.camera.lookAt(this.controls.target);
        if (raw >= 1) this.finishOverview();
      } else if (tr.kind === 'focus') {
        const body = this.getBody(tr.world, tr.key);
        if (!body) {
          this.finishOverview();
          return;
        }
        const target = body.pivot.position;
        const endPos = target.clone().addScaledVector(tr.dir, tr.distance);
        // target eases a touch earlier so the camera arcs around it
        const pt = easeInOutCubic(raw);
        this.camera.position.lerpVectors(tr.fromPos, endPos, p);
        this.controls.target.lerpVectors(tr.fromTarget, target, pt);
        this.camera.lookAt(this.controls.target);
        if (raw >= 1) this.finishFocus(tr.world);
      }
      return;
    }

    if (this.mode === 'focus' && this.focusKey && world) {
      const body = this.getBody(world, this.focusKey);
      if (body) {
        const pos = body.pivot.position;
        const delta = pos.clone().sub(this.lastFocusPos);
        this.camera.position.add(delta);
        this.controls.target.copy(pos);
        this.lastFocusPos.copy(pos);
      }
    }

    if (this.mode === 'overview') {
      const idle = now - this.lastInteraction;
      if (!this.reducedMotion && idle > 11000 && !this.controls.autoRotate && !this.userLocked) {
        this.controls.autoRotate = true;
      }
    }
    this.controls.update(dt);
  }

  suspendAutoRotate() {
    this.userLocked = true;
    this.controls.autoRotate = false;
  }

  resumeAutoRotate() {
    this.userLocked = false;
    this.lastInteraction = performance.now();
  }
}
