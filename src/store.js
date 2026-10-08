//by YukinX

const C = typeof chrome !== 'undefined' ? chrome : null;
const hasSync = !!(C && C.storage && C.storage.sync);

export const DEFAULT_SITES = [
  { title: 'YouTube', url: 'https://www.youtube.com/' },
  { title: 'Gmail', url: 'https://mail.google.com/' },
  { title: 'GitHub', url: 'https://github.com/' },
  { title: 'Wikipedia', url: 'https://www.wikipedia.org/' },
  { title: 'Reddit', url: 'https://www.reddit.com/' },
  { title: 'Pinterest', url: 'https://www.pinterest.com/' },
  { title: 'Google Drive', url: 'https://drive.google.com/' },
  { title: 'Google Calendar', url: 'https://calendar.google.com/' },
];

export const DEFAULT_SETTINGS = {
  uiSound: true,
  ambient: true,
  volume: 0.6,
  muted: false,
  intro: true,
  crt: true,
  quality: 'high',
  googleSkin: true,
  lang: null,
};

const clone = (v) => JSON.parse(JSON.stringify(v));

export async function loadState() {
  let raw = {};
  try {
    if (hasSync) raw = await C.storage.sync.get(['sites', 'settings']);
    else raw = JSON.parse(localStorage.getItem('anemoia') || '{}');
  } catch (e) { console.warn('[anemoia] load', e); }
  return {
    sites: Array.isArray(raw.sites) ? raw.sites : clone(DEFAULT_SITES),
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}) },
  };
}

export async function saveState(state) {
  const payload = { sites: state.sites, settings: state.settings };
  try {
    if (hasSync) await C.storage.sync.set(payload);
    else localStorage.setItem('anemoia', JSON.stringify(payload));
  } catch (e) { console.warn('[anemoia] save', e); }
}

export function onExternalChange(cb) {
  if (!hasSync) return;
  C.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    cb({
      sites: changes.sites ? changes.sites.newValue : undefined,
      settings: changes.settings ? changes.settings.newValue : undefined,
    });
  });
}

export async function introAlreadyShown() {
  try {
    if (C && C.storage && C.storage.session) {
      const { introShown } = await C.storage.session.get('introShown');
      if (!introShown) await C.storage.session.set({ introShown: true });
      return !!introShown;
    }
  } catch (e) {  }
  const v = sessionStorage.getItem('introShown');
  sessionStorage.setItem('introShown', '1');
  return !!v;
}

export { clone };
