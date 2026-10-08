//by YukinX

import { Scene } from './scene.js';
import { Sound } from './audio.js';
import { Menu } from './menu.js';
import { rootNode } from './menus.js';
import { loadState, saveState, onExternalChange, introAlreadyShown } from './store.js';
import { t, setLang, getLang, defaultLang } from './i18n.js';
import { navigate, openInNewTab, searchWeb, looksLikeUrl, normalizeUrl, host } from './browser.js';

const $ = (s) => document.querySelector(s);
const body = document.body;

function applyTexts() {
  document.documentElement.lang = getLang();
  document.title = t('newTabTitle');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
}

async function boot() {
  window.focus();
  const state = await loadState();
  const S = state.settings;
  if (!S.lang) S.lang = defaultLang();
  setLang(S.lang);
  applyTexts();
  body.classList.toggle('crt', !!S.crt);

  let introRunning = false;
  let introTimers = [];

  const scene = new Scene($('#scene'), { quality: S.quality });
  const sound = new Sound(S);
  sound.init();

  const app = {
    state, scene, sound, menu: null,
    save: () => saveState(state),
    overlay: null,
    leaving: false,

    onNode(node) { scene.setAccent(node.accent || 0x5aa8ff); },

    onSelect(item) {
      if (!item) return;
      scene.setEmblem(item.url ? { url: item.url } : { glyph: item.glyph || (item.kind === 'folder' ? 'folder' : 'orb') });
      $('#hints [data-act="edit"]').classList.toggle('off', !item.editable);
      $('#hints [data-act="enter"]').classList.toggle('off', item.kind === 'empty');
    },

    openUrl(url, { newTab = false } = {}) {
      if (newTab) { openInNewTab(url); sound.tick(1); scene.pulse('tap'); return; }
      if (app.leaving) return;
      app.leaving = true;
      sound.open();
      scene.pulse('out');
      $('#flash').classList.add('go');
      setTimeout(() => navigate(url), 260);

      setTimeout(() => { $('#flash').classList.remove('go'); app.leaving = false; }, 1500);
    },

    openSearch(initial = '') {
      const ov = $('#search');
      const input = ov.querySelector('input');
      input.value = initial;
      showOverlay(ov);
      sound.enter();
      scene.pulse('in');
      requestAnimationFrame(() => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); });
    },

    openForm(index) {
      const ov = $('#form');
      const form = ov.querySelector('form');
      const site = index == null ? { title: '', url: '' } : state.sites[index];
      form.title.value = site.title;
      form.url.value = site.url;
      form.dataset.index = index == null ? '' : String(index);
      ov.querySelector('.label').textContent = index == null ? t('newSite') : t('editSite');
      showOverlay(ov);
      sound.enter();
      requestAnimationFrame(() => form.title.focus());
    },

    async moveSite(i, dir, fromEditMenu = false) {
      const j = i + dir;
      if (j < 0 || j >= state.sites.length) { sound.bump(); return; }
      const [s] = state.sites.splice(i, 1);
      state.sites.splice(j, 0, s);
      app.save();
      if (fromEditMenu) {
        app.menu.stack[app.menu.stack.length - 2].index = j;
        await app.menu.back();
      } else {
        await app.menu.refresh(j);
        sound.tick(dir);
      }
    },

    async deleteSite(i) {
      state.sites.splice(i, 1);
      app.save();
      app.menu.stack[app.menu.stack.length - 3].index = Math.max(0, i - 1);
      await app.menu.back(2);
    },

    async setSetting(key, value) {
      S[key] = value;
      app.save();
      if (key === 'crt') body.classList.toggle('crt', !!value);
      if (key === 'uiSound' || key === 'ambient' || key === 'volume' || key === 'muted') sound.applySettings();
      if (key === 'muted') renderMute();
      if (key === 'quality') setTimeout(() => location.reload(), 350);
    },

    async setLang(lang) {
      if (lang === getLang()) return;
      S.lang = lang;
      setLang(lang);
      app.save();
      applyTexts();
      renderMute();
      renderLang();
      fmtDate = makeDateFormat();
      tickClock();
      await app.menu.rebuild(rootNode(app));
    },
  };

  function showOverlay(ov) {
    app.overlay = ov;
    ov.hidden = false;
    requestAnimationFrame(() => ov.classList.add('show'));
  }
  function hideOverlay(playSound = true) {
    const ov = app.overlay;
    if (!ov) return;
    app.overlay = null;
    ov.classList.remove('show');
    setTimeout(() => { if (app.overlay !== ov) ov.hidden = true; }, 230);
    document.activeElement && document.activeElement.blur();
    if (playSound) { sound.back(); scene.pulse('out'); }
  }

  $('#search input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const text = e.target.value.trim();
      if (!text) return;
      e.preventDefault();
      if (looksLikeUrl(text)) app.openUrl(normalizeUrl(text));
      else {
        sound.open();
        $('#flash').classList.add('go');
        setTimeout(() => searchWeb(text), 220);
      }
    }
  });
  $('#search').addEventListener('pointerdown', (e) => { if (e.target.id === 'search') hideOverlay(); });

  const form = $('#form form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = form.title.value.trim();
    const url = normalizeUrl(form.url.value);
    if (!url) { sound.bump(); form.url.focus(); return; }
    const site = { title: title || host(url), url };
    const idx = form.dataset.index;
    let target;
    if (idx === '') { state.sites.push(site); target = state.sites.length - 1; }
    else { state.sites[+idx] = site; target = +idx; }
    app.save();
    hideOverlay(false);
    sound.enter();

    if (idx !== '' && app.menu.stack.length > 2) {
      app.menu.stack[app.menu.stack.length - 2].index = target;
      await app.menu.back();
    } else {
      await app.menu.refresh(target);
    }
  });
  form.querySelector('[data-cancel]').addEventListener('click', () => hideOverlay());
  $('#form').addEventListener('pointerdown', (e) => { if (e.target.id === 'form') hideOverlay(); });

  const menu = app.menu = new Menu(app);
  await menu.push(rootNode(app));

  window.addEventListener('keydown', (e) => {
    if (app.overlay) {
      if (e.key === 'Escape') { e.preventDefault(); hideOverlay(); }
      return;
    }
    if (introRunning) { e.preventDefault(); finishIntro(true); return; }
    const k = e.key;
    const item = menu.item;
    if ((k === 'ArrowDown' || k === 'ArrowUp') && e.shiftKey && item && item.editable) {
      e.preventDefault();
      app.moveSite(item.siteIndex, k === 'ArrowDown' ? 1 : -1);
      return;
    }
    switch (k) {
      case 'ArrowDown': e.preventDefault(); menu.move(1); return;
      case 'ArrowUp': e.preventDefault(); menu.move(-1); return;
      case 'PageDown': e.preventDefault(); menu.move(5); return;
      case 'PageUp': e.preventDefault(); menu.move(-5); return;
      case 'Home': e.preventDefault(); menu.jump('start'); return;
      case 'End': e.preventDefault(); menu.jump('end'); return;
      case 'Enter': e.preventDefault(); menu.activate(menu.index, e); return;
      case 'ArrowRight':
        e.preventDefault();
        menu.adjust(1).then((done) => { if (!done && item && item.kind === 'folder') menu.activate(); });
        return;
      case 'ArrowLeft':
        e.preventDefault();
        menu.adjust(-1).then((done) => { if (!done) menu.back(); });
        return;
      case 'Escape': case 'Backspace': e.preventDefault(); menu.back(); return;
      case 'Tab': e.preventDefault(); menu.edit(); return;
      default:

        if (k.length === 1 && k !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          app.openSearch(k);
        }
    }
  });

  let acc = 0, accTimer = 0;
  window.addEventListener('wheel', (e) => {
    if (app.overlay || introRunning) return;
    e.preventDefault();
    acc += e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
    clearTimeout(accTimer);
    accTimer = setTimeout(() => { acc = 0; }, 180);
    const step = 55;
    while (acc >= step) { menu.move(1); acc -= step; }
    while (acc <= -step) { menu.move(-1); acc += step; }
  }, { passive: false });

  window.addEventListener('mouseup', (e) => { if (e.button === 3 && !app.overlay) { e.preventDefault(); menu.back(); } });

  $('#hints').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'enter') menu.activate();
    if (b.dataset.act === 'back') menu.back();
    if (b.dataset.act === 'edit') menu.edit();
  });

  const muteBtn = $('#mute');
  function renderMute() {
    muteBtn.textContent = S.muted ? t('soundOff') : t('sound');
    muteBtn.classList.toggle('off', !!S.muted);
  }
  renderMute();
  muteBtn.addEventListener('click', () => app.setSetting('muted', !S.muted));

  const langEl = $('#lang');
  function renderLang() {
    langEl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.lang === getLang()));
  }
  renderLang();
  langEl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.dataset.lang === getLang()) return;
    sound.enter();
    scene.pulse('tap');
    app.setLang(b.dataset.lang);
  });

  const timeEl = $('#clock .time'), dateEl = $('#clock .date');
  const makeDateFormat = () => new Intl.DateTimeFormat(t('locale'), { weekday: 'long', day: 'numeric', month: 'long' });
  let fmtDate = makeDateFormat();
  function tickClock() {
    const d = new Date();
    timeEl.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    dateEl.textContent = fmtDate.format(d);
  }
  tickClock();
  setInterval(tickClock, 1000);

  onExternalChange(({ sites, settings }) => {
    if (sites) state.sites = sites;
    if (settings) {
      const prevLang = getLang();
      Object.assign(S, settings);
      body.classList.toggle('crt', !!S.crt);
      sound.applySettings();
      if (S.lang && S.lang !== prevLang) { S.lang = prevLang; app.setLang(settings.lang); }
      renderMute();
    }
  });

  const introEl = $('#intro');

  function revealUI() {
    body.classList.remove('booting');
    scene.setCentered(false);
    scene.emblemVisible = true;
  }

  function finishIntro(skipped) {
    if (!introRunning) return;
    introRunning = false;
    introTimers.forEach(clearTimeout);
    introEl.classList.remove('show');
    introEl.classList.add('hide');
    if (skipped) scene.skipIntro();
    revealUI();
  }

  const showIntro = S.intro && !(await introAlreadyShown());
  if (showIntro) {
    introRunning = true;
    scene.setCentered(true);
    scene.placeRing(1);
    scene.emblemVisible = false;
    scene.playIntro();
    sound.intro();
    introTimers = [
      setTimeout(() => introEl.classList.add('show'), 2600),
      setTimeout(() => { introEl.classList.remove('show'); introEl.classList.add('hide'); }, 4400),
      setTimeout(() => finishIntro(false), 4800),
    ];
    window.addEventListener('pointerdown', () => finishIntro(true), { once: true });
  } else {
    scene.playQuick();
    setTimeout(revealUI, 250);
  }
}

boot().catch((e) => {
  console.error('[anemoia]', e);
  document.body.classList.remove('booting');
});
