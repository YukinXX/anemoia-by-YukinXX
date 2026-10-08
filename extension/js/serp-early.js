//by YukinX
(()=>{(()=>{let a=document.documentElement;a.classList.add("anemoia-skin");try{chrome.storage.sync.get("settings").then(({settings:e})=>{e&&e.googleSkin===!1&&a.classList.remove("anemoia-skin"),(!e||e.crt!==!1)&&a.classList.add("mem-crt")})}catch{}})();})();
