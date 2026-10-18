/**
 * SOLARIS — bilingual interface
 * One instrument, two complete languages. The chosen language is persisted in
 * localStorage and reflected in the URL (`?lang=en`) so it can be shared.
 *
 * The Chinese edition keeps English as a scientific annotation; the English
 * edition uses Latin names as its second voice.
 */

const STORAGE_KEY = 'solaris.lang';
const LANGS = ['zh', 'en'];

export const STRINGS = {
  zh: {
    'meta.title': 'SOLARIS · 太阳系观测档案',
    'meta.description':
      'SOLARIS 是一座由 JPL 星历驱动的交互式太阳系仪。八颗行星沿开普勒轨道运行，光、影与时间在此真实发生。',

    'lang.short': 'EN',
    'lang.toggleAria': '切换到英文',
    'lang.toggleTitle': '切换到英文（E）',
    'stage.aria': '太阳系三维模拟',

    'brand.eyebrow': '实时太阳系',
    'brand.titleMain': '太阳系观测档案',
    'brand.titleSub': 'THE SOLAR ATLAS',
    'brand.lede':
      '以真实星历驱动的太阳系仪。八颗行星沿着开普勒轨道运行，光、影与时间在此真实发生。',
    'stats.planets': '行星',
    'stats.moons': '卫星',
    'stats.live': 'LIVE 星历',

    'nav.aria': '视图控制',
    'ctl.sound': '声音',
    'ctl.soundAria': '环境声',
    'ctl.soundTitle': '环境声（S）',
    'ctl.orbits': '轨道',
    'ctl.orbitsAria': '轨道线',
    'ctl.orbitsTitle': '轨道线（O）',
    'ctl.labels': '标注',
    'ctl.labelsAria': '行星标注',
    'ctl.labelsTitle': '行星标注（L）',
    'ctl.about': '关于',
    'ctl.aboutAria': '关于',
    'ctl.aboutTitle': '关于（?）',
    'ctl.hide': '隐藏',
    'ctl.hideAria': '隐藏界面',
    'ctl.hideTitle': '隐藏界面（H）',

    'card.focus': '聚焦{name}',

    'detail.closeAria': '关闭档案',
    'detail.moonsTitle': '模拟卫星 · SELECTED MOONS',
    'detail.overview': '返回全景',
    'detail.next': '下一颗',
    'detail.stats.radius': '半径',
    'detail.stats.mass': '质量',
    'detail.stats.rotation': '自转',
    'detail.stats.period': '公转',
    'detail.stats.temp': '表面温度',
    'detail.stats.gravity': '重力',
    'detail.live.distance': '日心距',
    'detail.live.speed': '轨道速度',
    'detail.live.longitude': '黄经',
    'detail.live.planets': '行星',
    'detail.live.massShare': '质量占比',
    'detail.live.type': '类型',
    'detail.live.planetCount': '8 颗',
    'detail.moons.total': '系统共 {n} 颗',
    'detail.moons.notSimulated': '本次未模拟 · 系统共 {n} 颗',
    'detail.moons.none': '无天然卫星',

    'hint': '拖拽环视 · 滚轮缩放 · 点击行星聚焦',
    'tips.focus': '点击聚焦',

    'ephemeris.aria': '星历与时间控制',
    'ephemeris.secondary': '星历',
    'ephemeris.caption': '本地时间 · {tz} · 开普勒轨道实时推进',
    'ephemeris.pauseAria': '暂停时间',
    'ephemeris.resumeAria': '继续时间',
    'ephemeris.now': '此刻',
    'ephemeris.sliderAria': '模拟速度',
    'ephemeris.presetReal': '实时',
    'ephemeris.presetHour': '1时',
    'ephemeris.presetDay': '1天',
    'ephemeris.presetWeek': '1周',
    'ephemeris.presetMonth': '1月',

    'shelf.aria': '行星档案',
    'shelf.title': '行星档案',
    'shelf.hint': '点击行星 · 聚焦档案',
    'tour.ariaOff': '自动巡游九站',
    'tour.ariaOn': '结束自动巡游',
    'tour.titleOff': '自动巡游九站',
    'tour.titleOn': '结束自动巡游',
    'tour.labelOff': '自动巡游',
    'tour.labelOn': '结束巡游',
    'tour.emOff': 'GRAND TOUR',
    'tour.emOn': 'GRAND TOUR',
    'restore': '显示界面',

    'intro.eyebrow': '交互式太阳系仪',
    'intro.subMain': '太阳系观测档案',
    'intro.subSub': 'THE SOLAR ATLAS',
    'intro.desc':
      '八颗行星，一颗恒星，一场以刻为尺的漫游。轨道由 JPL 星历实时推算——拖动时间，看水星疾行、土星缓步，而光与影永远真实。',
    'intro.enter': '进入观测',
    'intro.enterSub': 'ENTER THE ORRERY',
    'intro.sound': '环境声 <em>AMBIENT</em>',

    'loader.calibrating': '正在校准星历',
    'loader.assembling': '正在展开轨道 · ASSEMBLING ORBITS',
    'loader.ready': '星历已同步 · EPHEMERIS READY',

    'about.closeAria': '关闭关于面板',
    'about.title': '关于这座太阳系仪',
    'about.lede':
      'SOLARIS 是一次关于尺度、光与时间的凝视。行星的位置并非装饰性的循环动画，而是由 JPL 的近似轨道根数逐帧推算而来——打开时，你看见的就是此刻天空中的真实排列。',
    'about.controls': '操作',
    'about.scale': '比例与真实',
    'about.scaleP1':
      '为了让人眼同时看见内行星与海王星，日心距经过单调压缩，行星半径亦被放大。轨道形状、偏心率、倾角、周期与相位则保持真实。时间可以任意加速；行星自转在视觉上被温和地减缓，以免高频闪烁。',
    'about.scaleP2':
      '位置模型的适用区间为 1800 — 2050 年。它不是精密星历，但足以忠实呈现一场人类尺度上的行星之舞。',
    'about.credits': '数据与图像',
    'about.creditsP1':
      '轨道根数：JPL Solar System Dynamics — <em>Approximate Positions of the Planets</em>（E. M. Standish）。物理参数参考 NASA Planetary Fact Sheets。行星与土星环纹理：Solar System Scope（CC BY 4.0）；地球高光图：three.js examples（MIT）；银河为程序化着色器。渲染与界面使用 three.js r170。',
    'about.creditsP2':
      '所有运动由本地代码推演，无外部数据请求。银河为艺术化背景，非可导航的星系地图。',
    'about.key.drag': '拖拽',
    'about.val.drag': '环绕视角',
    'about.key.wheel': '滚轮',
    'about.val.wheel': '推近 / 拉远',
    'about.key.click': '点击行星',
    'about.val.click': '进入聚焦视角',
    'about.key.space': 'Space',
    'about.val.space': '暂停 / 继续时间',
    'about.key.numbers': '1 — 8',
    'about.val.numbers': '聚焦水星至海王星',
    'about.key.zero': '0',
    'about.val.zero': '聚焦太阳',
    'about.key.esc': 'Esc',
    'about.val.esc': '返回全景',
    'about.key.toggles': 'O / L / S / H',
    'about.val.toggles': '轨道 / 标注 / 声音 / 隐藏界面',
    'about.key.lang': 'E',
    'about.val.lang': '切换语言',
    'about.key.now': 'N',
    'about.val.now': '回到此刻',
    'about.key.about': '?',
    'about.val.about': '关于面板',

    'fatal.title': '无法启动观测',
    'fatal.msg': '这台设备或浏览器未能创建 WebGL 2 上下文。',
    'fatal.hint':
      '请使用最新版 Chrome / Edge / Safari，并通过本地服务器打开本页面（Windows 运行 <code>start.cmd</code>，macOS / Linux 运行 <code>./start.sh</code>）。',

    'toast.tourStart': '自动巡游 · GRAND TOUR',
    'toast.tourEnd': '巡游结束 · 回到全景',
    'toast.tourStop': '巡游已停止',
    'toast.now': '已回到此刻 · NOW',
    'toast.lang': '语言 · 中文',
    'toast.soundOn': '环境声 · ON',
    'toast.soundOff': '环境声 · OFF',
    'toast.orbitsOn': '轨道线 · 显示',
    'toast.orbitsOff': '轨道线 · 隐藏',

    'speed.realtime': '实时',
    'speed.secPerSec': '秒 / 秒',
    'speed.minPerSec': '分 / 秒',
    'speed.hourPerSec': '时 / 秒',
    'speed.dayPerSec': '天 / 秒',
    'speed.monthPerSec': '月 / 秒',
    'speed.yearPerSec': '年 / 秒',
    'rotation.hours': '{n} 小时',
    'rotation.days': '{n} 天',
    'rotation.retro': ' · 逆行',
    'period.days': '{n} 天',
    'period.years': '{n} 年',
  },

  en: {
    'meta.title': 'SOLARIS · The Solar Atlas',
    'meta.description':
      'SOLARIS is an interactive orrery driven by JPL ephemerides. Eight planets follow their Keplerian orbits while light, shadow and time unfold as they truly do.',

    'lang.short': 'ZH',
    'lang.toggleAria': 'Switch to Chinese',
    'lang.toggleTitle': 'Switch to Chinese (E)',
    'stage.aria': 'Interactive 3D solar system',

    'brand.eyebrow': 'REAL-TIME EPHEMERIS',
    'brand.titleMain': 'THE SOLAR ATLAS',
    'brand.titleSub': 'SOLAR SYSTEM OBSERVATORY',
    'brand.lede':
      'An orrery driven by real ephemerides. Eight planets follow their Keplerian orbits while light, shadow and time unfold as they truly do.',
    'stats.planets': 'PLANETS',
    'stats.moons': 'MOONS',
    'stats.live': 'LIVE EPHEMERIS',

    'nav.aria': 'View controls',
    'ctl.sound': 'Sound',
    'ctl.soundAria': 'Ambient sound',
    'ctl.soundTitle': 'Ambient sound (S)',
    'ctl.orbits': 'Orbits',
    'ctl.orbitsAria': 'Orbit lines',
    'ctl.orbitsTitle': 'Orbit lines (O)',
    'ctl.labels': 'Labels',
    'ctl.labelsAria': 'Planet labels',
    'ctl.labelsTitle': 'Planet labels (L)',
    'ctl.about': 'About',
    'ctl.aboutAria': 'About',
    'ctl.aboutTitle': 'About (?)',
    'ctl.hide': 'Hide',
    'ctl.hideAria': 'Hide interface',
    'ctl.hideTitle': 'Hide interface (H)',

    'card.focus': 'Focus {name}',

    'detail.closeAria': 'Close dossier',
    'detail.moonsTitle': 'SELECTED MOONS',
    'detail.overview': 'Overview',
    'detail.next': 'Next',
    'detail.stats.radius': 'Radius',
    'detail.stats.mass': 'Mass',
    'detail.stats.rotation': 'Rotation',
    'detail.stats.period': 'Orbit',
    'detail.stats.temp': 'Surface temp.',
    'detail.stats.gravity': 'Gravity',
    'detail.live.distance': 'Distance',
    'detail.live.speed': 'Orbital speed',
    'detail.live.longitude': 'Longitude',
    'detail.live.planets': 'Planets',
    'detail.live.massShare': 'Mass share',
    'detail.live.type': 'Type',
    'detail.live.planetCount': '8',
    'detail.moons.total': '{n} in system',
    'detail.moons.notSimulated': 'Not simulated here · {n} in system',
    'detail.moons.none': 'No natural satellites',

    'hint': 'Drag to orbit · Scroll to zoom · Click a planet',
    'tips.focus': 'Click to focus',

    'ephemeris.aria': 'Ephemeris and time controls',
    'ephemeris.secondary': 'LOCAL TIME',
    'ephemeris.caption': 'Local time · {tz} · Keplerian orbits',
    'ephemeris.pauseAria': 'Pause time',
    'ephemeris.resumeAria': 'Resume time',
    'ephemeris.now': 'Now',
    'ephemeris.sliderAria': 'Simulation speed',
    'ephemeris.presetReal': 'REAL',
    'ephemeris.presetHour': '1H',
    'ephemeris.presetDay': '1D',
    'ephemeris.presetWeek': '1W',
    'ephemeris.presetMonth': '1M',

    'shelf.aria': 'Planetary archive',
    'shelf.title': 'Planetary Archive',
    'shelf.hint': 'Click a planet · Open its dossier',
    'tour.ariaOff': 'Tour all nine stations',
    'tour.ariaOn': 'End the grand tour',
    'tour.titleOff': 'Tour all nine stations',
    'tour.titleOn': 'End the grand tour',
    'tour.labelOff': 'GRAND TOUR',
    'tour.labelOn': 'END TOUR',
    'tour.emOff': 'AUTO TOUR',
    'tour.emOn': 'AUTO TOUR',
    'restore': 'Show interface',

    'intro.eyebrow': 'SOLAR SYSTEM OBSERVATORY',
    'intro.subMain': 'THE SOLAR ATLAS',
    'intro.subSub': 'SOLAR SYSTEM OBSERVATORY',
    'intro.desc':
      'Eight planets, one star, and a journey measured in moments. Their orbits are solved live from JPL ephemerides — drag through time and watch Mercury race, Saturn drift, while light and shadow stay true.',
    'intro.enter': 'ENTER THE ORRERY',
    'intro.enterSub': 'SOLAR SYSTEM OBSERVATORY',
    'intro.sound': 'Ambient sound <em>AMBIENT</em>',

    'loader.calibrating': 'CALIBRATING EPHEMERIS',
    'loader.assembling': 'ASSEMBLING ORBITS',
    'loader.ready': 'EPHEMERIS READY',

    'about.closeAria': 'Close about panel',
    'about.title': 'About this Orrery',
    'about.lede':
      'SOLARIS is a meditation on scale, light and time. The planets are not looping ornaments: their positions are solved frame by frame from JPL’s approximate Keplerian elements. When you open it, you are seeing the real arrangement of the sky at this moment.',
    'about.controls': 'Controls',
    'about.scale': 'Scale & Truth',
    'about.scaleP1':
      'So that the inner planets and Neptune can share the same frame, heliocentric distances are monotonically compressed and planetary radii enlarged. Orbital shapes, eccentricities, inclinations, periods and phases remain true. Time may be accelerated freely; planetary rotation is gently slowed in the visuals to avoid high-frequency flicker.',
    'about.scaleP2':
      'The position model is valid from 1800 to 2050. It is not a precision ephemeris, but it is faithful enough to stage a planetary dance on a human scale.',
    'about.credits': 'Data & Imagery',
    'about.creditsP1':
      'Orbital elements: JPL Solar System Dynamics — <em>Approximate Positions of the Planets</em> (E. M. Standish). Physical parameters: NASA Planetary Fact Sheets. Planet and ring textures: Solar System Scope (CC BY 4.0); Earth specular map: three.js examples (MIT); the Milky Way is a procedural shader. Rendering and interface: three.js r170.',
    'about.creditsP2':
      'All motion is computed locally; no external data requests. The Milky Way is an artistic backdrop, not a navigable map of the galaxy.',
    'about.key.drag': 'Drag',
    'about.val.drag': 'Orbit the camera',
    'about.key.wheel': 'Scroll',
    'about.val.wheel': 'Zoom in / out',
    'about.key.click': 'Click a planet',
    'about.val.click': 'Enter its focused view',
    'about.key.space': 'Space',
    'about.val.space': 'Pause / resume time',
    'about.key.numbers': '1 — 8',
    'about.val.numbers': 'Focus Mercury through Neptune',
    'about.key.zero': '0',
    'about.val.zero': 'Focus the Sun',
    'about.key.esc': 'Esc',
    'about.val.esc': 'Return to overview',
    'about.key.toggles': 'O / L / S / H',
    'about.val.toggles': 'Orbits / labels / sound / hide interface',
    'about.key.lang': 'E',
    'about.val.lang': 'Switch language',
    'about.key.now': 'N',
    'about.val.now': 'Return to now',
    'about.key.about': '?',
    'about.val.about': 'About panel',

    'fatal.title': 'Observation could not begin',
    'fatal.msg': 'This device or browser could not create a WebGL 2 context.',
    'fatal.hint':
      'Please use the latest Chrome / Edge / Safari and open this page through a local server (Windows: run <code>start.cmd</code>; macOS / Linux: run <code>./start.sh</code>).',

    'toast.tourStart': 'GRAND TOUR · AUTOMATIC',
    'toast.tourEnd': 'Tour complete · Back to overview',
    'toast.tourStop': 'Tour stopped',
    'toast.now': 'Returned to now · NOW',
    'toast.lang': 'Language · English',
    'toast.soundOn': 'Ambient sound · ON',
    'toast.soundOff': 'Ambient sound · OFF',
    'toast.orbitsOn': 'Orbits · shown',
    'toast.orbitsOff': 'Orbits · hidden',

    'speed.realtime': 'REAL',
    'speed.secPerSec': 's / s',
    'speed.minPerSec': 'min / s',
    'speed.hourPerSec': 'hr / s',
    'speed.dayPerSec': 'd / s',
    'speed.monthPerSec': 'mo / s',
    'speed.yearPerSec': 'yr / s',
    'rotation.hours': '{n} h',
    'rotation.days': '{n} d',
    'rotation.retro': ' · retrograde',
    'period.days': '{n} d',
    'period.years': '{n} yr',
  },
};

