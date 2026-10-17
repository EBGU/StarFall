/* =====================================================================
   拾星纪 · 长庚  —  core.js
   数学 / 噪声 / 输入 / 程序化音频 / 存档
   ===================================================================== */
(function () {
  'use strict';
  const S = (window.STAR = window.STAR || {});

  /* ---------------- 基础数学 ---------------- */
  S.TAU = Math.PI * 2;
  S.D2R = Math.PI / 180;
  S.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  S.lerp = (a, b, t) => a + (b - a) * t;
  S.inv = (a, b, v) => (b - a === 0 ? 0 : (v - a) / (b - a));
  S.smooth = (t) => t * t * (3 - 2 * t);
  S.smoothstep = (a, b, v) => S.smooth(S.clamp(S.inv(a, b, v), 0, 1));
  S.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  S.dist2 = (x1, y1, x2, y2) => { const a = x2 - x1, b = y2 - y1; return a * a + b * b; };
  S.ang = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
  S.approach = (cur, target, d) => (cur < target ? Math.min(cur + d, target) : Math.max(cur - d, target));
  S.sign = (v) => (v < 0 ? -1 : 1);
  S.wrap = (a, n) => ((a % n) + n) % n;
  S.frac = (v) => v - Math.floor(v);
  S.easeOut = (t) => 1 - Math.pow(1 - t, 3);
  S.easeIn = (t) => t * t * t;
  S.easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  S.easeBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
  S.pick = (arr, r) => arr[Math.floor((r || Math.random)() * arr.length) % arr.length];

  /* ---------------- 伪随机 ---------------- */
  S.rng = function (seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ---------------- 值噪声 ---------------- */
  const P = new Uint8Array(512);
  (function buildPerm() {
    let s = 0x9e3779b9;
    const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  })();
  function h2(ix, iy) {
    return P[(P[ix & 255] + (iy & 255)) & 255] / 255;
  }
  S.noise = function (x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = S.smooth(x - ix), fy = S.smooth(y - iy);
    const a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1);
    return S.lerp(S.lerp(a, b, fx), S.lerp(c, d, fx), fy);
  };
  S.fbm = function (x, y, oct, lac, gain) {
    oct = oct || 4; lac = lac || 2.03; gain = gain || 0.5;
    let v = 0, amp = 0.5, f = 1, tot = 0;
    for (let i = 0; i < oct; i++) { v += S.noise(x * f, y * f) * amp; tot += amp; amp *= gain; f *= lac; }
    return v / tot;
  };
  S.noise1 = (x) => S.noise(x, 17.31);

  /* ---------------- 颜色 ---------------- */
  S.hsl = (h, s, l, a) => `hsla(${h},${s}%,${l}%,${a === undefined ? 1 : a})`;
  S.rgba = (r, g, b, a) => `rgba(${r | 0},${g | 0},${b | 0},${a === undefined ? 1 : a})`;
  S.mix = function (c1, c2, t) {
    const a = S.hex2rgb(c1), b = S.hex2rgb(c2);
    return `rgb(${S.lerp(a[0], b[0], t) | 0},${S.lerp(a[1], b[1], t) | 0},${S.lerp(a[2], b[2], t) | 0})`;
  };
  S.hex2rgb = function (h) {
    if (h[0] === '#') h = h.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  S.shade = function (hex, amt) {
    const c = S.hex2rgb(hex);
    return c.map((v) => S.clamp(Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt)), 0, 255));
  };
  S.rgbStr = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a === undefined ? 1 : a})`;

  /* ---------------- 输入 ---------------- */
  const Input = S.Input = {
    _rel: Object.create(null),
    stick: null,
    keys: Object.create(null),
    pressed: Object.create(null),
    released: Object.create(null),
    mx: 0, my: 0, mdown: false, mclick: false,
    anyKey: false,
    init() {
      const norm = (e) => {
        let k = e.key;
        if (k === ' ') k = 'space';
        if (k.length === 1) k = k.toLowerCase();
        if (k === 'Shift') k = 'shift';
        if (k === 'Escape') k = 'escape';
        if (k === 'ArrowUp') k = 'w';
        if (k === 'ArrowDown') k = 's';
        if (k === 'ArrowLeft') k = 'a';
        if (k === 'ArrowRight') k = 'd';
        if (k === 'Tab') k = 'tab';
        return k;
      };
      window.addEventListener('keydown', (e) => {
        const k = norm(e);
        if (['space', 'tab', 'w', 'a', 's', 'd', 'j', 'e', 'q', 'f'].includes(k)) e.preventDefault();
        if (!Input.keys[k]) Input.pressed[k] = true;
        Input.keys[k] = true;
        Input.anyKey = true;
      });
      window.addEventListener('keyup', (e) => {
        const k = norm(e);
        Input.keys[k] = false;
        Input.released[k] = true;
      });
      window.addEventListener('blur', () => { Input.keys = Object.create(null); });
      window.addEventListener('mousemove', (e) => { Input.mx = e.clientX; Input.my = e.clientY; });
      window.addEventListener('mousedown', (e) => { if (e.button === 0) { Input.mdown = true; Input.mclick = true; } });
      window.addEventListener('mouseup', (e) => { if (e.button === 0) Input.mdown = false; });
      window.addEventListener('contextmenu', (e) => e.preventDefault());
    },
    press(k) {
      Input.pressed[k] = true;
      Input.keys[k] = true;
      clearTimeout(Input._rel[k]);
      Input._rel[k] = setTimeout(() => { Input.keys[k] = false; }, 110);
    },
    down(k) { return !!Input.keys[k]; },
    hit(k) { return !!Input.pressed[k]; },
    endFrame() { Input.pressed = Object.create(null); Input.released = Object.create(null); Input.mclick = false; }
  };

  /* ---------------- 音频（全程序化合成） ---------------- */
  const AU = S.Audio = {
    ctx: null, master: null, musicBus: null, sfxBus: null, verb: null,
    ready: false, muted: false, theme: 'plain', step: 0, nextT: 0, bpm: 62, playing: false,
    scale: [0, 2, 3, 5, 7, 8, 10], root: 57,

    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      const master = (this.master = ctx.createGain());
      master.gain.value = 0.9;
      master.connect(ctx.destination);

      const music = (this.musicBus = ctx.createGain()); music.gain.value = 0.5;
      const sfx = (this.sfxBus = ctx.createGain()); sfx.gain.value = 0.75;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 3;
      music.connect(comp); sfx.connect(comp); comp.connect(master);

      // 混响
      const verb = (this.verb = ctx.createConvolver());
      const len = ctx.sampleRate * 3.2;
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          const t = i / len;
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.4) * (1 - t * 0.2);
        }
      }
      verb.buffer = ir;
      const vg = ctx.createGain(); vg.gain.value = 0.65;
      verb.connect(vg); vg.connect(comp);
      this.revSend = ctx.createGain(); this.revSend.gain.value = 1; this.revSend.connect(verb);

      // iOS：上下文可能以 suspended 状态创建，需要手势内 resume
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && AU.ctx && AU.ctx.state === 'suspended') {
          try { AU.ctx.resume(); } catch (e) {}
        }
      });

      this.ready = true;
      this.startWind();
      this.startMusic();
    },

    midi(n) { return 440 * Math.pow(2, (n - 69) / 12); },

    /* --- 单音 --- */
    tone(freq, when, dur, opt) {
      if (!this.ready) return;
      opt = opt || {};
      const ctx = this.ctx;
      const g = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = opt.cut || 2600;
      filt.Q.value = 0.6;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) pan.pan.value = opt.pan || 0;
      g.connect(filt);
      if (pan) { filt.connect(pan); pan.connect(opt.bus || this.musicBus); if (opt.verb !== 0) pan.connect(this.revSend); }
      else { filt.connect(opt.bus || this.musicBus); if (opt.verb !== 0) filt.connect(this.revSend); }

      const a = opt.a || 0.01, d = dur, peak = opt.gain === undefined ? 0.16 : opt.gain;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + a);
      g.gain.exponentialRampToValueAtTime(0.0001, when + d);

      const types = opt.type || 'triangle';
      const oscs = [];
      const n = opt.detune ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator();
        o.type = types;
        o.frequency.value = freq;
        if (opt.detune) o.detune.value = (i ? 1 : -1) * opt.detune;
        o.connect(g);
        o.start(when);
        o.stop(when + d + 0.05);
        oscs.push(o);
      }
      if (opt.bell) {
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 3.01;
        const g2 = ctx.createGain(); g2.gain.value = 0.16;
        o2.connect(g2); g2.connect(g);
        o2.start(when); o2.stop(when + d * 0.6);
      }
    },

    /* --- 噪声爆发 --- */
    noise(when, dur, opt) {
      if (!this.ready) return;
      opt = opt || {};
      const ctx = this.ctx;
      const sr = ctx.sampleRate;
      const len = Math.max(1, Math.floor(sr * dur));
      const buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, opt.decay || 1.6);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = opt.type || 'bandpass';
      filt.Q.value = opt.q || 1;
      filt.frequency.setValueAtTime(opt.f0 || 1200, when);
      filt.frequency.exponentialRampToValueAtTime(opt.f1 || 300, when + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(opt.gain === undefined ? 0.2 : opt.gain, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      src.connect(filt); filt.connect(g); g.connect(opt.bus || this.sfxBus);
      if (opt.verb !== 0) g.connect(this.revSend);
      src.start(when);
    },

    /* --- 环境风 --- */
    startWind() {
      const ctx = this.ctx;
      const sr = ctx.sampleRate;
      const len = sr * 4;
      const buf = ctx.createBuffer(2, len, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let last = 0;
        for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = last * 0.985 + w * 0.015; d[i] = last * 6; }
      }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 620;
      const g = ctx.createGain(); g.gain.value = 0.0;
      src.connect(filt); filt.connect(g); g.connect(this.master);
      src.start();
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.055;
      const lg = ctx.createGain(); lg.gain.value = 0.045;
      lfo.connect(lg); lg.connect(g.gain);
      lfo.start();
      g.gain.setTargetAtTime(0.09, ctx.currentTime + 0.4, 2.5);
      this.windGain = g;
    },

    /* --- 主题 --- */
    setTheme(name) {
      this.theme = name;
      if (name === 'plain') { this.root = 57; this.scale = [0, 2, 3, 5, 7, 8, 10]; this.bpm = 60; }
      else if (name === 'cloud') { this.root = 50; this.scale = [0, 2, 3, 5, 7, 9, 10]; this.bpm = 56; }
      else if (name === 'court') { this.root = 53; this.scale = [0, 1, 3, 5, 7, 8, 11]; this.bpm = 50; }
      else if (name === 'sad') { this.root = 55; this.scale = [0, 2, 3, 5, 7, 8, 10]; this.bpm = 48; }
      else if (name === 'star') { this.root = 62; this.scale = [0, 2, 4, 7, 9, 12, 14]; this.bpm = 66; }
    },
    startMusic() { this.playing = true; this.nextT = this.ctx.currentTime + 0.2; this.step = 0; },
    pauseMusic() { this.playing = false; },
    resumeMusic() { if (this.ready) { this.playing = true; this.nextT = Math.max(this.ctx.currentTime + 0.1, this.nextT); } },

    tick() {
      if (!this.ready || !this.playing || this.muted) return;
      const ctx = this.ctx;
      if (this.nextT < ctx.currentTime - 0.4) this.nextT = ctx.currentTime + 0.05;
      const spb = 60 / this.bpm;
      const stepDur = spb / 2;
      while (this.nextT < ctx.currentTime + 0.25) {
        this.scheduleStep(this.step, this.nextT);
        this.nextT += stepDur;
        this.step++;
      }
    },

    scheduleStep(step, t) {
      const s = this.scale, r = this.root;
      const bar = Math.floor(step / 8) % 4;
      const beat = step % 8;
      const deg = (i) => { const o = Math.floor(i / s.length); return r + s[((i % s.length) + s.length) % s.length] + o * 12; };
      const prog = [0, -3, 2, -1]; // 和弦根音级进
      const rootDeg = prog[bar];

      // 低音
      if (beat === 0 || beat === 5) {
        this.tone(this.midi(deg(rootDeg) - 12), t, 2.6, { type: 'sine', gain: 0.13, cut: 600, verb: 0.4 });
      }
      // 铺底
      if (beat === 0) {
        for (let i = 0; i < 3; i++) {
          const n = deg(rootDeg + [0, 2, 4][i]) + (i === 2 ? 12 : 0);
          this.tone(this.midi(n), t, 4.4, { type: 'sawtooth', gain: 0.030, cut: 800, detune: 6, a: 0.9, pan: (i - 1) * 0.35, verb: 0.8 });
        }
      }
      // 琶音
      const arpIdx = [0, 2, 4, 2, 5, 4, 2, 0];
      if (beat % 2 === 0 || Math.random() < 0.34) {
        const n = deg(rootDeg + arpIdx[beat % 8]) + (this.theme === 'court' ? 0 : 12);
        this.tone(this.midi(n), t, 1.5, {
          type: 'triangle', gain: 0.055, cut: 3200, bell: true,
          pan: (Math.random() - 0.5) * 0.7, verb: 0.7, a: 0.006
        });
      }
      // 稀疏旋律
      if ((this.theme === 'sad' || this.theme === 'star') && step % 16 === 10) {
        this.tone(this.midi(deg(4 + Math.floor(Math.random() * 3)) + 24), t, 2.2, { type: 'sine', gain: 0.05, cut: 4200, verb: 1 });
      }
    },

    /* --- 音效 --- */
    sfx(name) {
      if (!this.ready || this.muted) return;
      const t = this.ctx.currentTime;
      switch (name) {
        case 'ui': this.tone(880, t, 0.16, { type: 'sine', gain: 0.05, bus: this.sfxBus, cut: 4000, verb: 0.2 }); break;
        case 'blip': this.tone(560 + Math.random() * 60, t, 0.055, { type: 'triangle', gain: 0.022, bus: this.sfxBus, verb: 0 }); break;
        case 'slash':
          this.noise(t, 0.22, { f0: 3400, f1: 700, q: 0.8, gain: 0.16, type: 'bandpass' });
          this.tone(320, t, 0.12, { type: 'sawtooth', gain: 0.04, bus: this.sfxBus, cut: 1800, verb: 0 });
          break;
        case 'hit':
          this.noise(t, 0.16, { f0: 900, f1: 120, q: 0.7, gain: 0.22, type: 'lowpass' });
          this.tone(140, t, 0.13, { type: 'square', gain: 0.06, bus: this.sfxBus, cut: 900, verb: 0 });
          break;
        case 'hurt':
          this.noise(t, 0.3, { f0: 600, f1: 90, gain: 0.24, type: 'lowpass' });
          this.tone(220, t, 0.3, { type: 'sawtooth', gain: 0.06, bus: this.sfxBus, cut: 1200 });
          break;
        case 'skill':
          this.noise(t, 0.6, { f0: 500, f1: 2600, q: 1.4, gain: 0.2, type: 'bandpass' });
          this.tone(392, t, 0.5, { type: 'triangle', gain: 0.07, bus: this.sfxBus, cut: 3000, bell: true });
          break;
        case 'burst':
          this.noise(t, 1.4, { f0: 200, f1: 5200, q: 1.6, gain: 0.3, type: 'bandpass', decay: 1.1 });
          [0, 7, 12, 19].forEach((n, i) => this.tone(this.midi(57 + n + 12), t + i * 0.06, 2.0, { type: 'sine', gain: 0.07, bell: true, cut: 5000 }));
          break;
        case 'pickup':
          [0, 4, 7, 12].forEach((n, i) => this.tone(this.midi(74 + n), t + i * 0.055, 1.1, { type: 'sine', gain: 0.06, bell: true, cut: 6000 }));
          break;
        case 'echo':
          this.tone(this.midi(69), t, 2.6, { type: 'sine', gain: 0.09, bell: true, cut: 2600 });
          this.tone(this.midi(76), t + 0.18, 2.4, { type: 'sine', gain: 0.05, bell: true, cut: 2600 });
          break;
        case 'quest':
          [0, 5, 9, 12].forEach((n, i) => this.tone(this.midi(64 + n), t + i * 0.13, 1.5, { type: 'triangle', gain: 0.05, bell: true }));
          break;
        case 'door': this.noise(t, 0.9, { f0: 240, f1: 80, gain: 0.18, type: 'lowpass' }); break;
        case 'death':
          this.noise(t, 1.6, { f0: 700, f1: 60, gain: 0.26, type: 'lowpass', decay: 1.2 });
          break;
      }
    },

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.1);
      return this.muted;
    }
  };

  /* ---------------- 触屏 ---------------- */
  S.QUALITY = { dpr: Math.min(window.devicePixelRatio || 1, 2), grassCell: 17, bloom: true, bloomCheap: false, particles: 1 };

  const Touch = S.Touch = {
    on: false, forced: false,
    stick: { active: false, x: 0, y: 0, id: null, ox: 0, oy: 0 },
    init(force) {
      this.forced = !!force;
      let coarse = false;
      try { coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (e) { coarse = false; }
      this.on = !!(force || coarse);
      Input.stick = this.stick;
      this.bind();
      return this.on;
    },
    bind() {
      const $ = S.$;
      const zone = $('stickZone'), base = $('stick'), knob = $('knob');
      if (!zone) return;
      const R = 54, dead = 0.16;
      zone.addEventListener('pointerdown', (e) => {
        if (S.HUD && S.HUD.dlg) return;
        e.preventDefault();
        this.stick.active = true;
        this.stick.id = e.pointerId;
        this.stick.ox = e.clientX; this.stick.oy = e.clientY;
        base.style.left = e.clientX + 'px';
        base.style.top = e.clientY + 'px';
        base.classList.remove('hidden');
        knob.style.transform = '';
        try { zone.setPointerCapture(e.pointerId); } catch (err) {}
      });
      zone.addEventListener('pointermove', (e) => {
        if (!this.stick.active || e.pointerId !== this.stick.id) return;
        e.preventDefault();
        const dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
        const len = Math.hypot(dx, dy) || 1;
        const k = len > R ? R / len : 1;
        knob.style.transform = 'translate(' + (dx * k).toFixed(1) + 'px,' + (dy * k).toFixed(1) + 'px)';
        let nx = (dx / R), ny = (dy / R);
        const m = Math.hypot(nx, ny);
        if (m < dead) { nx = 0; ny = 0; }
        else {
          const t = Math.min(1, (m - dead) / (1 - dead)) / Math.max(m, 0.0001);
          nx *= t; ny *= t;
        }
        this.stick.x = S.clamp(nx, -1, 1);
        this.stick.y = S.clamp(ny, -1, 1);
      });
      const end = (e) => {
        if (e.pointerId !== this.stick.id) return;
        this.stick.active = false; this.stick.x = 0; this.stick.y = 0;
        base.classList.add('hidden');
      };
      zone.addEventListener('pointerup', end);
      zone.addEventListener('pointercancel', end);
      zone.addEventListener('lostpointercapture', end);

      const bind = (id, key) => {
        const b = $(id);
        if (!b) return;
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault(); e.stopPropagation();
          Input.press(key);
          b.classList.add('down');
        });
        const up = () => b.classList.remove('down');
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', up);
        b.addEventListener('pointerleave', up);
      };
      bind('tbAttack', 'j');
      bind('tbSkill', 'e');
      bind('tbBurst', 'q');
      bind('tbDash', 'shift');
      bind('tbInteract', 'f');
    },
    show(on) {
      const t = document.getElementById('touch');
      if (!t) return;
      t.classList.toggle('hidden', !on);
      requestAnimationFrame(() => t.classList.toggle('on', on));
    },
    setInteract(show) {
      const b = document.getElementById('tbInteract');
      if (b) b.classList.toggle('hidden', !show);
    },
    hint() {
      const h = document.getElementById('rotateHint');
      if (!h) return;
      if (window.innerHeight > window.innerWidth) {
        h.classList.add('on');
        setTimeout(() => h.classList.remove('on'), 5200);
      }
    }
  };

  /* ---------------- 存档 ---------------- */
  const KEY = 'starfall_changeng_v1';
  S.Save = {
    write(d) {
      try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { return false; }
    },
    read() {
      try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
    },
    exists() { return !!S.Save.read(); },
    clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  };

  /* ---------------- DOM 小工具 ---------------- */
  S.$ = (id) => document.getElementById(id);
  S.el = function (tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
})();
