//by YukinX

import { Scene } from './scene.js';
import { Sound } from './audio.js';
import { DEFAULT_SETTINGS } from './store.js';
import { t, setLang, defaultLang } from './i18n.js';

const root = document.documentElement;
const C = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id ? chrome : null;

async function loadSettings() {
  try {
    if (C) {
      const { settings } = await C.storage.sync.get('settings');
      return { ...DEFAULT_SETTINGS, ...(settings || {}) };
    }
  } catch (e) {  }
  return { ...DEFAULT_SETTINGS };
}

function el(tag, attrs = {}, html = '') {
  const e = document.createElement(tag);
  Object.assign(e, attrs);
  if (html) e.innerHTML = html;
  return e;
}

async function start() {
  const S = await loadSettings();
  setLang(S.lang || defaultLang());
  if (!S.googleSkin) { root.classList.remove('anemoia-skin'); return; }
  root.classList.add('anemoia-skin');
  root.classList.toggle('mem-crt', !!S.crt);

  const canvas = el('canvas', { id: 'mem-scene' });
  const shade = el('div', { id: 'mem-shade' });
  const crt = el('div', { id: 'mem-crt' });
  const flash = el('div', { id: 'mem-flash' });
  const query = new URLSearchParams(location.search).get('q') || '';
  const hud = el('div', { id: 'mem-hud' }, `
    <div class="crumb"><span data-go="home">ANEMOIA</span><i>/</i><span data-go="home">${t('search')}</span><i>/</i><span class="q"></span></div>
    <div class="hints">
      <button data-act="enter"><span class="sym x">✕</span><span>${t('hintOpen')}</span></button>
      <button data-act="back"><span class="sym o">○</span><span>${t('hintBack')}</span></button>
      <button data-act="tab"><span class="sym t">△</span><span>${t('hintNewTab')}</span></button>
    </div>
    <div class="right"><button class="mute"></button><div class="clock"></div></div>`);
  hud.querySelector('.q').textContent = query;
  root.append(canvas, shade, crt, flash, hud);

  const scene = new Scene(canvas, { quality: S.quality, lookFollow: 0, towers: S.quality === 'low' ? 40 : 80, dust: S.quality === 'low' ? 180 : 420 });
  scene.playQuick();
  scene.setEmblem({ glyph: 'search' });

  const sound = new Sound(S);
  sound.init();

  function placeRing(snap = false) {
    const vw = innerWidth, vh = innerHeight;
    const col = document.querySelector('#center_col') || document.querySelector('#rcnt') || document.querySelector('#search');
    const rhs = document.querySelector('#rhs');
    let right = col ? col.getBoundingClientRect().right : vw * 0.6;
    if (rhs && rhs.offsetWidth) right = Math.max(right, rhs.getBoundingClientRect().right);
    right = Math.max(0, Math.min(right, vw));
    root.style.setProperty('--mem-col-right', Math.round(right) + 'px');
    const free = vw - right;
    if (free >= 380) {
      scene.setRingScreen(right + free / 2, vh * 0.42, Math.max(0.55, Math.min(1.05, free / 560)), snap);
    } else {
      scene.setRingScreen(vw - 96, vh - 190, 0.36, snap);
    }
  }
  placeRing(true);
  addEventListener('resize', () => placeRing());
  setTimeout(() => placeRing(), 600);

  let results = [];
  let sel = -1;

  function scan() {
    const heads = document.querySelectorAll('#search a h3, #botstuff a h3');
    const found = [];
    heads.forEach((h) => {
      const a = h.closest('a');
      if (!a || !/^https?:/.test(a.href)) return;
      let box = a;
      while (box.parentElement && box.parentElement.id !== 'rso' && box.parentElement.id !== 'search'
        && box.parentElement.querySelectorAll('a h3').length === 1) box = box.parentElement;
      if (found.some((r) => r.box === box)) return;
      box.classList.add('mem-res');
      found.push({ box, a });
    });
    const prev = results[sel];
    results = found;
    sel = prev ? results.findIndex((r) => r.box === prev.box) : -1;
    updateHints();
  }

  function updateHints() {
    const has = sel >= 0;
    hud.querySelector('[data-act="enter"]').classList.toggle('off', !has);
    hud.querySelector('[data-act="tab"]').classList.toggle('off', !has);
  }

  function select(i, { scroll = true, quiet = false } = {}) {
    if (i === sel || !results[i]) return;
    const dir = i > sel ? 1 : -1;
    if (results[sel]) results[sel].box.classList.remove('mem-sel');
    sel = i;
    const r = results[i];
    r.box.classList.add('mem-sel');
    scene.setEmblem({ url: r.a.href });
    if (!quiet) { sound.tick(dir); scene.kick(dir); }
    if (scroll) r.box.scrollIntoView({ block: 'center', behavior: 'smooth' });
    updateHints();
  }

  function move(d) {
    if (!results.length) { scan(); if (!results.length) return; }
    if (sel < 0) {
      let first = results.findIndex((r) => r.box.getBoundingClientRect().bottom > 90);
      if (first < 0) first = 0;
      select(first);
      return;
    }
    const ni = Math.max(0, Math.min(results.length - 1, sel + d));
    if (ni === sel) { sound.bump(); return; }
    select(ni);
  }

  function openUrl(url, newTab = false) {
    if (newTab) {
      if (C) C.runtime.sendMessage({ type: 'openTab', url });
      else window.open(url, '_blank', 'noopener');
      sound.tick(1); scene.pulse('tap');
      return;
    }
    sound.open();
    scene.pulse('out');
    flash.classList.add('go');
    setTimeout(() => { location.href = url; }, 230);
    setTimeout(() => flash.classList.remove('go'), 1600);
  }

  function goBack() {
    sound.back();
    scene.pulse('out');
    if (history.length > 1) history.back();
    else goHome();
  }

  function goHome() {
    flash.classList.add('go');
    if (C) C.runtime.sendMessage({ type: 'home' });
  }

  scan();
  let scanTimer = 0;
  new MutationObserver(() => { clearTimeout(scanTimer); scanTimer = setTimeout(() => { scan(); placeRing(); }, 250); })
    .observe(document.body, { childList: true, subtree: true });

  document.addEventListener('mouseover', (e) => {
    const box = e.target.closest && e.target.closest('.mem-res');
    if (!box) return;
    const i = results.findIndex((r) => r.box === box);
    if (i >= 0) select(i, { scroll: false, quiet: true });
  }, { passive: true });

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || !a.closest('.mem-res') || !/^https?:/.test(a.href)) return;
    if (a.target === '_blank') return;
    e.preventDefault();
    e.stopPropagation();
    openUrl(a.href);
  }, true);

  const isTyping = (t) => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  addEventListener('keydown', (e) => {
    if (isTyping(e.target)) {
      if (e.key === 'Escape') setTimeout(() => e.target.blur(), 0);
      return;
    }
    if (e.metaKey && e.key !== 'Enter') return;
    if (e.ctrlKey && e.key !== 'Enter') return;
    if (e.altKey) return;
    const cur = results[sel];
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); e.stopPropagation(); move(1); return;
      case 'ArrowUp': e.preventDefault(); e.stopPropagation(); move(-1); return;
      case 'Enter':
        if (cur) { e.preventDefault(); e.stopPropagation(); openUrl(cur.a.href, e.metaKey || e.ctrlKey); }
        return;
      case 'Tab':
        if (cur && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); openUrl(cur.a.href, true); }
        return;
      case 'Escape': e.preventDefault(); goBack(); return;
      default:

        if (e.key.length === 1 && e.key !== ' ' && e.key !== '/') {
          const box = document.querySelector('textarea[name="q"], input[name="q"]');
          if (box) { box.focus(); box.select(); sound.tick(1); }
        }
    }
  }, true);

  let lastY = scrollY;
  addEventListener('scroll', () => { scene.nudge((scrollY - lastY) * 0.004); lastY = scrollY; }, { passive: true });

  hud.addEventListener('click', (e) => {
    if (e.target.closest('[data-go="home"]')) { sound.back(); goHome(); return; }
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('mute')) { S.muted = !S.muted; saveSetting('muted', S.muted); renderMute(); sound.applySettings(); return; }
    const cur = results[sel];
    if (b.dataset.act === 'enter' && cur) openUrl(cur.a.href);
    if (b.dataset.act === 'tab' && cur) openUrl(cur.a.href, true);
    if (b.dataset.act === 'back') goBack();
  });

  const muteBtn = hud.querySelector('.mute');
  function renderMute() { muteBtn.textContent = S.muted ? t('soundOff') : t('sound'); muteBtn.classList.toggle('is-muted', !!S.muted); }
  renderMute();

  async function saveSetting(key, value) {
    if (!C) return;
    try {
      const { settings } = await C.storage.sync.get('settings');
      await C.storage.sync.set({ settings: { ...DEFAULT_SETTINGS, ...(settings || {}), [key]: value } });
    } catch (e) {  }
  }

  const clock = hud.querySelector('.clock');
  const tickClock = () => { const d = new Date(); clock.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  tickClock();
  setInterval(tickClock, 5000);

  if (C) {
    C.storage.onChanged.addListener((ch, area) => {
      if (area !== 'sync' || !ch.settings) return;
      Object.assign(S, ch.settings.newValue || {});
      root.classList.toggle('anemoia-skin', !!S.googleSkin);
      root.classList.toggle('mem-crt', !!S.crt);
      sound.applySettings();
      renderMute();
    });
  }

  addEventListener('pageshow', () => flash.classList.remove('go'));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
