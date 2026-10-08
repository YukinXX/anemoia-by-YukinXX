#by YukinX
import sys, time, tempfile, os
from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
EXT = os.path.abspath('extension')

RESULTS = [
    ('Godot Engine - Free and open source 2D and 3D game engine', 'https://godotengine.org/', 'Your free, open source game <b>engine</b>. Develop your 2D &amp; 3D games, cross-platform projects, or even XR ideas!'),
    ('Godot (игровой движок) — Википедия', 'https://ru.wikipedia.org/wiki/Godot', 'Godot Engine — открытый кроссплатформенный 2D и 3D игровой движок под лицензией MIT.'),
    ('godotengine/godot: Godot Engine – Multi-platform 2D and 3D game engine', 'https://github.com/godotengine/godot', 'Godot provides a huge set of common tools, so you can just focus on making your game.'),
    ('Godot Engine — Steam', 'https://store.steampowered.com/app/404790/', 'Godot Engine is a feature-packed, cross-platform game engine to create 2D and 3D games.'),
    ('Уроки Godot для начинающих', 'https://habr.com/ru/articles/godot/', 'Подробный разбор сцен, узлов и сигналов: делаем первую игру на <b>Godot</b> за вечер.'),
    ('Godot Docs – 4.5 branch', 'https://docs.godotengine.org/', 'Welcome to the official documentation of <b>Godot Engine</b>, the free and open source community-driven 2D and 3D game engine!'),
]
res_html = ''.join(f'''
<div class="MjjYud"><div class="tF2Cxc"><div class="yuRUbf"><div class="b8lM7"><span class="V9tjod">
<a class="zReHs" href="{u}"><h3 class="LC20lb">{t}</h3><div><span class="VuuXrf">{u.split('/')[2]}</span><cite>{u}</cite></div></a>
</span></div></div><div class="VwiC3b" style="color:#4d5156">{d}</div></div></div>''' for t, u, d in RESULTS)

MOCK = f'''<!doctype html><html><head><meta charset="utf-8"><title>godot engine - Поиск в Google</title>
<style>body{{margin:0;background:#fff;color:#202124;font-family:Arial}} #searchform{{position:relative;height:72px;margin-top:16px}}
#logo{{position:absolute;left:84px;top:20px}} .RNNXgb{{position:absolute;left:220px;top:10px;width:597px;height:46px;background:#fff;border:1px solid #dfe1e5;border-radius:24px;box-shadow:0 1px 6px rgba(32,33,36,.28)}}
textarea{{border:0;outline:0;width:90%;margin:12px 20px;font-size:16px;resize:none;height:22px;background:transparent}}
.GG4mbd{{display:flex;gap:22px;margin:12px 0 0 84px;font-size:14px}} .GG4mbd a{{color:#5f6368;text-decoration:none}} .GG4mbd [aria-current]{{color:#1a0dab;border-bottom:3px solid #1a0dab}}
#rcnt{{display:flex}} #center_col{{margin-left:84px;width:652px}} .MjjYud{{margin:28px 0}} h3{{color:#1a0dab;font-size:20px;font-weight:400;margin:4px 0}} a{{text-decoration:none}} cite{{color:#4d5156;font-size:12px;font-style:normal}}
.VuuXrf{{display:block;color:#202124;font-size:14px}} #botstuff [role=button]{{display:inline-block;background:#f1f3f4;padding:10px 24px;border-radius:20px;color:#202124}}
</style></head><body class="srp">
<div id="searchform"><form id="tsf" role="search"><div><div class="A8SBwf"><div class="logo"><a id="logo" href="/webhp"><svg width="92" height="30"><rect width="92" height="30" fill="#4285f4"/></svg></a></div>
<div class="RNNXgb"><div class="SDkEP"><div class="a4bIc"><textarea class="gLFyf" name="q" role="combobox">godot engine</textarea></div></div></div></div></div></form></div>
<div role="navigation" class="GG4mbd"><a href="#">Режим ИИ</a><div class="mXwfNd" aria-current="page">Все</div><a href="#">Картинки</a><a href="#">Видео</a><a href="#">Новости</a><a href="#">Ещё</a></div>
<div id="rcnt"><div id="center_col"><div id="search"><div id="rso">{res_html}</div></div>
<div id="botstuff"><div role="button">Ещё результаты</div></div><div id="footcnt">Москва · Изменить регион</div></div></div>
</body></html>'''

errors = []
with sync_playwright() as p:
    ud = tempfile.mkdtemp()
    ctx = p.chromium.launch_persistent_context(ud, channel='chromium', headless=True, viewport={'width': 1000, 'height': 640},
        args=[f'--disable-extensions-except={EXT}', f'--load-extension={EXT}', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx.route('https://www.google.com/search*', lambda route: route.fulfill(status=200, content_type='text/html; charset=utf-8', body=MOCK))
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.goto('https://www.google.com/search?q=godot+engine')
    time.sleep(3)
    print('skin class:', page.evaluate('document.documentElement.className'))
    print('results tagged:', page.evaluate("document.querySelectorAll('.mem-res').length"))
    print('font:', page.evaluate("getComputedStyle(document.querySelector('h3')).fontFamily"), page.evaluate("document.fonts.check('16px MPR')"))
    page.screenshot(path=f'{OUT}/serp-1000.png')
    page.mouse.click(900, 300)
    page.keyboard.press('ArrowDown'); time.sleep(0.6)
    page.keyboard.press('ArrowDown'); time.sleep(1.2)
    print('selected:', page.evaluate("[...document.querySelectorAll('.mem-res')].findIndex(e=>e.classList.contains('mem-sel'))"))
    page.screenshot(path=f'{OUT}/serp-1000-sel.png')
    page.set_viewport_size({'width': 1500, 'height': 860}); time.sleep(1.5)
    page.screenshot(path=f'{OUT}/serp-1500.png')
    n0 = len(ctx.pages)
    page.keyboard.press('Tab'); time.sleep(1.5)
    print('new tab opened:', len(ctx.pages) > n0, [pg.url for pg in ctx.pages][-1])
    sw = ctx.service_workers[0] if ctx.service_workers else None
    ext_id = sw.url.split('/')[2] if sw else None
    print('ext id:', ext_id)
    if ext_id:
        nt = ctx.new_page(); nt.on('pageerror', lambda e: errors.append(f'newtab pageerror: {e}'))
        nt.goto(f'chrome-extension://{ext_id}/newtab.html'); time.sleep(2)
        nt.keyboard.press('ArrowDown'); nt.keyboard.press('ArrowDown'); nt.keyboard.press('ArrowDown'); nt.keyboard.press('ArrowDown'); nt.keyboard.press('ArrowDown')
        time.sleep(0.4); nt.keyboard.press('Enter'); time.sleep(1.5)
        print('system items:', nt.evaluate("[...document.querySelectorAll('#menu .item')].map(e=>e.textContent).join(' | ')"))
    ctx.close()
print('\n'.join(e for e in errors if 'AudioContext' not in e) or 'no console errors')
