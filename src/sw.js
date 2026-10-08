//by YukinX

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || sender.id !== chrome.runtime.id) return;
  const tab = sender.tab;
  if (msg.type === 'openTab' && /^https?:\/\//i.test(msg.url || '')) {
    chrome.tabs.create({ url: msg.url, active: false, index: tab ? tab.index + 1 : undefined });
  }
  if (msg.type === 'home' && tab) {
    chrome.tabs.update(tab.id, { url: chrome.runtime.getURL('newtab.html') });
  }
});
