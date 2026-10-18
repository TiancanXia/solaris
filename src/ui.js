/**
 * SOLARIS — interface
 * The observatory console: specimen shelf, ephemeris, labels, ledger, intro.
 */
import { BODIES, MOONS, PLANETS, SUN } from './data.js';
import { Vector3 } from 'three';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
const pad2 = (n) => String(n).padStart(2, '0');
const fmtInt = new Intl.NumberFormat('en-US');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function hexToRgba(hex, alpha = 1) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function formatSpeed(days) {
  if (days <= 0.00002) return { value: '实时', unit: '1 : 1' };
  if (days <= 1 / 24 + 1e-7) {
    const hours = days * 24;
    if (hours < 1 / 60) return { value: (days * 86400).toFixed(1), unit: '秒 / 秒' };
    if (hours < 1) return { value: (days * 1440).toFixed(1), unit: '分 / 秒' };
    return { value: hours.toFixed(1), unit: '时 / 秒' };
  }
  if (days < 30) return { value: days.toFixed(days < 10 ? 1 : 0), unit: '天 / 秒' };
  if (days < 365.25) return { value: (days / 30.4375).toFixed(1), unit: '月 / 秒' };
  return { value: (days / 365.25).toFixed(1), unit: '年 / 秒' };
}

function formatRotation(hours) {
  if (!hours) return '—';
  const abs = Math.abs(hours);
  const retro = hours < 0 ? ' · 逆行' : '';
  if (abs < 48) return `${abs.toFixed(1)} 小时${retro}`;
  return `${(abs / 24).toFixed(abs / 24 < 10 ? 1 : 0)} 天${retro}`;
}

function formatPeriod(days) {
  if (!days) return '—';
  if (days < 1000) return `${days < 100 ? days.toFixed(1) : fmtInt.format(Math.round(days))} 天`;
  return `${(days / 365.25).toFixed(1)} 年`;
}

function formatMass(m) {
  if (!m) return '—';
  if (m >= 1000) return `${fmtInt.format(Math.round(m))} ⊕`;
  if (m >= 10) return `${m.toFixed(1)} ⊕`;
  if (m >= 1) return `${m.toFixed(2)} ⊕`;
  if (m >= 0.01) return `${m.toFixed(3)} ⊕`;
  return `${m.toFixed(4)} ⊕`;
}

function formatTemp(t) {
  return `${fmtInt.format(Math.round(t))} °C`;
}

export class SolarUI {
  constructor(opts = {}) {
    this.opts = opts;
    this.els = {
      app: $('#app'),
      intro: $('#intro'),
      enter: $('#btn-enter'),
      introSound: $('#intro-sound'),
      loaderBar: $('#loader-bar'),
      loaderPct: $('#loader-pct'),
      loaderLabel: $('#loader-label'),
      cards: $('#cards'),
      labels: $('#labels'),
      detail: $('#detail'),
      dIndex: $('#d-index'),
      dName: $('#d-name'),
      dEn: $('#d-en'),
      dType: $('#d-type'),
      dDesc: $('#d-desc'),
      dGrid: $('#d-grid'),
      dLive: $('#d-live'),
      dMoonsWrap: $('#d-moons-wrap'),
      dMoons: $('#d-moons'),
      ephDate: $('#eph-date'),
      ephTime: $('#eph-time'),
      ephCaption: $('.eph-caption'),
      ephStatus: $('#eph-status'),
      speedValue: $('#speed-value'),
      speedUnit: $('#speed-unit'),
      slider: $('#speed'),
      btnPlay: $('#btn-play'),
      toast: $('#toast'),
      about: $('#about'),
      tip: $('#cursor-tip'),
      btnSound: $('#btn-sound'),
      btnOrbits: $('#btn-orbits'),
      btnLabels: $('#btn-labels'),
      btnHide: $('#btn-hide'),
      btnRestore: $('#btn-restore'),
      btnTour: $('#btn-tour'),
    };
    this.state = {
      entered: false,
      playing: true,
      speed: 1,
      orbitsOn: true,
      labelsOn: true,
      soundOn: true,
      focusKey: null,
      hoveredKey: null,
      uiHidden: false,
      ready: false,
      tourOn: false,
    };
    this.labelRecords = [];
    this.startedAt = performance.now();
    this.lastLive = 0;
    this._buildCards();
    this._buildLabels();
    this._bind();
    this._setSoundUI(true);
    this._updateSpeedUI();
    this._updatePresets();
    this._setTimezoneCaption();
    if (this.els.app) {
      this.els.app.inert = true;
      this.els.app.setAttribute('aria-hidden', 'true');
    }
    if (this.els.about) this.els.about.inert = true;
  }

