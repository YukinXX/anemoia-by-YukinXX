//by YukinX

import { t } from './i18n.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class Menu {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('menu');
    this.listEl = this.el.querySelector('.list');
    this.crumbEl = this.el.querySelector('.crumb');
    this.descEl = this.el.querySelector('.desc');
    this.upEl = this.el.querySelector('.arrow.up');
    this.downEl = this.el.querySelector('.arrow.down');
    this.stack = [];
    this.items = [];
    this.els = [];
    this.index = 0;
    this.busy = false;
    this.itemH = 48;

    this.listEl.addEventListener('click', (e) => {
      const i = this.indexFromEvent(e);
      if (i < 0) return;
      if (i !== this.index) this.select(i);
      this.activate(i, e);
    });
    this.listEl.addEventListener('auxclick', (e) => {
      if (e.button !== 1) return;
      const i = this.indexFromEvent(e);
      const item = this.items[i];
      if (item && item.kind === 'link') { e.preventDefault(); this.app.openUrl(item.url, { newTab: true }); }
    });
    this.listEl.addEventListener('contextmenu', (e) => {
      const i = this.indexFromEvent(e);
      if (i < 0) return;
      e.preventDefault();
      if (i !== this.index) this.select(i, { silent: true });
      this.edit();
    });
    this.upEl.addEventListener('click', () => this.move(-1));
    this.downEl.addEventListener('click', () => this.move(1));
    this.crumbEl.addEventListener('click', (e) => {
      const span = e.target.closest('span[data-depth]');
      if (!span) return;
      const depth = +span.dataset.depth;
      const n = this.stack.length - 1 - depth;
      if (n > 0) this.back(n);
    });
    window.addEventListener('resize', () => { this.measure(); this.layout(); });
  }

  get current() { return this.stack[this.stack.length - 1]; }
  get item() { return this.items[this.index]; }

  indexFromEvent(e) {
    const el = e.target.closest('.item');
    return el ? +el.dataset.i : -1;
  }

  async push(node) {
    if (this.busy) return;
    if (this.current) this.current.index = this.index;
    this.stack.push({ node, index: 0 });
    await this.load(this.stack.length > 1 ? 'forward' : 'none');
  }

  async back(n = 1) {
    if (this.busy) return false;
    if (this.stack.length <= 1) { this.app.sound.bump(); return false; }
    n = Math.min(n, this.stack.length - 1);
    for (let k = 0; k < n; k++) this.stack.pop();
    this.app.sound.back();
    this.app.scene.pulse('out');
    await this.load('back');
    return true;
  }

  async load(dir) {
    this.busy = true;
    const top = this.current;
    if (dir !== 'none') {
      this.listEl.classList.add(dir === 'back' ? 'leave-right' : 'leave-left');
      await wait(150);
    }
    let items = [];
    try { items = await top.node.items(); } catch (e) { console.warn('[anemoia] items', e); }
    if (!items || !items.length) items = [{ kind: 'empty', title: t('empty'), desc: '', glyph: 'dot' }];
    this.items = items;
    this.index = Math.min(top.index || 0, items.length - 1);
    this.build();
    this.renderCrumb();
    this.app.onNode(top.node);

    if (dir !== 'none') {
      this.listEl.classList.remove('leave-left', 'leave-right');
      this.listEl.classList.add(dir === 'back' ? 'from-left' : 'from-right');
      void this.listEl.offsetWidth;
      this.listEl.classList.remove('from-left', 'from-right');
    }
    this.select(this.index, { silent: true });
    this.busy = false;
  }

  async refresh(index = this.index) {
    const top = this.current;
    let items = [];
    try { items = await top.node.items(); } catch (e) { console.warn(e); }
    if (!items.length) items = [{ kind: 'empty', title: t('empty'), glyph: 'dot' }];
    this.items = items;
    this.index = Math.max(0, Math.min(index, items.length - 1));
    this.build();
    this.select(this.index, { silent: true });
  }

  async rebuild(root) {
    const path = this.stack.map((st, i) => (i === this.stack.length - 1 ? this.index : st.index));
    this.stack = [{ node: root, index: path[0] || 0 }];
    for (let d = 1; d < path.length; d++) {
      let items = [];
      try { items = await this.stack[d - 1].node.items(); } catch (e) { break; }
      const it = items[path[d - 1]];
      if (!it || !it.node) break;
      this.stack.push({ node: it.node, index: path[d] || 0 });
    }
    await this.load('none');
  }

  build() {
    this.listEl.textContent = '';
    this.els = this.items.map((item, i) => {
      const el = document.createElement('div');
      el.className = 'item no-anim' + (item.kind === 'empty' ? ' empty' : '');
      el.dataset.i = i;
      const t = document.createElement('span');
      t.className = 't';
      t.textContent = item.title;
      el.appendChild(t);
      if (item.kind === 'toggle') {
        const v = document.createElement('span');
        v.className = 'v';
        v.textContent = item.value();
        el.appendChild(v);
      }
      if (item.url) el.title = item.url;
      this.listEl.appendChild(el);
      return el;
    });
    this.measure();
    this.layout();
    requestAnimationFrame(() => requestAnimationFrame(() => this.els.forEach((el) => el.classList.remove('no-anim'))));
  }

  measure() {
    if (this.els[0]) this.itemH = this.els[0].offsetHeight || this.itemH;
    this.listH = this.listEl.clientHeight;
  }

  layout() {
    const H = this.itemH;
    const maxD = Math.ceil(this.listH / 2 / H) + 1;
    this.els.forEach((el, i) => {
      const d = i - this.index;
      const ad = Math.abs(d);
      el.style.transform = `translateY(${d * H}px) scale(${ad === 0 ? 1 : Math.max(0.8, 0.93 - (ad - 1) * 0.04)})`;
      el.style.opacity = ad === 0 ? 1 : Math.max(0, 0.66 - (ad - 1) * 0.17);
      el.style.visibility = ad > maxD ? 'hidden' : 'visible';
      el.classList.toggle('sel', d === 0);
    });
    this.upEl.classList.toggle('hide', this.index <= 0);
    this.downEl.classList.toggle('hide', this.index >= this.items.length - 1);
  }

  renderCrumb() {
    this.crumbEl.textContent = '';
    this.stack.forEach((s, depth) => {
      if (depth) {
        const sep = document.createElement('i');
        sep.textContent = '/';
        this.crumbEl.appendChild(sep);
      }
      const span = document.createElement('span');
      span.dataset.depth = depth;
      span.textContent = s.node.title;
      this.crumbEl.appendChild(span);
    });
  }

  select(i, { silent = false } = {}) {
    this.index = i;
    this.layout();
    const item = this.item;
    this.descEl.textContent = item ? item.desc || '' : '';
    this.app.onSelect(item);
    if (!silent) this.app.sound.tick(1);
  }

  move(delta) {
    if (this.busy || !this.items.length) return;
    const ni = Math.max(0, Math.min(this.items.length - 1, this.index + delta));
    if (ni === this.index) { this.app.sound.bump(); return; }
    this.select(ni, { silent: true });
    this.app.sound.tick(delta);
    this.app.scene.kick(delta);
  }

  jump(to) {
    if (this.busy || !this.items.length) return;
    const ni = to === 'end' ? this.items.length - 1 : 0;
    if (ni !== this.index) { this.select(ni, { silent: true }); this.app.sound.tick(1); this.app.scene.kick(ni > 0 ? 1 : -1); }
  }

  async activate(i = this.index, e = null) {
    if (this.busy) return;
    const item = this.items[i];
    if (!item) return;
    const newTab = !!(e && (e.metaKey || e.ctrlKey || e.button === 1));
    switch (item.kind) {
      case 'link':
        this.app.openUrl(item.url, { newTab });
        break;
      case 'folder':
        this.app.sound.enter();
        this.app.scene.pulse('in');
        await this.push(item.node);
        break;
      case 'action':
        this.app.sound.enter();
        this.app.scene.pulse('tap');
        await item.run(this.app);
        break;
      case 'toggle':
        this.app.sound.enter();
        this.app.scene.pulse('tap');
        await item.run(1);
        await this.refresh(i);
        break;
      default:
        this.app.sound.bump();
    }
  }

  async adjust(dir) {
    const item = this.item;
    if (!item || item.kind !== 'toggle') return false;
    this.app.sound.tick(dir);
    this.app.scene.pulse('tap');
    await item.run(dir);
    await this.refresh(this.index);
    return true;
  }

  edit() {
    const item = this.item;
    if (item && item.editable) { this.app.sound.enter(); this.app.scene.pulse('in'); item.edit(); }
    else this.app.sound.bump();
  }
}
