#by YukinX
import sys, time, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
ROOT = 'extension'

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
class Quiet(Handler.func):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT))
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

errors = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    for (w, h, name, intro) in [(1179, 518, 'laptop', True), (1440, 860, 'desktop', False)]:
        ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1)
        page = ctx.new_page()
        page.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        if not intro:
            page.add_init_script("sessionStorage.setItem('introShown','1')")
        page.goto(f'http://127.0.0.1:{port}/newtab.html')
        if intro:
            for t in (1.2, 2.6, 3.3):
                time.sleep(t - (0 if t == 1.2 else prev))
                prev = t
                page.screenshot(path=f'{OUT}/{name}-intro-{t}.png')
                prev = t
            time.sleep(3.5)
        else:
            time.sleep(2.5)
        page.screenshot(path=f'{OUT}/{name}-main.png')
        if not intro:
            page.keyboard.press('ArrowDown'); time.sleep(0.5)
            page.keyboard.press('Enter'); time.sleep(1.2)
            page.keyboard.press('ArrowDown'); time.sleep(0.8)
            page.screenshot(path=f'{OUT}/{name}-sites.png')
            page.keyboard.press('Escape'); time.sleep(0.8)
            for _ in range(5): page.keyboard.press('ArrowDown'); time.sleep(0.15)
            page.keyboard.press('Enter'); time.sleep(1.2)
            page.screenshot(path=f'{OUT}/{name}-system.png')
            page.keyboard.press('Escape'); time.sleep(0.6)
            page.keyboard.type('g'); time.sleep(0.6)
            page.keyboard.type('odot')
            time.sleep(0.4)
            page.screenshot(path=f'{OUT}/{name}-search.png')
            page.keyboard.press('Escape'); time.sleep(0.5)
            page.keyboard.press('ArrowUp'); time.sleep(0.3)
            for _ in range(5): page.keyboard.press('ArrowUp'); time.sleep(0.1)
            page.keyboard.press('ArrowDown'); time.sleep(0.3)
            page.keyboard.press('Enter'); time.sleep(1.0)
            page.keyboard.press('Tab'); time.sleep(1.0)
            page.screenshot(path=f'{OUT}/{name}-edit.png')
        ctx.close()
    b.close()
srv.shutdown()
print('\n'.join(errors) or 'no console errors')