  /* ------------------------------------------------------------------ cards */

  _buildCards() {
    const items = [SUN, ...PLANETS];
    this.els.cards.innerHTML = items
      .map((b) => {
        const glow = hexToRgba(b.glow ?? b.color, 0.42);
        return `
          <button class="card" data-key="${b.key}" style="--planet-glow:${glow}" aria-label="聚焦${b.nameZh}">
            <span class="card-index">${b.index}</span>
            <span class="thumb"><span class="thumb-inner" style="background-image:url('${b.cardMap}')"></span></span>
            <span class="card-name">${b.nameZh}</span>
            <span class="card-en">${b.nameEn.toUpperCase()}</span>
          </button>`;
      })
      .join('');
    $$('.card', this.els.cards).forEach((el) => {
      el.addEventListener('click', () => this.opts.onFocus?.(el.dataset.key));
    });
    this.cards = $$('.card', this.els.cards);
  }

  _setActiveCard(key) {
    this.state.focusKey = key;
    this.cards.forEach((el) => el.classList.toggle('is-active', el.dataset.key === key));
    if (!key) return;
    const active = this.cards.find((el) => el.dataset.key === key);
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }

  /* ----------------------------------------------------------------- labels */

  _buildLabels() {
    const list = [];
    for (const b of [SUN, ...PLANETS]) {
      list.push({ key: b.key, zh: b.nameZh, en: b.nameEn.toUpperCase(), isMoon: false, parent: null });
    }
    for (const [parentKey, moons] of Object.entries(MOONS)) {
      for (const m of moons) {
        list.push({
          key: m.key,
          zh: m.nameEn.toUpperCase(),
          en: m.nameZh.split('·').pop().trim(),
          isMoon: true,
          parent: parentKey,
        });
      }
    }
    this.els.labels.innerHTML = list
      .map(
        (l) =>
          `<div class="label ${l.isMoon ? 'moon' : ''} is-hidden" data-key="${l.key}" data-parent="${l.parent ?? ''}">
            <i class="label-dot"></i><i class="label-line"></i>
            <span class="label-zh">${l.zh}</span>
            ${l.en ? `<span class="label-en">${l.en}</span>` : ''}
          </div>`
      )
      .join('');
    this.labelRecords = list.map((l) => {
      const el = this.els.labels.querySelector(`.label[data-key="${l.key}"]`);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.opts.onFocus?.(l.parent ?? l.key);
      });
      return { ...l, el, width: 0, height: 18 };
    });
    // measure after layout
    requestAnimationFrame(() => {
      for (const rec of this.labelRecords) {
        rec.width = rec.el.offsetWidth || 84;
        rec.height = rec.el.offsetHeight || 16;
      }
    });
    this._tmpV = new Vector3();
    this._sunV = new Vector3();
  }

  updateLabels(world, camera, focusKey, entered) {
    if (!this.state.labelsOn || !entered || !world) {
      this.labelRecords.forEach((r) => r.el.classList.add('is-hidden'));
      return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cam = camera;
    const tanHalf = Math.tan((cam.fov * Math.PI) / 360);
    const pxPerUnit = h / 2 / tanHalf;

    const candidates = [];
    if (!focusKey) {
      const priorities = {
        earth: 100, jupiter: 95, saturn: 90, uranus: 82, neptune: 78,
        sun: 62, mars: 56, venus: 46, mercury: 36,
      };
      for (const rec of world.planets) {
        const p = rec.pivot.position;
        const d = cam.position.distanceTo(p);
        candidates.push({ key: rec.data.key, pos: p, radius: rec.radius, d, priority: priorities[rec.data.key] ?? 10 });
      }
      const sunP = world.sun.pivot.position;
      const sunD = cam.position.distanceTo(sunP);
      candidates.push({ key: 'sun', pos: sunP, radius: world.sun.radius, d: sunD, priority: priorities.sun });
    } else if (focusKey !== 'sun') {
      for (const rec of world.moonRecords) {
        if (rec.parentKey !== focusKey) continue;
        const p = rec.mesh.getWorldPosition(this._tmpV).clone();
        // skip the Moon's labels if the planet is between us and the moon? not needed
        const d = cam.position.distanceTo(p);
        candidates.push({
          key: rec.data.key,
          pos: p,
          radius: rec.radius,
          d,
          priority: 20,
          isMoon: true,
        });
      }
    }

    const byKey = new Map(candidates.map((c) => [c.key, c]));
    const placements = [];
    // sort by apparent size
    candidates.sort((a, b) => b.priority - a.priority);

    for (const c of candidates) {
      const rec = this.labelRecords.find((r) => r.key === c.key);
      if (!rec) continue;
      const projected = this._project(c.pos, cam, w, h);
      rec.el.classList.add('is-hidden');
      if (!projected) continue;
      const { x, y } = projected;
      if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue;
      const apparent = (c.radius / Math.max(c.d, 0.001)) * pxPerUnit;
      const sideLeft = x > w * 0.74;
      const offset = clamp(apparent + 12, 20, w * 0.42);
      const anchorX = sideLeft ? x - offset : x + offset;
      const boxW = rec.width;
      const boxH = rec.height;
      const left = sideLeft ? anchorX - boxW : anchorX;
      const right = left + boxW;
      const top = y - boxH / 2;
      // keep labels away from the primary UI
      const inBrand = x < 470 && y < 330;
      const inShelf = y > h - 190 && x > w * 0.34;
      const inControls = y < 90 && x > w - 430;
      if (inBrand || inShelf || inControls) continue;
      // avoid collisions
      let collides = false;
      for (const p of placements) {
        if (left < p.right + 5 && right > p.left - 5 && top < p.bottom + 2 && top + boxH > p.top - 2) {
          collides = true;
          break;
        }
      }
      if (collides) continue;

      placements.push({ left, right, top, bottom: top + boxH });
      const tx = sideLeft ? anchorX : anchorX;
      rec.el.classList.toggle('is-left', sideLeft);
      rec.el.classList.remove('is-hidden');
      rec.el.classList.toggle('is-focused', this.state.focusKey === c.key);
      rec.el.classList.toggle('is-hover', this.state.hoveredKey === c.key);
      rec.el.style.transform = `translate3d(${tx.toFixed(1)}px, ${(y - boxH / 2).toFixed(1)}px, 0) ${sideLeft ? 'translateX(-100%)' : ''}`;
    }

    // hide any labels that were not part of the candidate set
    for (const rec of this.labelRecords) {
      if (!byKey.has(rec.key)) rec.el.classList.add('is-hidden');
    }
  }

  _project(pos, camera, w, h) {
    this._sunV.copy(pos).project(camera);
    if (this._sunV.z > 1 || this._sunV.z < -1) return null;
    return {
      x: (this._sunV.x * 0.5 + 0.5) * w,
      y: (-this._sunV.y * 0.5 + 0.5) * h,
    };
  }

  setHovered(key) {
    this.state.hoveredKey = key;
    for (const rec of this.labelRecords) {
      rec.el.classList.toggle('is-hover', rec.key === key);
    }
  }

  showCursorTip(key, x, y) {
    const body = BODIES.find((b) => b.key === key);
    if (!body) return;
    if (this._tipKey !== key) {
      this._tipKey = key;
      this.els.tip.innerHTML = `<b>${body.nameZh}</b><span>点击聚焦</span>`;
    }
    this.els.tip.style.transform = `translate3d(${x + 16}px, ${y + 16}px, 0)`;
    this.els.tip.classList.add('is-visible');
  }

  hideCursorTip() {
    this.els.tip.classList.remove('is-visible');
  }

  /* -------------------------------------------------------------- detail */

  showDetail(key) {
    const body = BODIES.find((b) => b.key === key);
    if (!body) return;
    this._setActiveCard(key);
    this.els.dIndex.textContent = key === 'sun' ? '00 / STAR' : `${body.index} / 08`;
    this.els.dName.textContent = body.nameZh;
    this.els.dEn.textContent = body.nameEn.toUpperCase();
    this.els.dType.textContent = `${body.typeLabel} · ${body.typeEn}`;
    this.els.dDesc.textContent = body.description;
    this.els.dGrid.innerHTML = [
      ['半径', `${fmtInt.format(Math.round(body.radiusKm))} km`],
      ['质量', formatMass(body.massEarth)],
      ['自转', formatRotation(body.rotationHours)],
      ['公转', formatPeriod(body.orbitalPeriodDays)],
      ['表面温度', formatTemp(body.meanTempC)],
      ['重力', `${body.gravity.toFixed(1)} m/s²`],
    ]
      .map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`)
      .join('');

    this.els.dLive.innerHTML = `<div><span>${key === 'sun' ? '行星' : '日心距'}</span><b id="live-a">${key === 'sun' ? '8 颗' : '—'}</b></div>
      <div><span>${key === 'sun' ? '质量占比' : '轨道速度'}</span><b id="live-b">${key === 'sun' ? '99.86%' : '—'}</b></div>
      <div><span>${key === 'sun' ? '类型' : '黄经'}</span><b id="live-c">${key === 'sun' ? 'G2V' : '—'}</b></div>`;

    const moons = MOONS[key] ?? [];
    this.els.dMoonsWrap.style.display = key === 'sun' ? 'none' : 'block';
    if (key !== 'sun') {
      const total = body.moons ?? 0;
      if (moons.length) {
        this.els.dMoons.innerHTML =
          moons.map((m) => `<span class="moon-chip">${m.nameEn}</span>`).join('') +
          `<span class="moon-chip count">系统共 ${total} 颗</span>`;
      } else if (total > 0) {
        this.els.dMoons.innerHTML = `<span class="moon-chip none">本次未模拟 · 系统共 ${total} 颗</span>`;
      } else {
        this.els.dMoons.innerHTML = '<span class="moon-chip none">无天然卫星</span>';
      }
    }
    this.els.detail.classList.add('is-open');
    this.els.detail.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-detail');
    const scroll = this.els.detail.querySelector('.detail-scroll');
    if (scroll) scroll.scrollTop = 0;
  }

  hideDetail() {
    this.els.detail.classList.remove('is-open');
    this.els.detail.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('has-detail');
    this._setActiveCard(null);
  }

  updateLive(items) {
    if (!this.els.detail.classList.contains('is-open')) return;
    const arr = ['#live-a', '#live-b', '#live-c'].map((s) => $(s, this.els.detail));
    items.forEach((item, i) => {
      if (arr[i]) arr[i].textContent = item.value;
    });
  }

  /* ------------------------------------------------------------- ephemeris */

  _setTimezoneCaption() {
    const off = -new Date().getTimezoneOffset();
    const sign = off >= 0 ? '+' : '−';
    const abs = Math.abs(off);
    const z = `UTC${sign}${Math.floor(abs / 60)}${abs % 60 ? ':' + pad2(abs % 60) : ''}`;
    this.els.ephCaption.textContent = `本地时间 · ${z} · 开普勒轨道实时推进`;
  }

  setDate(date) {
    this.els.ephDate.textContent = `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;
    this.els.ephTime.textContent = `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
  }

  _updateSpeedUI() {
    const { value, unit } = formatSpeed(this.state.speed);
    this.els.speedValue.textContent = value;
    this.els.speedUnit.textContent = unit;
    this.els.ephStatus.textContent = this.state.playing ? 'RUNNING' : 'HOLD';
    this.els.slider.setAttribute('aria-valuetext', value === '实时' ? '实时' : `${value} ${unit}`);
    const log = Math.log10(clamp(this.state.speed, 0.0000115741, 199.5));
    this.els.slider.value = String(log);
  }

  _updatePresets() {
    const presets = $$('.eph-presets button', this.els.app);
    let best = null;
    let bestDelta = Infinity;
    presets.forEach((b) => {
      const v = Number(b.dataset.days);
      const delta = Math.abs(Math.log(v) - Math.log(this.state.speed));
      if (delta < bestDelta) {
        bestDelta = delta;
        best = b;
      }
    });
    presets.forEach((b) => b.classList.toggle('is-on', b === best && bestDelta < 0.03));
  }

  setSpeed(days, { resume = this.state.playing, silent = false } = {}) {
    this.state.speed = clamp(days, 0.0000115741, 199.5);
    if (resume) this.setPlaying(true, true);
    this._updateSpeedUI();
    this._updatePresets();
    if (!silent) this.opts.onSpeedChange?.(this.state.speed, resume);
  }

  setPlaying(playing, silent = false) {
    this.state.playing = playing;
    document.body.classList.toggle('is-paused', !playing);
    this.els.btnPlay.setAttribute('aria-label', playing ? '暂停时间' : '继续时间');
    this._updateSpeedUI();
    if (!silent) this.opts.onPlayToggle?.(playing);
  }

  togglePlay() {
    this.setPlaying(!this.state.playing);
  }

  setNow() {
    this.opts.onNow?.();
  }

  /* ----------------------------------------------------------------- intro */

  setProgress(p) {
    const pct = Math.round(clamp(p, 0, 0.99) * 100);
    this.els.loaderBar.style.width = `${pct}%`;
    this.els.loaderPct.textContent = `${pct}%`;
    if (!this.state.ready && pct > 8) this.els.loaderLabel.textContent = '正在展开轨道 · ASSEMBLING ORBITS';
  }

  _measureLabels() {
    for (const rec of this.labelRecords) {
      rec.width = rec.el.offsetWidth || 84;
      rec.height = rec.el.offsetHeight || 16;
    }
  }

  markReady() {
    if (this.state.ready) return;
    this.state.ready = true;
    this.els.loaderBar.style.width = '100%';
    this.els.loaderPct.textContent = '100%';
    this.els.loaderLabel.textContent = '星历已同步 · EPHEMERIS READY';
    this.els.enter.disabled = false;
    this.els.intro.classList.add('is-ready');
    requestAnimationFrame(() => this._measureLabels());
  }

  enter() {
    this._enter();
  }

  _enter() {
    if (!this.state.ready || this.state.entered) return;
    this.state.entered = true;
    if (this.els.app) {
      this.els.app.inert = false;
      this.els.app.removeAttribute('aria-hidden');
    }
    const sound = this.els.introSound.checked;
    this.state.soundOn = sound;
    this._setSoundUI(sound);
    this.els.intro.classList.add('is-leaving');
    document.body.classList.add('is-entered');
    setTimeout(() => {
      this.els.intro.style.display = 'none';
    }, 1600);
    this.opts.onEnter?.({ sound });
    this.setDate(new Date());
  }

  /* ------------------------------------------------------------------ misc */

  showToast(msg, ms = 2100) {
    this.els.toast.textContent = msg;
    this.els.toast.classList.add('is-visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.els.toast.classList.remove('is-visible'), ms);
  }

  _setSoundUI(on) {
    this.state.soundOn = on;
    this.els.btnSound.classList.toggle('is-on', on);
    this.els.btnSound.setAttribute('aria-pressed', String(on));
  }

  toggleSound(force) {
    const next = force ?? !this.state.soundOn;
    this._setSoundUI(next);
    this.opts.onSoundToggle?.(next);
    this.showToast(next ? '环境声 · ON' : '环境声 · OFF');
  }

  toggleOrbits(force) {
    const next = force ?? !this.state.orbitsOn;
    this.state.orbitsOn = next;
    this.els.btnOrbits.classList.toggle('is-on', next);
    this.els.btnOrbits.setAttribute('aria-pressed', String(next));
    this.opts.onOrbitsToggle?.(next);
    this.showToast(next ? '轨道线 · 显示' : '轨道线 · 隐藏');
  }

  toggleLabels(force) {
    const next = force ?? !this.state.labelsOn;
    this.state.labelsOn = next;
    this.els.btnLabels.classList.toggle('is-on', next);
    this.els.btnLabels.setAttribute('aria-pressed', String(next));
    document.body.classList.toggle('labels-hidden', !next);
    if (next) this.opts.onLabelsToggle?.(true);
  }

  setTour(on) {
    this.state.tourOn = on;
    const btn = this.els.btnTour;
    if (!btn) return;
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    const label = btn.querySelector('.tour-label');
    if (label) label.textContent = on ? '结束巡游' : '自动巡游';
  }

  toggleUI(force) {
    const next = force ?? !this.state.uiHidden;
    this.state.uiHidden = next;
    document.body.classList.toggle('ui-hidden', next);
    this.els.btnRestore.setAttribute('aria-hidden', String(!next));
    this.opts.onUIToggle?.(next);
  }

  openAbout() {
    this._lastFocus = document.activeElement;
    if (this.els.app) {
      this.els.app.inert = true;
      this.els.app.setAttribute('aria-hidden', 'true');
    }
    if (this.els.about) this.els.about.inert = false;
    const card = this.els.about.querySelector('.modal-card');
    if (card) card.scrollTop = 0;
    this.els.about.classList.add('is-open');
    this.els.about.setAttribute('aria-hidden', 'false');
    this.opts.onAboutToggle?.(true);
    setTimeout(() => document.getElementById('about-close')?.focus(), 120);
  }

  closeAbout() {
    this.els.about.classList.remove('is-open');
    this.els.about.setAttribute('aria-hidden', 'true');
    this.els.about.inert = true;
    if (this.els.app) {
      this.els.app.inert = false;
      this.els.app.removeAttribute('aria-hidden');
    }
    this.opts.onAboutToggle?.(false);
    if (this._lastFocus && typeof this._lastFocus.focus === 'function') this._lastFocus.focus();
  }

  get aboutOpen() {
    return this.els.about.classList.contains('is-open');
  }

  /* ------------------------------------------------------------------- bind */

  _bind() {
    this.els.enter.addEventListener('click', () => this._enter());

    this.els.btnSound.addEventListener('click', () => this.toggleSound());
    this.els.btnOrbits.addEventListener('click', () => this.toggleOrbits());
    this.els.btnLabels.addEventListener('click', () => this.toggleLabels());
    this.els.btnHide.addEventListener('click', () => this.toggleUI(true));
    this.els.btnRestore.addEventListener('click', () => this.toggleUI(false));
    this.els.btnTour?.addEventListener('click', () => {
      const next = !this.state.tourOn;
      this.setTour(next);
      this.opts.onTourToggle?.(next);
    });
    $('#btn-about').addEventListener('click', () => this.openAbout());
    $('#about-close').addEventListener('click', () => this.closeAbout());
    $$('[data-close-modal]').forEach((el) => el.addEventListener('click', () => this.closeAbout()));

    $('#d-close').addEventListener('click', () => this.opts.onOverview?.());
    $('#d-overview').addEventListener('click', () => this.opts.onOverview?.());
    $('#d-next').addEventListener('click', () => this.opts.onNext?.());

    this.els.btnPlay.addEventListener('click', () => this.togglePlay());
    $('#btn-now').addEventListener('click', () => this.setNow());

    this.els.slider.addEventListener('input', (e) => {
      const days = Math.pow(10, Number(e.target.value));
      this.setSpeed(days);
    });
    $$('.eph-presets button', this.els.app).forEach((b) => {
      b.addEventListener('click', () => {
        this.setSpeed(Number(b.dataset.days));
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.aboutOpen) {
        e.preventDefault();
        e.stopPropagation();
        this.closeAbout();
      }
    });
  }
}
