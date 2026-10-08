//by YukinX

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { drawGlyph, drawImageEmblem } from './glyphs.js';
import { faviconUrl } from './browser.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutBack = (x) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
const lerp = (a, b, t) => a + (b - a) * t;

function radialTexture(stops, size = 128) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, c] of stops) grd.addColorStop(o, c);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function additiveSprite(map, color = 0xffffff, opacity = 1) {
  return new THREE.Sprite(new THREE.SpriteMaterial({
    map, color, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
}

function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uAccent: { value: new THREE.Color(0x5aa8ff) } },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uAccent;
      varying vec3 vDir;
      void main() {
        float y = vDir.y;
        vec3 top = vec3(0.0, 0.004, 0.02);
        vec3 horizon = mix(vec3(0.005, 0.022, 0.06), uAccent * 0.09, 0.35);
        vec3 bottom = vec3(0.0, 0.0, 0.006);
        vec3 col = y > 0.0
          ? mix(horizon, top, smoothstep(0.0, 0.32, y))
          : mix(horizon, bottom, smoothstep(0.0, 0.08, -y));
        col += uAccent * 0.03 * exp(-abs(y) * 70.0);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), mat);
  mesh.renderOrder = -10;
  return mesh;
}

class Towers {
  constructor(parent, floorY, count) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const heights = new Float32Array(count);
    const phases = new Float32Array(count);
    this.uniforms = {
      uTime: { value: 0 }, uGrow: { value: 1 },
      uColor: { value: new THREE.Color(0x5aa8ff) },
    };
    const makeMat = (alpha, reflect) => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { ...this.uniforms, uAlpha: { value: alpha }, uReflect: { value: reflect } },
      vertexShader: `
        attribute float aHeight;
        attribute float aPhase;
        uniform float uTime, uGrow;
        varying float vY, vFade;
        varying vec2 vUv;
        void main() {
          vec3 p = position;
          vY = p.y; vUv = uv;
          float h = aHeight * uGrow * (1.0 + 0.07 * sin(uTime * 0.55 + aPhase));
          p.y *= max(h, 0.001);
          vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
          float d = -mv.z;
          vFade = exp(-0.034 * max(0.0, d - 14.0)) * smoothstep(6.0, 14.0, d);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uAlpha, uReflect;
        varying float vY, vFade;
        varying vec2 vUv;
        void main() {
          float grad = pow(max(vY, 1e-4), 1.7);
          float edge = smoothstep(0.78, 1.0, abs(vUv.x * 2.0 - 1.0));
          float a = (0.025 + 0.42 * grad + 0.6 * edge * grad) * vFade * uAlpha;
          if (uReflect > 0.5) a *= pow(max(1.0 - vY, 1e-4), 0.6) * (0.4 + 0.6 * grad);
          vec3 col = mix(uColor, vec3(0.9, 0.96, 1.0), 0.25 * grad + 0.35 * edge);
          a = a >= 0.0 ? min(a, 1.0) : 0.0;
          gl_FragColor = vec4(col, a);
        }`,
    });

    this.mesh = new THREE.InstancedMesh(geo, makeMat(0.26, 0), count);
    this.mirror = new THREE.InstancedMesh(geo, makeMat(0.07, 1), count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < count; i++) {
      const z = -16 - Math.pow(Math.random(), 0.75) * 50;
      const spread = 12 + (-z) * 0.85;
      const x = (Math.random() * 2 - 1) * spread;
      const w = 0.16 + Math.random() * 0.42;

      heights[i] = (0.8 + Math.pow(Math.random(), 2.6) * 13) * (0.45 + 0.55 * clamp01((-z - 16) / 36));
      phases[i] = Math.random() * Math.PI * 2;
      m.compose(new THREE.Vector3(x, floorY, z), q, new THREE.Vector3(w, 1, w));
      this.mesh.setMatrixAt(i, m);
      this.mirror.setMatrixAt(i, m);
    }
    geo.setAttribute('aHeight', new THREE.InstancedBufferAttribute(heights, 1));
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    this.mirror.scale.y = -1;
    this.mirror.position.y = 2 * floorY;
    this.mesh.frustumCulled = this.mirror.frustumCulled = false;
    parent.add(this.mesh, this.mirror);
  }
  update(t, grow, color) {
    this.uniforms.uTime.value = t;
    this.uniforms.uGrow.value = grow;
    this.uniforms.uColor.value.copy(color);
  }
}

