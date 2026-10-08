//by YukinX

import {
  host, getBookmarkRoots, getBookmarkChildren, getTopSites, getRecentlyClosed, openInNewTab,
} from './browser.js';
import { DEFAULT_SITES, clone } from './store.js';
import { t, getLang } from './i18n.js';

const ACCENT = {
  root: 0x5aa8ff,
  sites: 0x46d0ff,
  bookmarks: 0x8f86ff,
  top: 0x45e0c8,
  recent: 0x6f9bff,
  system: 0x7ab0ff,
  danger: 0xff6f8f,
};

const link = (title, url, extra = {}) => ({ kind: 'link', title: title || host(url), url, desc: host(url), ...extra });

export function rootNode(app) {
  return {
    title: 'ANEMOIA',
    accent: ACCENT.root,
    items: () => [
      { kind: 'action', title: t('search'), desc: t('searchDesc'), glyph: 'search', run: () => app.openSearch() },
      { kind: 'folder', title: t('sites'), desc: t('sitesDesc'), glyph: 'globe', node: sitesNode(app) },
      { kind: 'folder', title: t('bookmarks'), desc: t('bookmarksDesc'), glyph: 'bookmark', node: bookmarksRootNode(app) },
      { kind: 'folder', title: t('top'), desc: t('topDesc'), glyph: 'bars', node: topNode() },
      { kind: 'folder', title: t('recent'), desc: t('recentDesc'), glyph: 'clock', node: recentNode() },
      { kind: 'folder', title: t('system'), desc: t('systemDesc'), glyph: 'gear', node: systemNode(app) },
    ],
  };
}

function sitesNode(app) {
  return {
    title: t('sites'),
    accent: ACCENT.sites,
    items: () => [
      ...app.state.sites.map((s, i) => link(s.title, s.url, {
        siteIndex: i,
        editable: true,
        edit: () => app.menu.push(siteEditNode(app, i)),
      })),
      { kind: 'action', title: t('addSite'), desc: t('addSiteDesc'), glyph: 'plus', run: () => app.openForm(null) },
    ],
  };
}

function siteEditNode(app, i) {
  const s = app.state.sites[i];
  return {
    title: s.title,
    accent: ACCENT.sites,
    items: () => [
      { kind: 'action', title: t('openNewTab'), desc: host(s.url), glyph: 'open', run: () => { openInNewTab(s.url); app.menu.back(); } },
      { kind: 'action', title: t('edit'), desc: t('editDesc'), glyph: 'pencil', run: () => app.openForm(i) },
      { kind: 'action', title: t('up'), desc: t('upDesc'), glyph: 'up', run: () => app.moveSite(i, -1, true) },
      { kind: 'action', title: t('down'), desc: t('downDesc'), glyph: 'down', run: () => app.moveSite(i, 1, true) },
      { kind: 'folder', title: t('remove'), desc: t('removeDesc'), glyph: 'trash', node: confirmNode(t('removeAsk', s.title), () => app.deleteSite(i)) },
    ],
  };
}

function confirmNode(title, onYes) {
  return {
    title,
    accent: ACCENT.danger,
    items: () => [
      { kind: 'action', title: t('no'), desc: t('noDesc'), glyph: 'cross', run: (app) => app.menu.back() },
      { kind: 'action', title: t('yes'), desc: title, glyph: 'check', run: () => onYes() },
    ],
  };
}

function bookmarkItems(nodes) {
  return nodes.map((n) => (n.url
    ? link(n.title, n.url)
    : {
      kind: 'folder', title: n.title || t('untitled'), glyph: 'folder',
      desc: n.children ? t('items', n.children.length) : t('folder'),
      node: bookmarkFolderNode(n),
    }));
}

function bookmarksRootNode() {
  return {
    title: t('bookmarks'),
    accent: ACCENT.bookmarks,
    items: async () => bookmarkItems(await getBookmarkRoots()),
  };
}

function bookmarkFolderNode(folder) {
  return {
    title: folder.title || t('folder'),
    accent: ACCENT.bookmarks,
    items: async () => bookmarkItems(folder.children || await getBookmarkChildren(folder.id)),
  };
}

function topNode() {
  return {
    title: t('top'),
    accent: ACCENT.top,
    items: async () => (await getTopSites()).map((s) => link(s.title, s.url)),
  };
}

function recentNode() {
  return {
    title: t('recent'),
    accent: ACCENT.recent,
    items: async () => (await getRecentlyClosed()).map((tab) => link(tab.title, tab.url)),
  };
}

function systemNode(app) {
  const S = app.state.settings;
  const onOff = (v) => (v ? t('on') : t('off'));
  const toggle = (title, key, desc, glyph) => ({
    kind: 'toggle', title, desc, glyph,
    value: () => onOff(S[key]),
    run: () => app.setSetting(key, !S[key]),
  });
  return {
    title: t('system'),
    accent: ACCENT.system,
    items: () => [
      toggle(t('uiSound'), 'uiSound', t('uiSoundDesc'), 'note'),
      toggle(t('ambient'), 'ambient', t('ambientDesc'), 'wave'),
      {
        kind: 'toggle', title: t('volume'), glyph: 'wave', desc: t('volumeDesc'),
        value: () => Math.round(S.volume * 100) + '%',
        run: (dir = 1) => {
          let v = Math.round((S.volume + 0.1 * dir) * 10) / 10;
          if (v > 1) v = 0.1;
          if (v < 0.1) v = 1;
          app.setSetting('volume', v);
        },
      },
      toggle(t('googleSkin'), 'googleSkin', t('googleSkinDesc'), 'search'),
      toggle(t('intro'), 'intro', t('introDesc'), 'star'),
      toggle(t('crt'), 'crt', t('crtDesc'), 'tv'),
      {
        kind: 'toggle', title: t('quality'), glyph: 'diamond', desc: t('qualityDesc'),
        value: () => (S.quality === 'high' ? t('qualityHigh') : t('qualityLow')),
        run: () => app.setSetting('quality', S.quality === 'high' ? 'low' : 'high'),
      },
      {
        kind: 'toggle', title: t('language'), glyph: 'globe', desc: t('languageDesc'),
        value: () => (getLang() === 'ru' ? 'RUS' : 'ENG'),
        run: () => app.setLang(getLang() === 'ru' ? 'en' : 'ru'),
      },
      {
        kind: 'folder', title: t('resetSites'), glyph: 'reset', desc: t('resetSitesDesc'),
        node: confirmNode(t('resetAsk'), () => { app.state.sites = clone(DEFAULT_SITES); app.save(); app.menu.back(); }),
      },
      { kind: 'action', title: t('about'), glyph: 'orb', desc: t('aboutDesc'), run: () => app.sound.enter() },
    ],
  };
}