let lang = 'zh';
let initialized = false;
const listeners = new Set();

function normalize(value) {
  return LANGS.includes(value) ? value : null;
}

function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (_, key) => (vars[key] == null ? '' : String(vars[key])));
}

function detect() {
  let param = null;
  try {
    param = normalize(new URLSearchParams(window.location.search).get('lang'));
  } catch {}
  if (param) return { lang: param, source: 'url' };

  let stored = null;
  try {
    stored = normalize(localStorage.getItem(STORAGE_KEY));
  } catch {}
  if (stored) return { lang: stored, source: 'storage' };

  const nav = (navigator.languages?.[0] || navigator.language || 'zh').toLowerCase();
  return { lang: nav.startsWith('zh') ? 'zh' : 'en', source: 'navigator' };
}

function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const value = t(el.dataset.i18n);
    if (value != null) el.textContent = value;
  });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const value = t(el.dataset.i18nHtml);
    if (value != null) el.innerHTML = value;
  });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const value = t(el.dataset.i18nAria);
    if (value != null) el.setAttribute('aria-label', value);
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const value = t(el.dataset.i18nTitle);
    if (value != null) el.setAttribute('title', value);
  });
}

function applyDocumentMeta() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.documentElement.dataset.lang = lang;
  document.title = t('meta.title');

  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', t('meta.description'));
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', t('meta.title'));
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription) ogDescription.setAttribute('content', t('meta.description'));
}

