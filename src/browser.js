//by YukinX

const C = typeof chrome !== 'undefined' ? chrome : null;
export const isExtension = !!(C && C.runtime && C.runtime.id);

export function host(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url || ''; }
}

export function normalizeUrl(input) {
  let s = (input || '').trim();
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
  try { return new URL(s).toString(); } catch { return ''; }
}

export function looksLikeUrl(text) {
  const s = text.trim();
  if (/\s/.test(s)) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return true;
  if (/^localhost(:\d+)?(\/|$)/i.test(s)) return true;
  return /^[^\s/]+\.[a-zа-я]{2,}(:\d+)?(\/.*)?$/i.test(s);
}

export function faviconUrl(pageUrl, size = 64) {
  if (!isExtension) return null;
  const u = new URL(C.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', pageUrl);
  u.searchParams.set('size', String(size));
  return u.toString();
}

const INTERNAL = /^(chrome|vivaldi|edge|about|chrome-extension|devtools|view-source):/i;

export async function getBookmarkRoots() {
  if (!isExtension || !C.bookmarks) return DEMO_BOOKMARKS;
  const [root] = await C.bookmarks.getTree();
  return (root.children || []).filter((n) => !/^(trash|корзина)$/i.test(n.title || ''));
}

export async function getBookmarkChildren(id) {
  if (!isExtension || !C.bookmarks) return [];
  return C.bookmarks.getChildren(id);
}

export async function getTopSites() {
  if (!isExtension || !C.topSites) return DEMO_TOP;
  try { return (await C.topSites.get()).filter((s) => !INTERNAL.test(s.url)); } catch { return []; }
}

export async function getRecentlyClosed() {
  if (!isExtension || !C.sessions) return DEMO_TOP.slice(0, 3);
  try {
    const list = await C.sessions.getRecentlyClosed({ maxResults: 25 });
    const tabs = [];
    for (const s of list) {
      if (s.tab) tabs.push(s.tab);
      else if (s.window && s.window.tabs) tabs.push(...s.window.tabs);
    }
    const seen = new Set();
    return tabs.filter((t) => t.url && !INTERNAL.test(t.url) && !seen.has(t.url) && seen.add(t.url));
  } catch { return []; }
}

export function navigate(url) {
  if (isExtension && C.tabs) C.tabs.update({ url });
  else location.href = url;
}

export function openInNewTab(url) {
  if (isExtension && C.tabs) C.tabs.create({ url, active: false });
  else window.open(url, '_blank');
}

export function searchWeb(text) {
  if (isExtension && C.search && C.search.query) {
    C.search.query({ text, disposition: 'CURRENT_TAB' }).catch(() => {
      location.href = 'https://www.google.com/search?q=' + encodeURIComponent(text);
    });
  } else {
    location.href = 'https://www.google.com/search?q=' + encodeURIComponent(text);
  }
}

const DEMO_TOP = [
  { title: 'YouTube', url: 'https://www.youtube.com/' },
  { title: 'GitHub', url: 'https://github.com/' },
  { title: 'Wikipedia', url: 'https://www.wikipedia.org/' },
  { title: 'Reddit', url: 'https://www.reddit.com/' },
];
const DEMO_BOOKMARKS = [
  { id: 'b1', title: 'Bookmarks bar', children: [
    { id: 'b11', title: 'Three.js', url: 'https://threejs.org/' },
    { id: 'b12', title: 'MDN Web Docs', url: 'https://developer.mozilla.org/' },
    { id: 'b13', title: 'Dev', children: [{ id: 'b131', title: 'Godot Docs', url: 'https://docs.godotengine.org/' }] },
  ] },
  { id: 'b2', title: 'Other bookmarks', children: [] },
];
