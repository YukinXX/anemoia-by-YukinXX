//by YukinX
(()=>{chrome.runtime.onMessage.addListener((e,i)=>{if(!e||i.id!==chrome.runtime.id)return;let t=i.tab;e.type==="openTab"&&/^https?:\/\//i.test(e.url||"")&&chrome.tabs.create({url:e.url,active:!1,index:t?t.index+1:void 0}),e.type==="home"&&t&&chrome.tabs.update(t.id,{url:chrome.runtime.getURL("newtab.html")})});})();
