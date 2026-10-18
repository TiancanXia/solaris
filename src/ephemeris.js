/**
 * SOLARIS — ephemeris
 * Keplerian element propagation (JPL approximate elements) + display-space mapping.
 */
import { Vector3 } from 'three';
import { J2000, DISPLAY_DISTANCE } from './data.js';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
export const JD_UNIX_EPOCH = 2440587.5;
export const AU_PER_YEAR_TO_KMS = 4.74057;
export const GM_SUN_AU3_YR2 = TAU * TAU;

export const nowJulianDate = () => Date.now() / 86400000 + JD_UNIX_EPOCH;

export function julianDateToDate(jd) {
  return new Date((jd - JD_UNIX_EPOCH) * 86400000);
}

export function dateToJulianDate(date) {
  return date.getTime() / 86400000 + JD_UNIX_EPOCH;
}

const wrapPi = (a) => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};

export function solveKepler(M, e) {
  M = wrapPi(M);
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 10; i++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    const d = f / fp;
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

/** Propagate the JPL elements to Julian date jd. Returns ecliptic AU coordinates. */
export function stateAt(body, jd) {
  const el = body.elements;
  const T = (jd - J2000) / 36525;
  const a = el.a + el.rates.a * T;
  const e = Math.max(0, Math.min(0.99, el.e + el.rates.e * T));
  const I = (el.i + el.rates.i * T) * DEG;
  const L = (el.L + el.rates.L * T) * DEG;
  const longPeri = (el.longPeri + el.rates.longPeri * T) * DEG;
  const longNode = (el.longNode + el.rates.longNode * T) * DEG;
  const omega = longPeri - longNode;
  const M = wrapPi(L - longPeri);
  const E = solveKepler(M, e);
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const xv = a * (cosE - e);
  const yv = a * Math.sqrt(1 - e * e) * sinE;
  const r = Math.hypot(xv, yv);
  const v = Math.atan2(yv, xv);
  const u = v + omega;

  const cosO = Math.cos(longNode);
  const sinO = Math.sin(longNode);
  const cosI = Math.cos(I);
  const sinI = Math.sin(I);
  const cosU = Math.cos(u);
  const sinU = Math.sin(u);

  const x = r * (cosO * cosU - sinO * sinU * cosI);
  const y = r * (sinO * cosU + cosO * sinU * cosI);
  const z = r * (sinU * sinI);

  return { x, y, z, rAu: r, aAu: a, e, I, omega, M, E, longNode, longPeri, T };
}

/** Ecliptic AU -> display space. Y is up; orientation is right-handed. */
export function toDisplay(s) {
  const r = Math.hypot(s.x, s.y, s.z);
  if (r < 1e-9) return new Vector3(0, 0, 0);
  const f = DISPLAY_DISTANCE(r) / r;
  return new Vector3(s.x * f, s.z * f, -s.y * f);
}

export function bodyDisplayPosition(body, jd) {
  if (!body.elements) return new Vector3(0, 0, 0);
  return toDisplay(stateAt(body, jd));
}

/** Sample a full orbit in display space. */
export function orbitPoints(body, jd, segments = 512) {
  const el = body.elements;
  const T = (jd - J2000) / 36525;
  const a = el.a + el.rates.a * T;
  const e = Math.max(0, Math.min(0.99, el.e + el.rates.e * T));
  const I = (el.i + el.rates.i * T) * DEG;
  const longPeri = (el.longPeri + el.rates.longPeri * T) * DEG;
  const longNode = (el.longNode + el.rates.longNode * T) * DEG;
  const omega = longPeri - longNode;
  const cosO = Math.cos(longNode);
  const sinO = Math.sin(longNode);
  const cosI = Math.cos(I);
  const sinI = Math.sin(I);
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const E = (i / segments) * TAU;
    const xv = a * (Math.cos(E) - e);
    const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const r = Math.hypot(xv, yv);
    const v = Math.atan2(yv, xv);
    const u = v + omega;
    const cosU = Math.cos(u);
    const sinU = Math.sin(u);
    const x = r * (cosO * cosU - sinO * sinU * cosI);
    const y = r * (sinO * cosU + cosO * sinU * cosI);
    const z = r * (sinU * sinI);
    const f = DISPLAY_DISTANCE(r) / r;
    pts.push(new Vector3(x * f, z * f, -y * f));
  }
  return pts;
}

/** Instantaneous heliocentric speed in km/s (vis-viva). */
export function orbitalSpeedKms(state) {
  const v = Math.sqrt(GM_SUN_AU3_YR2 * (2 / state.rAu - 1 / state.aAu));
  return v * AU_PER_YEAR_TO_KMS;
}

/** Direction of the body from the sun, in display space (unit). */
export function radialDirection(pos) {
  const d = pos.clone();
  d.y = 0;
  if (d.lengthSq() < 1e-8) return new Vector3(0, 0, 1);
  return d.normalize();
}

const MOON_SEED = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
};
export const moonPhase = (moon) => MOON_SEED('orbit:' + moon.key) * TAU;
export const moonNode = (moon) => MOON_SEED('node:' + moon.key) * TAU;

/** Position of a moon relative to its planet's pivot. */
export function moonRelativePosition(moon, jd, simStartJd) {
  const days = jd - simStartJd;
  const dir = moon.retrograde ? -1 : 1;
  const ang = moonPhase(moon) + dir * (days / moon.periodDays) * TAU;
  const inc = (moon.inclinationDeg || 0) * DEG;
  const node = moonNode(moon);
  const x = Math.cos(ang) * moon.orbitRadius;
  const z = Math.sin(ang) * moon.orbitRadius;
  // rotate around X for inclination, then around Y for ascending node
  const y = z * Math.sin(inc);
  const zz = z * Math.cos(inc);
  const cx = Math.cos(node), sx = Math.sin(node);
  return new Vector3(
    x * cx + zz * sx,
    y,
    -x * sx + zz * cx
  );
}
