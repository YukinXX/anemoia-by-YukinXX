//by YukinX

export class Sound {
  constructor(settings) {
    this.s = settings;
    this.ctx = null;
    this.amb = null;
    this.lastTick = 0;
    this.unlocked = false;
  }

  init() {
    this.AC = window.AudioContext || window.webkitAudioContext;
    if (!this.AC) return;
    const unlock = () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      this.createContext();
    };
    if (navigator.userActivation && navigator.userActivation.hasBeenActive) this.createContext();
    else {
      window.addEventListener('pointerdown', unlock, true);
      window.addEventListener('keydown', unlock, true);
    }

    document.addEventListener('visibilitychange', () => {
      if (!this.unlocked || !this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
  }

  createContext() {
    if (this.ctx) return;
    const ctx = this.ctx = new this.AC();

    this.master = ctx.createGain();
    this.master.gain.value = this.targetVolume();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(3.4, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.reverb.connect(wet).connect(this.master);

    this.dry = ctx.createGain();
    this.dry.connect(this.master);

    if (ctx.state === 'running') this.onUnlocked();
    else ctx.resume().then(() => this.onUnlocked()).catch(() => {});
  }

  onUnlocked() {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.s.ambient) this.startAmbient();
  }

  targetVolume() { return this.s.muted ? 0 : this.s.volume * 0.9; }

  applySettings() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.targetVolume(), now, 0.15);
    if (this.s.ambient && this.unlocked) this.startAmbient();
    if (!this.s.ambient) this.stopAmbient();
  }

  makeImpulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  canPlay() { return this.ctx && this.unlocked && this.s.uiSound && !this.s.muted; }

  tone({ freq, type = 'sine', dur = 0.15, gain = 0.1, attack = 0.005, glide = null, delay = 0, wet = 0.35, pan = 0 }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glide) osc.frequency.exponentialRampToValueAtTime(glide, t0 + dur * 0.85);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc.connect(g);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node = node.connect(p);
    }
    node.connect(this.dry);
    const send = ctx.createGain();
    send.gain.value = wet;
    node.connect(send).connect(this.reverb);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noiseSweep({ from = 400, to = 3000, dur = 0.4, gain = 0.04, delay = 0 }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(from, t0);
    bp.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp).connect(g);
    g.connect(this.dry);
    g.connect(this.reverb);
    src.start(t0);
  }

  tick(dir = 1) {
    if (!this.canPlay()) return;
    const now = performance.now();
    if (now - this.lastTick < 32) return;
    this.lastTick = now;
    const f = dir > 0 ? 1318.5 : 1568;
    this.tone({ freq: f, dur: 0.11, gain: 0.05, wet: 0.45, pan: 0.15 });
    this.tone({ freq: f * 2, dur: 0.05, gain: 0.012, wet: 0.2 });
  }

  enter() {
    if (!this.canPlay()) return;
    this.tone({ freq: 880, dur: 0.45, gain: 0.055, wet: 0.6 });
    this.tone({ freq: 1318.5, dur: 0.5, gain: 0.045, delay: 0.055, wet: 0.6 });
    this.tone({ freq: 1760, dur: 0.6, gain: 0.02, delay: 0.11, wet: 0.8 });
  }

  back() {
    if (!this.canPlay()) return;
    this.tone({ freq: 1174.7, dur: 0.3, gain: 0.045, wet: 0.55 });
    this.tone({ freq: 784, dur: 0.4, gain: 0.04, delay: 0.06, wet: 0.55 });
  }

  bump() {
    if (!this.canPlay()) return;
    this.tone({ freq: 196, type: 'triangle', dur: 0.16, gain: 0.07, wet: 0.25 });
  }

  open() {
    if (!this.canPlay()) return;
    this.tone({ freq: 440, glide: 1760, dur: 0.5, gain: 0.05, wet: 0.7 });
    this.tone({ freq: 660, glide: 2637, dur: 0.55, gain: 0.025, delay: 0.04, wet: 0.8 });
    this.noiseSweep({ from: 500, to: 6000, dur: 0.45, gain: 0.05 });
  }

  intro() {
    if (!this.ctx || !this.unlocked || this.s.muted) return;

    const chord = [110, 164.81, 220, 246.94, 329.63, 493.88];
    chord.forEach((f, i) => this.tone({ freq: f, type: i < 2 ? 'triangle' : 'sine', dur: 5.2, gain: 0.05 - i * 0.005, attack: 1.8, wet: 0.7, pan: (i % 2 ? 0.3 : -0.3) }));

    this.tone({ freq: 62, glide: 40, dur: 2.2, gain: 0.16, delay: 2.2, wet: 0.4 });
    this.noiseSweep({ from: 300, to: 5000, dur: 2.0, gain: 0.03, delay: 0.4 });

    [1318.5, 1760, 1975.5, 2637].forEach((f, i) => this.tone({ freq: f, dur: 1.4, gain: 0.018, delay: 2.4 + i * 0.12, wet: 0.9, pan: i % 2 ? 0.5 : -0.5 }));
  }

  startAmbient() {
    if (this.amb || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(0.14, now + 4);
    out.connect(this.dry);
    const send = ctx.createGain();
    send.gain.value = 0.6;
    out.connect(send).connect(this.reverb);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 560; lp.Q.value = 0.8;
    lp.connect(out);

    const nodes = [];
    const voices = [[55, 'triangle', 0.32], [82.41, 'sine', 0.26], [110, 'sine', 0.2], [123.47, 'sine', 0.12], [164.81, 'sine', 0.1], [246.94, 'sine', 0.05]];
    for (const [f, type, gain] of voices) {
      for (const det of [-5, 5]) {
        const o = ctx.createOscillator();
        o.type = type; o.frequency.value = f; o.detune.value = det + (Math.random() * 4 - 2);
        const g = ctx.createGain(); g.gain.value = gain / 2;
        o.connect(g).connect(lp);
        o.start(now);
        nodes.push(o);
      }
    }

    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.045;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start(now); nodes.push(lfo);

    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.5;
    const ng = ctx.createGain(); ng.gain.value = 0.018;
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.07;
    const lfo2g = ctx.createGain(); lfo2g.gain.value = 0.012;
    lfo2.connect(lfo2g).connect(ng.gain);
    noise.connect(bp).connect(ng).connect(out);
    noise.start(now); lfo2.start(now);
    nodes.push(noise, lfo2);

    this.amb = { out, nodes };
  }

  stopAmbient() {
    if (!this.amb) return;
    const { out, nodes } = this.amb;
    this.amb = null;
    const now = this.ctx.currentTime;
    out.gain.cancelScheduledValues(now);
    out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), now);
    out.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    nodes.forEach((n) => { try { n.stop(now + 1.3); } catch {  } });
  }
}
