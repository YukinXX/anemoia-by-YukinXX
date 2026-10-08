//by YukinX

(() => {
  const root = document.documentElement;
  root.classList.add('anemoia-skin');
  try {
    chrome.storage.sync.get('settings').then(({ settings }) => {
      if (settings && settings.googleSkin === false) root.classList.remove('anemoia-skin');
      if (!settings || settings.crt !== false) root.classList.add('mem-crt');
    });
  } catch (e) {  }
})();