export function getLang() {
  return lang;
}

export function isZh() {
  return lang === 'zh';
}

export function t(key, vars) {
  const value = STRINGS[lang]?.[key] ?? STRINGS.zh[key] ?? key;
  return interpolate(value, vars);
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setLang(next, { persist = true, syncUrl = true, silent = false } = {}) {
  const normalized = normalize(next) || 'zh';
  const changed = normalized !== lang;
  lang = normalized;

  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
  }

  if (syncUrl) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', lang);
      window.history.replaceState(null, '', url);
    } catch {}
  }

  applyDocumentMeta();
  applyStatic();

  if (changed && !silent) listeners.forEach((fn) => fn(lang));
}

export function initI18n() {
  const detected = detect();
  lang = detected.lang;
  initialized = true;

  if (detected.source === 'url') {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
  }

  applyDocumentMeta();
  applyStatic();
  return lang;
}

export function toggleLang() {
  setLang(lang === 'zh' ? 'en' : 'zh');
  return lang;
}

/* ------------------------------------------------------------- body helpers */

/** Primary display name: 水星 / Mercury. */
export function bodyName(body) {
  return lang === 'zh' ? body.nameZh : body.nameEn;
}

/** Small second line: MERCURY / MERCURIUS, SOL / SOL. */
export function bodySub(body) {
  if (lang === 'zh') return body.nameZhSub ?? body.nameEn.toUpperCase();
  return body.nameLatin ?? body.nameEn.toUpperCase();
}

/** Classification line: 类地行星 · TERRESTRIAL / Terrestrial planet. */
export function bodyType(body) {
  return lang === 'zh' ? `${body.typeLabel} · ${body.typeEn}` : body.typeLabelEn ?? body.typeEn;
}

/** Prose description for the dossier. */
export function bodyDescription(body) {
  return lang === 'zh' ? body.description : body.descriptionEn ?? body.description;
}

/** Short Chinese moon name: 木卫一 · 伊奥 → 伊奥. */
export function moonShortZh(moon) {
  return moon.nameZh.split('·').pop().trim();
}

/** Moon name used by dossier chips (kept in Latin script in both editions). */
export function moonChipName(moon) {
  return moon.nameEn;
}

/** Primary 3D label for a moon. */
export function moonLabelPrimary(moon) {
  return lang === 'zh' ? moon.nameEn.toUpperCase() : moon.nameEn;
}

/** Secondary 3D label for a moon (only in the Chinese edition). */
export function moonLabelSecondary(moon) {
  return lang === 'zh' ? moonShortZh(moon) : '';
}

/** Moon description, reserved for future dossiers. */
export function moonDescription(moon) {
  return lang === 'zh' ? moon.desc : moon.descEn ?? moon.desc;
}
