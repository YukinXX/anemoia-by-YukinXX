#by YukinX
import time, tempfile, os, sys
from playwright.sync_api import sync_playwright
from PIL import Image
EXT=os.path.abspath('extension'); SP=sys.argv[2] if len(sys.argv) > 2 else '.'
tag=sys.argv[1]
INIT = """
(() => {
  let zero = true;
  const w = () => zero ? 0 : document.documentElement.clientWidth;
  const h = () => zero ? 0 : document.documentElement.clientHeight;
  Object.defineProperty(window, 'innerWidth', { get: w, configurable: true });
  Object.defineProperty(window, 'innerHeight', { get: h, configurable: true });
  setTimeout(() => { zero = false; window.dispatchEvent(new Event('resize')); }, 1500);
})();
"""
with sync_playwright() as p:
    ctx=p.chromium.launch_persistent_context(tempfile.mkdtemp(),channel='chromium',headless=True,viewport={'width':1000,'height':600},
        args=[f'--disable-extensions-except={EXT}',f'--load-extension={EXT}','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event('serviceworker'); ext = sw.url.split('/')[2]
    pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script(INIT)
    pg.goto(f'chrome-extension://{ext}/newtab.html')
    time.sleep(9)
    pg.screenshot(path=f'{SP}/zero-{tag}.png')
    im=Image.open(f'{SP}/zero-{tag}.png').convert('L')
    def mean(box): c=im.crop(box); return round(sum(c.getdata())/(c.width*c.height),1)
    print(tag, 'яркость: слева', mean((0,0,500,600)), '| центр кольца', mean((150,150,450,450)))
    print('ring pos:', pg.evaluate("document.querySelector('#menu .item.sel') && document.querySelector('#menu .item.sel').textContent"))
    ctx.close()
print('errors:', errs or 'none')