class Grid {
  constructor(parent, floorY) {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 }, uColor: { value: new THREE.Color(0x5aa8ff) } },
      vertexShader: `
        varying vec3 vW; varying float vD;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vW = wp.xyz;
          vec4 mv = viewMatrix * wp;
          vD = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float uTime, uAlpha; uniform vec3 uColor;
        varying vec3 vW; varying float vD;
        void main() {
          vec2 c = vW.xz / 2.4;
          vec2 g = abs(fract(c - 0.5) - 0.5) / max(fwidth(c), vec2(1e-5));
          float line = 1.0 - min(min(g.x, g.y), 1.0);
          float fade = exp(-0.07 * max(vD - 5.0, 0.0)) * smoothstep(1.5, 7.0, vD);
          float wz = mod(vW.z - uTime * 5.0, 48.0) - 24.0;
          float wave = exp(-wz * wz * 0.08);
          float a = line * (0.045 + 0.16 * wave) * fade * uAlpha;
          a = a >= 0.0 ? min(a, 1.0) : 0.0;
          gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.2), a);
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(160, 120), this.mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, floorY, -40);
    parent.add(mesh);
  }
  update(t, alpha, color) {
    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uAlpha.value = alpha;
    this.mat.uniforms.uColor.value.copy(color);
  }
}

class Dust {
  constructor(parent, count, pixelRatio) {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * 22;
      pos[i * 3 + 1] = Math.random() * 11 - 3;
      pos[i * 3 + 2] = -Math.random() * 38 + 7;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPR: { value: pixelRatio }, uColor: { value: new THREE.Color(0x9fd0ff) }, uAlpha: { value: 1 } },
      vertexShader: `
        attribute float aSeed;
        uniform float uTime, uPR;
        varying float vA;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uTime * 0.12 * (0.4 + aSeed) + 3.0, 11.0) - 3.0;
          p.x += sin(uTime * 0.17 + aSeed * 40.0) * 0.5;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          gl_PointSize = (1.2 + 2.6 * aSeed) * uPR * (9.0 / max(d, 0.5));
          float tw = 0.5 + 0.5 * sin(uTime * (0.6 + aSeed * 1.4) + aSeed * 30.0);
          vA = (0.25 + 0.75 * tw) * (1.0 - smoothstep(6.0, 42.0, d)) * smoothstep(0.8, 3.0, d);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uAlpha;
        varying float vA;
        void main() {
          float r = length(gl_PointCoord - 0.5);
          float a = 1.0 - smoothstep(0.0, 0.5, r);
          a = a * a * vA * 0.7 * uAlpha;
          a = a >= 0.0 ? min(a, 1.0) : 0.0;
          gl_FragColor = vec4(uColor, a);
        }`,
    });
    parent.add(new THREE.Points(geo, this.mat));
  }
  update(t, alpha) { this.mat.uniforms.uTime.value = t; this.mat.uniforms.uAlpha.value = alpha; }
}

class OrbRing {
  constructor(parent, tex) {
    this.group = new THREE.Group();
    this.tilt = new THREE.Group();
    this.tilt.rotation.x = 0.2;
    this.group.add(this.tilt);
    parent.add(this.group);

    this.count = 7;
    this.trailLen = 18;
    this.R = 1.45;
    this.spin = 0;
    this.speed = 0.85;
    this.baseSpeed = 0.85;
    this.expand = 1;
    this.expandTarget = 1;
    this.orbs = [];

    for (let i = 0; i < this.count; i++) {
      const size = 0.30 * (1 - i * 0.07);
      const core = additiveSprite(tex.core, 0xffffff, 1);
      core.scale.setScalar(size);
      const halo = additiveSprite(tex.halo, 0x5aa8ff, 0.7);
      halo.scale.setScalar(size * 4.4);
      const trail = [];
      for (let k = 0; k < this.trailLen; k++) {
        const s = additiveSprite(tex.halo, 0x5aa8ff, Math.pow(1 - k / this.trailLen, 2.2) * 0.32);
        s.scale.setScalar(size * (1.9 - k * 0.07));
        trail.push(s);
        this.tilt.add(s);
      }
      this.tilt.add(halo, core);
      const hist = Array.from({ length: this.trailLen }, () => new THREE.Vector3());
      this.orbs.push({ core, halo, trail, hist, size, primed: false });
    }

    this.emblem = additiveSprite(null, 0xffffff, 0);
    this.emblem.scale.setScalar(1.05);
    this.emblemGlow = additiveSprite(tex.halo, 0x5aa8ff, 0);
    this.emblemGlow.scale.setScalar(3.2);
    this.group.add(this.emblemGlow, this.emblem);
    this.emblemOpacity = 0;
    this.pendingMap = null;
    this.hasPending = false;

    this.nova = additiveSprite(tex.core, 0xffffff, 0);
    this.novaHalo = additiveSprite(tex.halo, 0x8cc4ff, 0);
    this.group.add(this.novaHalo, this.nova);
  }

  setEmblem(map) { this.pendingMap = map; this.hasPending = true; }

  kick(dir) { this.speed += 2.4 * (dir >= 0 ? 1 : -1); }
  pulse(kind) { this.expandTarget = kind === 'in' ? 1.3 : kind === 'out' ? 0.72 : 1.14; }

  update(t, dt, color, form, emblemVisible) {
    this.speed = damp(this.speed, this.baseSpeed, 2.2, dt);
    this.spin += this.speed * dt;
    this.expand = damp(this.expand, this.expandTarget, 7, dt);
    this.expandTarget = damp(this.expandTarget, 1, 3.2, dt);

    const step = (Math.PI * 2 * 0.8) / this.count;
    for (let i = 0; i < this.count; i++) {
      const o = this.orbs[i];
      const a = this.spin - i * step;
      const r = this.R * this.expand * form * (1 + 0.05 * Math.sin(t * 1.6 + i * 1.1));
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      const z = 0.2 * Math.sin(t * 1.05 + i * 0.7);
      o.core.position.set(x, y, z);
      o.halo.position.set(x, y, z);
      const pulse = 1 + 0.14 * Math.sin(t * 2.6 + i * 0.8);
      o.halo.scale.setScalar(o.size * 4.4 * pulse);
      o.halo.material.color.copy(color);
      o.core.material.opacity = clamp01(form * 1.5);
      o.halo.material.opacity = 0.7 * clamp01(form * 1.5);

      const last = o.hist.pop();
      last.set(x, y, z);
      o.hist.unshift(last);
      if (!o.primed) { o.hist.forEach((v) => v.set(x, y, z)); o.primed = true; }
      for (let k = 0; k < this.trailLen; k++) {
        o.trail[k].position.copy(o.hist[k]);
        o.trail[k].material.color.copy(color);
      }
    }
    this.group.rotation.z = 0.08 * Math.sin(t * 0.3);
    this.group.rotation.y = 0.28 * Math.sin(t * 0.17);

    if (this.hasPending) {
      this.emblemOpacity -= dt * 9;
      if (this.emblemOpacity <= 0) {
        this.emblemOpacity = 0;
        this.emblem.material.map = this.pendingMap;
        this.emblem.material.needsUpdate = true;
        this.hasPending = false;
      }
    } else {
      const target = emblemVisible && this.emblem.material.map ? 1 : 0;
      this.emblemOpacity = damp(this.emblemOpacity, target, 6, dt);
    }
    const eo = this.emblemOpacity * form;
    this.emblem.material.opacity = 0.92 * eo;
    this.emblem.position.y = 0.06 * Math.sin(t * 1.3);
    this.emblem.scale.setScalar(1.0 + 0.03 * Math.sin(t * 2.1));
    this.emblemGlow.material.opacity = 0.22 * eo;
    this.emblemGlow.material.color.copy(color);
  }
}

export class Scene {
  constructor(canvas, { quality = 'high', lookFollow = 0.25, towers = null, dust = null } = {}) {
    this.high = quality !== 'low';
    this.lookFollow = lookFollow;
    this.ringScale = 1;
    this.pixelRatio = this.high ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    this.canvas = canvas;
    this.renderer = null;
    this.composer = null;
    this.lostAt = 0;
    this.lastRecover = 0;
    this.w = 0; this.h = 0;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
    this.camBase = new THREE.Vector3(0, 0.6, 9.5);
    this.lookTarget = new THREE.Vector3(0, 0.1, 0);
    this.mouse = new THREE.Vector2();
    this.mouseSmooth = new THREE.Vector2();

    this.color = new THREE.Color(0x5aa8ff);
    this.colorTarget = this.color.clone();
    this.floorY = -2.1;

    this.tex = {
      core: radialTexture([[0, 'rgba(255,255,255,1)'], [0.22, 'rgba(255,255,255,1)'], [0.42, 'rgba(210,235,255,.55)'], [0.7, 'rgba(120,180,255,.08)'], [1, 'rgba(0,0,0,0)']]),
      halo: radialTexture([[0, 'rgba(255,255,255,.75)'], [0.18, 'rgba(255,255,255,.32)'], [0.5, 'rgba(255,255,255,.07)'], [1, 'rgba(255,255,255,0)']]),
    };

    this.sky = makeSky();
    this.scene.add(this.sky);
    this.towers = new Towers(this.scene, this.floorY, towers || (this.high ? 95 : 50));
    this.grid = new Grid(this.scene, this.floorY);
    this.dust = new Dust(this.scene, dust || (this.high ? 650 : 260), this.pixelRatio);
    this.ring = new OrbRing(this.scene, this.tex);

    this.emblemCache = new Map();
    this.emblemVisible = true;

    this.initRenderer(canvas);

    this.t = 0;
    this.mode = 'quick';
    this.modeT = 0;
    this.grow = 1;
    this.form = 1;
    this.sceneAlpha = 1;

    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.resize(); });
    window.addEventListener('pointermove', (e) => {
      this.mouse.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
    }, { passive: true });
    this.resize();

    this.clock = new THREE.Timer();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  initRenderer(canvas) {
    try {
      const renderer = new THREE.WebGLRenderer({
        canvas, antialias: this.high, powerPreference: 'high-performance', alpha: false,
      });
      renderer.setPixelRatio(this.pixelRatio);
      renderer.setClearColor(0x000000, 1);
      this.renderer = renderer;
      const ext = renderer.extensions;
      const floatRT = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');
      if (this.high && floatRT) {
        this.composer = new EffectComposer(renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.5, 0.2);
        this.composer.addPass(this.bloom);
        this.composer.addPass(new OutputPass());
      }
      canvas.addEventListener('webglcontextlost', () => { this.lostAt = performance.now(); }, false);
      canvas.addEventListener('webglcontextrestored', () => { this.lostAt = 0; this.w = 0; }, false);
      this.lostAt = 0;
      this.w = 0; this.h = 0;
      return true;
    } catch (e) {
      if (!this.warned) { console.warn('[anemoia] WebGL пока недоступен, попробую ещё раз', e); this.warned = true; }
      this.renderer = null;
      this.composer = null;
      return false;
    }
  }

  recoverRenderer() {
    this.lastRecover = performance.now();
    try { if (this.renderer) this.renderer.dispose(); } catch (e) {  }
    this.renderer = null;
    this.composer = null;
    const fresh = this.canvas.cloneNode(false);
    this.canvas.replaceWith(fresh);
    this.canvas = fresh;
    this.initRenderer(fresh);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    if (!w || !h) return;
    this.w = w; this.h = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.renderer) this.renderer.setSize(w, h, false);
    if (this.composer) { this.composer.setPixelRatio(this.pixelRatio); this.composer.setSize(w, h); }

    const halfH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camBase.z;
    const halfW = halfH * this.camera.aspect;
    this.halfH = halfH; this.halfW = halfW;
    const narrow = w / h < 1.1;
    this.ringX = narrow ? 0 : -halfW * 0.36;
    this.ringY = narrow ? halfH * 0.42 : 0.15;
    this.ringCenterY = narrow ? this.ringY : 0.45;
    if (!this.placed) { this.placeRing(1); this.placed = true; }
  }

  setCentered(on) { this.centered = on; }

  setRingScreen(px, py, scale = 1, snap = false) { this.screenPlacement = { px, py, scale }; if (snap) this.placeRing(1); }

  placeRing(k) {
    const g = this.ring.group.position;
    let tx = this.centered ? 0 : this.ringX;
    let ty = this.centered ? this.ringCenterY : this.ringY;
    let ts = 1;
    const sp = this.screenPlacement;
    if (sp && this.halfW) {
      tx = ((sp.px / this.w) * 2 - 1) * this.halfW;
      ty = (1 - (sp.py / this.h) * 2) * this.halfH + 0.35;
      ts = sp.scale;
    }

    if (!Number.isFinite(tx) || !Number.isFinite(ty) || !Number.isFinite(ts)) return;
    if (!Number.isFinite(g.x) || !Number.isFinite(g.y) || !Number.isFinite(this.ringScale)) {
      g.set(tx, ty, 0); this.ringScale = ts;
    }
    g.x += (tx - g.x) * k;
    g.y += (ty - g.y) * k;
    this.ringScale += (ts - this.ringScale) * k;
    this.ring.group.scale.setScalar(this.ringScale);
    this.lookTarget.set(g.x * this.lookFollow, 0.1, 0);
  }

  nudge(v) { this.ring.speed += Math.max(-1.2, Math.min(1.2, v)); }

  playIntro() { this.mode = 'intro'; this.modeT = 0; }
  playQuick() { this.mode = 'quick'; this.modeT = 0; }
  skipIntro() { if (this.mode === 'intro') this.modeT = Math.max(this.modeT, 4.6); }

  setAccent(hex) { this.colorTarget.set(hex); }
  kick(dir) { this.ring.kick(dir); }
  pulse(kind) { this.ring.pulse(kind); }

  setEmblem(spec) {
    if (!spec) { this.ring.setEmblem(null); return; }
    const key = spec.url ? 'u:' + spec.url : 'g:' + (spec.glyph || 'orb');
    const cached = this.emblemCache.get(key);
    if (cached) { this.ring.setEmblem(cached); return; }
    if (spec.url) {
      const fallback = this.glyphTexture('globe');
      const src = faviconUrl(spec.url, 64);
      this.ring.setEmblem(fallback);
      if (!src) return;
      this.currentEmblemKey = key;

      fetch(src)
        .then((r) => (r.ok ? r.blob() : Promise.reject(r.status)))
        .then((b) => createImageBitmap(b))
        .then((bmp) => {
          const t = new THREE.CanvasTexture(drawImageEmblem(bmp));
          t.colorSpace = THREE.SRGBColorSpace;
          this.emblemCache.set(key, t);
          if (this.currentEmblemKey === key) this.ring.setEmblem(t);
        })
        .catch(() => {});
    } else {
      this.currentEmblemKey = key;
      this.ring.setEmblem(this.glyphTexture(spec.glyph || 'orb'));
    }
  }

  glyphTexture(name) {
    const key = 'g:' + name;
    let t = this.emblemCache.get(key);
    if (!t) {
      t = new THREE.CanvasTexture(drawGlyph(name));
      t.colorSpace = THREE.SRGBColorSpace;
      this.emblemCache.set(key, t);
    }
    return t;
  }

  updateTimeline(dt) {
    this.modeT += dt;
    const T = this.modeT;
    let camZ = this.camBase.z, camY = this.camBase.y;
    let nova = 0;
    if (this.mode === 'intro') {
      this.grow = easeOutCubic(clamp01((T - 0.9) / 2.4));
      this.form = T < 2.3 ? 0 : easeOutBack(clamp01((T - 2.3) / 1.3));
      const k = easeInOutCubic(clamp01(T / 4.8));
      camZ = lerp(17, this.camBase.z, k);
      camY = lerp(2.2, this.camBase.y, k);
      this.gridAlpha = clamp01((T - 0.7) / 2);
      this.sceneAlpha = clamp01((T - 0.4) / 1.6);
      if (T < 2.3) nova = easeOutCubic(clamp01((T - 0.25) / 1.7)) * (1 + 0.12 * Math.sin(T * 14));
      else nova = Math.max(0, 1 - (T - 2.3) / 0.45) * 1.6;
      if (T > 6) this.mode = 'idle';
    } else if (this.mode === 'quick') {
      this.grow = 1;
      this.form = easeOutBack(clamp01(T / 0.9)) * 0.4 + 0.6 * easeOutCubic(clamp01(T / 0.6));
      const k = easeOutCubic(clamp01(T / 1.4));
      camZ = lerp(11.5, this.camBase.z, k);
      this.gridAlpha = 1;
      this.sceneAlpha = clamp01(T / 0.6);
      if (T > 2) this.mode = 'idle';
    } else {
      this.grow = 1; this.form = 1; this.gridAlpha = 1; this.sceneAlpha = 1;
    }
    return { camZ, camY, nova };
  }

  loop(ts) {
    requestAnimationFrame(this.loop);
    this.clock.update(ts);
    if (innerWidth !== this.w || innerHeight !== this.h) this.resize();
    if (!this.w) return;
    const raw = this.clock.getDelta();
    const dt = Math.min(raw, 0.05);
    this.t += dt;
    const t = this.t;
    const { camZ, camY, nova } = this.updateTimeline(Math.min(raw, 0.5));

    this.color.lerp(this.colorTarget, 1 - Math.exp(-dt * 2.5));
    this.placeRing(1 - Math.exp(-dt * 2.4));
    this.mouseSmooth.x = damp(this.mouseSmooth.x, this.mouse.x, 2, dt);
    this.mouseSmooth.y = damp(this.mouseSmooth.y, this.mouse.y, 2, dt);

    const cam = this.camera;
    cam.position.set(
      this.mouseSmooth.x * 0.55 + Math.sin(t * 0.09) * 0.25,
      camY + this.mouseSmooth.y * 0.3 + Math.sin(t * 0.13) * 0.08,
      camZ,
    );
    cam.lookAt(this.lookTarget);

    this.sky.material.uniforms.uAccent.value.copy(this.color);
    this.towers.update(t, this.grow, this.color);
    this.grid.update(t, this.gridAlpha, this.color);
    this.dust.update(t, this.sceneAlpha);
    this.ring.update(t, dt, this.color, this.form, this.emblemVisible);

    const r = this.ring;
    r.nova.material.opacity = clamp01(nova);
    r.nova.scale.setScalar(0.5 + nova * 0.6);
    r.novaHalo.material.opacity = clamp01(nova) * 0.8;
    r.novaHalo.scale.setScalar(1 + nova * 5);
    r.novaHalo.material.color.copy(this.color);

    const now = performance.now();
    if (!this.renderer || (this.lostAt && now - this.lostAt > 2000)) {
      if (now - this.lastRecover > 2500) this.recoverRenderer();
      return;
    }
    if (this.lostAt) return;

    if (this.composer) {
      this.bloom.strength = 0.85 + nova * 0.9;
      this.composer.render();
    } else {
      this.renderer.render(this.scene, cam);
    }
  }
}
