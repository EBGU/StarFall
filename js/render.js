/* =====================================================================
   拾星纪 · 长庚  —  render.js
   投影 / 云海 / 地表 / 草海 / 立绘 / 粒子 / 后期
   ===================================================================== */
(function () {
  'use strict';
  const S = window.STAR;
  const YS = 0.90;            // 纵向压缩（伪 3/4 视角）

  /* ---------------- 相机 ---------------- */
  const Cam = S.Cam = {
    x: 880, y: 1690, z: 1.15, tx: 880, ty: 1690, tz: 1.15,
    shake: 0, sx: 0, sy: 0, lock: false,
    follow(x, y, dt, speed) {
      this.tx = x; this.ty = y;
      const k = 1 - Math.pow(0.0015, dt * (speed || 1));
      this.x += (this.tx - this.x) * k;
      this.y += (this.ty - this.y) * k;
      this.shake *= Math.pow(0.0025, dt);
      this.sx = (Math.random() - 0.5) * this.shake;
      this.sy = (Math.random() - 0.5) * this.shake;
    },
    kick(v) { this.shake = Math.min(34, this.shake + v); }
  };

  const R = S.Render = {
    W: 1280, H: 720, dpr: 1, ctx: null, cv: null,
    t: 0, wind: 0, mood: 0, moodB: 0, moodC: 0, flash: 0, flashColor: '#fff',
    vign: 1,

    init(cv) {
      this.cv = cv;
      this.ctx = cv.getContext('2d', { alpha: false });
      this.bloomA = document.createElement('canvas');
      this.bloomB = document.createElement('canvas');
      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.buildClouds();
    },

    resize() {
      const cv = this.cv;
      this.dpr = (S.QUALITY && S.QUALITY.dpr) ? S.QUALITY.dpr : Math.min(2, window.devicePixelRatio || 1);
      this.W = Math.max(320, cv.clientWidth || window.innerWidth);
      this.H = Math.max(240, cv.clientHeight || window.innerHeight);
      cv.width = Math.round(this.W * this.dpr);
      cv.height = Math.round(this.H * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.colShift = this.H * 0.58;
      this.bloomA.width = Math.max(2, Math.round(this.W / 4));
      this.bloomA.height = Math.max(2, Math.round(this.H / 4));
      this.bloomB.width = Math.max(2, Math.round(this.W / 8));
      this.bloomB.height = Math.max(2, Math.round(this.H / 8));
    },

    /* 世界 → 屏幕 */
    sx(x) { return (x - Cam.x) * Cam.z + this.W / 2 + Cam.sx; },
    sy(y) { return (y - Cam.y) * Cam.z * YS + this.colShift + Cam.sy; },
    visibleRect(pad) {
      pad = pad || 0;
      const hw = (this.W / 2) / Cam.z + pad;
      const hh1 = this.colShift / (Cam.z * YS) + pad;
      const hh2 = (this.H - this.colShift) / (Cam.z * YS) + pad;
      return { x0: Cam.x - hw, y0: Cam.y - hh1, x1: Cam.x + hw, y1: Cam.y + hh2 };
    },

    /* ================= 云海背景 ================= */
    buildClouds() {
      const r = S.rng(90210);
      this.clouds = [];
      for (let i = 0; i < 16; i++) {
        this.clouds.push({
          x: r() * 2400, y: r() * 1600, r: 180 + r() * 340,
          a: 0.20 + r() * 0.34, s: 0.55 + r() * 0.5, d: r()
        });
      }
      this.isles = [];
      for (let i = 0; i < 7; i++) {
        this.isles.push({ x: r() * 2600, y: r() * 1700, s: 0.5 + r() * 1.1, d: r(), k: r() });
      }
    },

    drawSky(g) {
      const W = this.W, H = this.H;
      const m = this.mood, mb = this.moodB, mc = this.moodC;
      // 云海底色
      const grd = g.createRadialGradient(W * 0.26, H * 0.22, 40, W * 0.5, H * 0.6, Math.max(W, H) * 0.95);
      if (mc > 0.5) {
        grd.addColorStop(0, '#1b2634');
        grd.addColorStop(0.42, '#131c28');
        grd.addColorStop(1, '#080c14');
      } else if (mb > 0.5) {
        grd.addColorStop(0, '#c9d6d0');
        grd.addColorStop(0.4, '#9cb4ae');
        grd.addColorStop(1, '#567680');
      } else {
        grd.addColorStop(0, '#cfc8ab');
        grd.addColorStop(0.38, '#a6bcb2');
        grd.addColorStop(1, '#5f7f88');
      }
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);

      // 云团
      const ox = -Cam.x * 0.10, oy = -Cam.y * 0.09;
      for (const c of this.clouds) {
        let x = ((c.x + ox * (0.5 + c.d)) % 2400 + 2400) % 2400 - 260;
        let y = ((c.y + oy * (0.5 + c.d)) % 1600 + 1600) % 1600 - 200;
        x = x / 2400 * (W + 520) - 260;
        y = y / 1600 * (H + 400) - 200;
        const rr = c.r * (W / 1400) * c.s;
        const cg = g.createRadialGradient(x, y, rr * 0.1, x, y, rr);
        if (mc > 0.5) {
          cg.addColorStop(0, `rgba(70,90,120,${c.a * 0.55})`);
          cg.addColorStop(1, 'rgba(20,28,40,0)');
        } else if (mb > 0.5) {
          cg.addColorStop(0, `rgba(255,255,250,${c.a * 0.66})`);
          cg.addColorStop(0.55, `rgba(226,238,236,${c.a * 0.34})`);
          cg.addColorStop(1, 'rgba(200,222,222,0)');
        } else {
          cg.addColorStop(0, `rgba(255,252,238,${c.a * 0.70})`);
          cg.addColorStop(0.55, `rgba(246,244,222,${c.a * 0.32})`);
          cg.addColorStop(1, 'rgba(230,236,214,0)');
        }
        g.fillStyle = cg;
        g.beginPath(); g.arc(x, y, rr, 0, S.TAU); g.fill();
      }

      // 远处浮岛剪影
      for (const il of this.isles) {
        const px = ((il.x - Cam.x * 0.30) % 2600 + 2600) % 2600;
        const py = ((il.y - Cam.y * 0.26) % 1750 + 1750) % 1750;
        const x = px / 2600 * (W + 400) - 200;
        const y = py / 1750 * (H + 300) - 150;
        const s = (W / 1500) * il.s * 1.5;
        g.save();
        g.globalAlpha = mc > 0.5 ? 0.30 : 0.42;
        g.translate(x, y); g.scale(s, s);
        g.fillStyle = mc > 0.5 ? '#0d131c' : '#8fa9ac';
        g.beginPath();
        g.moveTo(-60, 0); g.lineTo(-46, -16); g.lineTo(-14, -22); g.lineTo(10, -16);
        g.lineTo(44, -20); g.lineTo(64, -6); g.lineTo(52, 4); g.lineTo(30, 8);
        g.lineTo(46, 26); g.lineTo(20, 18); g.lineTo(-4, 30); g.lineTo(-18, 16);
        g.lineTo(-40, 10); g.closePath(); g.fill();
        g.restore();
      }

      // 光柱
      if (mc < 0.5) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        const sunX = W * 0.24 + Math.sin(this.t * 0.05) * 30;
        for (let i = 0; i < 3; i++) {
          const a = -0.5 + i * 0.19 + Math.sin(this.t * 0.07 + i) * 0.02;
          const len = H * 1.5;
          const w = 46 + i * 26;
          const lg = g.createLinearGradient(sunX, 0, sunX + Math.sin(a) * len, Math.cos(a) * len);
          lg.addColorStop(0, `rgba(255,248,214,${0.05 - i * 0.011})`);
          lg.addColorStop(1, 'rgba(255,248,214,0)');
          g.fillStyle = lg;
          g.beginPath();
          g.moveTo(sunX, -60);
          g.lineTo(sunX + Math.sin(a) * len - w, Math.cos(a) * len);
          g.lineTo(sunX + Math.sin(a) * len + w, Math.cos(a) * len);
          g.closePath(); g.fill();
        }
        g.restore();
      }

      // C 区的星空
      if (mc > 0.02) {
        g.save();
        const r = S.rng(1234);
        for (let i = 0; i < 160; i++) {
          const x = r() * W, y = r() * H;
          const tw = 0.4 + 0.6 * Math.abs(Math.sin(this.t * (0.5 + r()) + i));
          g.fillStyle = `rgba(${200 + r() * 55 | 0},${220 + r() * 35 | 0},255,${(0.15 + r() * 0.5) * mc * tw})`;
          const s = r() * 1.6 + 0.4;
          g.fillRect(x, y, s, s);
        }
        // 星环
        g.globalCompositeOperation = 'lighter';
        g.translate(W * 0.52, -H * 0.55);
        g.rotate(-0.22);
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.ellipse(0, 0, W * 0.85 + i * 12, H * 0.8 + i * 8, 0, 0.16, Math.PI - 0.16);
          g.strokeStyle = `rgba(${180 - i * 30},${230 - i * 20},255,${(0.10 - i * 0.025) * mc})`;
          g.lineWidth = 9 - i * 2.4;
          g.stroke();
        }
        g.restore();
      }
    },

    /* ================= 地表 ================= */
    drawGround(g, game) {
      const Wd = S.World;
      if (!Wd.base) return;
      const vr = this.visibleRect(60);
      const BS = Wd.BS;
      const x0 = S.clamp(vr.x0, 0, Wd.W), y0 = S.clamp(vr.y0, 0, Wd.H);
      const x1 = S.clamp(vr.x1, 0, Wd.W), y1 = S.clamp(vr.y1, 0, Wd.H);
      if (x1 <= x0 || y1 <= y0) return;
      const sx0 = this.sx(x0), sy0 = this.sy(y0);
      const sx1 = this.sx(x1), sy1 = this.sy(y1);
      g.imageSmoothingEnabled = true;
      g.drawImage(Wd.base,
        x0 * BS, y0 * BS, (x1 - x0) * BS, (y1 - y0) * BS,
        sx0, sy0, sx1 - sx0, sy1 - sy0);
    },

    /* ================= 水面 / 崖风 ================= */
    drawWaterFX(g) {
      const Wd = S.World, t = this.t;
      const vr = this.visibleRect(80);
      // 河面粼光
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < Wd.RIVER.length - 1; i++) {
        const a = Wd.RIVER[i], b = Wd.RIVER[i + 1];
        if (Math.max(a[1], b[1]) < vr.y0 || Math.min(a[1], b[1]) > vr.y1) continue;
        if (Math.max(a[0], b[0]) < vr.x0 || Math.min(a[0], b[0]) > vr.x1) continue;
        const n = 9;
        for (let k = 0; k < n; k++) {
          const u = (k + 0.5) / n;
          const ph = (t * 0.6 + i * 0.7 + k * 1.31);
          const x = S.lerp(a[0], b[0], u) + Math.sin(ph) * Wd.riverW(i) * 0.26;
          const y = S.lerp(a[1], b[1], u) + Math.cos(ph * 1.3) * 10;
          const al = 0.10 + 0.16 * Math.abs(Math.sin(ph * 2.1));
          const sxp = this.sx(x), syp = this.sy(y);
          const w = (14 + Math.sin(ph * 3) * 8) * Cam.z;
          g.fillStyle = `rgba(226,252,248,${al})`;
          g.beginPath(); g.ellipse(sxp, syp, w, 2.2 * Cam.z, 0, 0, S.TAU); g.fill();
        }
      }
      // 断崖下的雾
      for (let i = 0; i < Wd.CHASM.length - 1; i++) {
        const a = Wd.CHASM[i], b = Wd.CHASM[i + 1];
        if (Math.max(a[1], b[1]) < vr.y0 - 200 || Math.min(a[1], b[1]) > vr.y1 + 200) continue;
        for (let k = 0; k < 5; k++) {
          const u = (k + 0.5) / 5;
          const ph = t * 0.24 + i * 0.9 + k * 2.1;
          const x = S.lerp(a[0], b[0], u) + Math.sin(ph) * 40;
          const y = S.lerp(a[1], b[1], u) + Math.cos(ph * 0.8) * 30;
          const sxp = this.sx(x), syp = this.sy(y);
          const rr = (90 + Math.sin(ph) * 26) * Cam.z;
          const cg = g.createRadialGradient(sxp, syp, 0, sxp, syp, rr);
          cg.addColorStop(0, 'rgba(128,168,190,0.10)');
          cg.addColorStop(1, 'rgba(120,160,180,0)');
          g.fillStyle = cg;
          g.beginPath(); g.arc(sxp, syp, rr, 0, S.TAU); g.fill();
        }
      }
      g.restore();
    },

    /* ================= 草海 ================= */
    drawGrass(g, game) {
      const vr = this.visibleRect(40);
      const cell = 26;
      const t = this.t;
      const p = game.player;
      const px = p ? p.x : 1e9, py = p ? p.y : 1e9;
      const buckets = [[], [], [], []];
      const x0 = Math.floor(vr.x0 / cell) * cell, x1 = vr.x1;
      const y0 = Math.floor(vr.y0 / cell) * cell, y1 = vr.y1;
      const f = S.World;
      for (let y = y0; y < y1; y += cell) {
        for (let x = x0; x < x1; x += cell) {
          let h = (x * 374761393 + y * 668265263) | 0;
          h = (h ^ (h >> 13)) * 1274126177 | 0;
          const r1 = ((h ^ (h >> 16)) >>> 0) / 4294967296;
          const h2 = (h * 31 + 7) | 0;
          const r2 = ((h2 ^ (h2 >> 15)) >>> 0) / 4294967296;
          if (r1 > 0.88) continue;
          const wx = x + r2 * cell, wy = y + r1 * cell;
          if (f.terrainAt(wx, wy) !== 0 && f.terrainAt(wx, wy) !== 2) continue;
          if (f.terrainAt(wx, wy) === 2) continue;
          const reg = f.regionAt(wx);
          if (reg === 'C' && r1 > 0.35) continue;
          const dense = 1;
          const hgt = 7 + r2 * 12 + (reg === 'B' ? 5 : 0);
          // 风
          const gust = Math.sin(wx * 0.004 + t * 0.9) * 0.5 + Math.sin(wy * 0.0032 - t * 0.6) * 0.4;
          let bend = (Math.sin(t * 1.7 + wx * 0.02 + wy * 0.015) * 0.5 + gust) * (2.2 + hgt * 0.18);
          // 玩家踩踏
          const dd = S.dist2(wx, wy, px, py);
          if (dd < 4900) {
            const d = Math.sqrt(dd) || 1;
            const push = (1 - d / 70);
            bend += ((wx - px) / d) * push * 9;
          }
          const sxp = this.sx(wx), syp = this.sy(wy);
          const bi = (r1 * 3.99) | 0;
          buckets[bi].push([sxp, syp, bend * Cam.z, hgt * Cam.z, r2]);
        }
      }
      const cols = [
        ['rgba(104,142,86,0.85)', 1.7],
        ['rgba(134,166,98,0.80)', 1.5],
        ['rgba(160,180,112,0.72)', 1.3],
        ['rgba(86,124,96,0.75)', 1.6]
      ];
      g.save();
      g.lineCap = 'round';
      const mc = this.moodC;
      for (let i = 0; i < 4; i++) {
        const arr = buckets[i];
        if (!arr.length) continue;
        g.strokeStyle = mc > 0.5 ? `rgba(${60 + i * 12},${70 + i * 10},${90 + i * 8},0.55)` : cols[i][0];
        g.lineWidth = cols[i][1] * Cam.z;
        g.beginPath();
        for (let k = 0; k < arr.length; k++) {
          const b = arr[k];
          g.moveTo(b[0], b[1]);
          g.quadraticCurveTo(b[0] + b[2] * 0.35, b[1] - b[3] * 0.62, b[0] + b[2], b[1] - b[3]);
        }
        g.stroke();
      }
      g.restore();
    },

    /* 风痕 */
    drawWindStreaks(g) {
      const t = this.t, W = this.W, H = this.H;
      g.save();
      g.globalCompositeOperation = 'lighter';
      const mc = this.moodC;
      for (let i = 0; i < 5; i++) {
        const ph = (t * 0.11 + i * 0.27) % 1;
        const x = -W * 0.2 + ph * W * 1.5;
        const y = H * (0.16 + i * 0.17) + Math.sin(t * 0.5 + i) * 24;
        const len = W * (0.20 + 0.1 * Math.sin(i * 2.1));
        const a = (0.05 + 0.045 * Math.sin(t * 0.9 + i * 1.7)) * (mc > 0.5 ? 0.4 : 1);
        const lg = g.createLinearGradient(x, y, x + len, y - 30);
        lg.addColorStop(0, 'rgba(255,255,245,0)');
        lg.addColorStop(0.5, `rgba(240,255,248,${a})`);
        lg.addColorStop(1, 'rgba(255,255,245,0)');
        g.strokeStyle = lg;
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(x, y);
        g.bezierCurveTo(x + len * 0.3, y - 16, x + len * 0.7, y + 10, x + len, y - 26);
        g.stroke();
      }
      g.restore();
    },

    /* ================= 阴影 ================= */
    shadow(g, x, y, rx, ry, a) {
      const sxp = this.sx(x + rx * 0.42), syp = this.sy(y + ry * 0.38);
      g.fillStyle = `rgba(10,24,24,${(a === undefined ? 0.22 : a) * 0.95})`;
      g.beginPath();
      g.ellipse(sxp, syp, rx * 1.16 * Cam.z, ry * 0.82 * Cam.z * YS, -0.42, 0, S.TAU);
      g.fill();
    }
  };

  /* ==========================================================
     通用绘制辅助
     ========================================================== */
  R.Cam = Cam;

  function path(g, pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
  }
  function rim(g, pts, col, w) {
    g.strokeStyle = col; g.lineWidth = w || 1.4; g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
  }

  /* ==========================================================
     物件绘制
     ========================================================== */
  const P = R.props = {};

  P.tree = function (g, p, s, t) {
    const sway = Math.sin(t * 0.7 + p.sw) * 0.035 + Math.sin(t * 1.9 + p.x * 0.01) * 0.012;
    const H0 = 150 * s;
    // 树干
    g.save();
    g.translate(0, 0);
    g.fillStyle = '#4a3b30';
    g.beginPath();
    g.moveTo(-7 * s, 0); g.quadraticCurveTo(-4 * s, -H0 * 0.3, -3 * s, -H0 * 0.42);
    g.lineTo(3 * s, -H0 * 0.42); g.quadraticCurveTo(5 * s, -H0 * 0.25, 8 * s, 0);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(120,96,74,0.7)';
    g.fillRect(-3 * s, -H0 * 0.42, 2 * s, H0 * 0.42);
    // 树冠
    const cy = -H0 * 0.66;
    const blobs = [[-26, 6, 34], [24, 2, 32], [0, -22, 40], [-8, 26, 30], [14, 22, 26]];
    g.save();
    g.rotate(sway);
    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i];
      const x = b[0] * s, y = cy + b[1] * s, r = b[2] * s;
      const grd = g.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
      if (i === 2) { grd.addColorStop(0, '#a8cf7e'); grd.addColorStop(0.55, '#7aad63'); grd.addColorStop(1, '#4e7a4e'); }
      else { grd.addColorStop(0, '#8fbe70'); grd.addColorStop(0.55, '#639a58'); grd.addColorStop(1, '#3f6644'); }
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, S.TAU); g.fill();
    }
    // 受光边
    g.fillStyle = 'rgba(226,246,190,0.30)';
    g.beginPath(); g.arc(-14 * s, cy - 34 * s, 26 * s, 0, S.TAU); g.fill();
    g.restore();
    g.restore();
  };

  P.sakura = function (g, p, s, t) {
    const sway = Math.sin(t * 0.62 + p.sw) * 0.04;
    const H0 = 140 * s;
    g.fillStyle = '#4e3b36';
    g.beginPath();
    g.moveTo(-7 * s, 0); g.quadraticCurveTo(-4 * s, -H0 * 0.3, -3 * s, -H0 * 0.44);
    g.lineTo(3 * s, -H0 * 0.44); g.quadraticCurveTo(6 * s, -H0 * 0.25, 8 * s, 0);
    g.closePath(); g.fill();
    const cy = -H0 * 0.7;
    g.save(); g.rotate(sway);
    const blobs = [[-28, 4, 30], [26, 0, 28], [0, -24, 38], [-6, 26, 27], [12, 20, 24]];
    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i];
      const x = b[0] * s, y = cy + b[1] * s, r = b[2] * s;
      const grd = g.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
      grd.addColorStop(0, '#ffe4ec'); grd.addColorStop(0.5, '#f5bccd'); grd.addColorStop(1, '#c98ba8');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, S.TAU); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath(); g.arc(-12 * s, cy - 30 * s, 22 * s, 0, S.TAU); g.fill();
    g.restore();
  };

  P.pine = function (g, p, s, t) {
    const sway = Math.sin(t * 0.55 + p.sw) * 0.03;
    const H0 = 175 * s;
    g.fillStyle = '#3d332c';
    g.fillRect(-5 * s, -H0 * 0.4, 10 * s, H0 * 0.4);
    g.save(); g.rotate(sway);
    for (let i = 0; i < 4; i++) {
      const y = -H0 * (0.32 + i * 0.18);
      const w = (52 - i * 10) * s;
      const grd = g.createLinearGradient(-w, y, w, y - 60 * s);
      grd.addColorStop(0, '#2c5244');
      grd.addColorStop(0.5, '#3f6b54');
      grd.addColorStop(1, '#59876a');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(-w, y);
      g.quadraticCurveTo(0, y - 18 * s, 0, y - 54 * s);
      g.quadraticCurveTo(0, y - 18 * s, w, y);
      g.quadraticCurveTo(0, y + 10 * s, -w, y);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(190,232,200,0.22)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-w * 0.7, y - 4 * s); g.quadraticCurveTo(0, y - 30 * s, w * 0.7, y - 4 * s); g.stroke();
    }
    g.restore();
  };

  P.dead = function (g, p, s, t) {
    const sway = Math.sin(t * 0.5 + p.sw) * 0.03;
    g.save(); g.rotate(sway);
    g.strokeStyle = '#2a2b33'; g.lineCap = 'round';
    g.lineWidth = 6 * s;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-6 * s, -50 * s, -2 * s, -100 * s); g.stroke();
    g.lineWidth = 3 * s;
    for (let i = 0; i < 6; i++) {
      const y = -46 * s - i * 14 * s;
      const dir = i % 2 ? 1 : -1;
      g.beginPath();
      g.moveTo(-2 * s, y);
      g.quadraticCurveTo(dir * 22 * s, y - 16 * s, dir * 38 * s, y - 30 * s);
      g.stroke();
    }
    g.strokeStyle = 'rgba(120,150,180,0.25)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-2 * s, 0); g.quadraticCurveTo(-6 * s, -50 * s, -2 * s, -100 * s); g.stroke();
    g.restore();
  };

  P.rock = function (g, p, s, t) {
    const r = 26 * s;
    const pts = [];
    const rr = S.rng(p.seed * 977 + 13);
    const n = 6 + ((rr() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * S.TAU;
      const rad = r * (0.7 + rr() * 0.5);
      pts.push([Math.cos(a) * rad, Math.sin(a) * rad * 0.68 - r * 0.25]);
    }
    const reg = S.World.regionAt(p.x);
    const grd = g.createLinearGradient(-r, -r, r, r * 0.4);
    if (reg === 'C') {
      grd.addColorStop(0, '#4c5464');
      grd.addColorStop(0.45, '#2c323e');
      grd.addColorStop(1, '#161a22');
    } else if (reg === 'B') {
      grd.addColorStop(0, '#8b9a96');
      grd.addColorStop(0.5, '#5e6f6e');
      grd.addColorStop(1, '#37474a');
    } else {
      grd.addColorStop(0, '#93998a');
      grd.addColorStop(0.5, '#697468');
      grd.addColorStop(1, '#3f4a44');
    }
    g.fillStyle = grd;
    path(g, pts); g.fill();
    g.strokeStyle = reg === 'C' ? 'rgba(140,200,230,0.30)' : 'rgba(216,226,208,0.28)';
    g.lineWidth = 1.4;
    g.beginPath();
    for (let i = 0; i < 3; i++) { g.moveTo(pts[i][0] * 0.9, pts[i][1] * 0.9); g.lineTo(pts[i + 1][0] * 0.9, pts[i + 1][1] * 0.9); }
    g.stroke();
    // 苔
    g.fillStyle = 'rgba(110,160,100,0.35)';
    g.beginPath(); g.ellipse(-r * 0.3, -r * 0.55, r * 0.42, r * 0.2, 0.2, 0, S.TAU); g.fill();
  };

  P.house = function (g, p, s, t) {
    const w = 92, h = 62;
    g.save();
    g.fillStyle = 'rgba(60,46,36,0.95)';
    g.fillRect(-w / 2, -h, w, h);
    g.fillStyle = 'rgba(92,72,55,0.9)';
    for (let i = 0; i < 4; i++) g.fillRect(-w / 2 + 6 + i * 22, -h + 8, 3, h - 12);
    // 屋顶（青瓦）
    const grd = g.createLinearGradient(0, -h - 54, 0, -h);
    grd.addColorStop(0, '#5d7d86');
    grd.addColorStop(1, '#35525c');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(-w / 2 - 18, -h + 4);
    g.quadraticCurveTo(0, -h - 66, w / 2 + 18, -h + 4);
    g.quadraticCurveTo(0, -h - 8, -w / 2 - 18, -h + 4);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(180,220,224,0.4)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-w / 2 - 14, -h + 2); g.quadraticCurveTo(0, -h - 60, w / 2 + 14, -h + 2); g.stroke();
    // 窗
    const flick = 0.72 + Math.sin(t * 2.1 + p.seed) * 0.08;
    const wg = g.createRadialGradient(18, -h + 26, 2, 18, -h + 26, 26);
    wg.addColorStop(0, `rgba(255,226,160,${0.95 * flick})`);
    wg.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = wg;
    g.beginPath(); g.arc(18, -h + 26, 26, 0, S.TAU); g.fill();
    g.fillStyle = `rgba(255,222,150,${0.92 * flick})`;
    g.fillRect(11, -h + 20, 15, 14);
    g.strokeStyle = '#3a2f26'; g.lineWidth = 2; g.strokeRect(11, -h + 20, 15, 14);
    // 门
    g.fillStyle = '#2c211a';
    g.fillRect(-w / 2 + 14, -34, 22, 34);
    g.strokeStyle = 'rgba(200,170,120,.4)'; g.lineWidth = 1.4; g.strokeRect(-w / 2 + 14, -34, 22, 34);
    g.restore();
  };

  P.pharmacy = function (g, p, s, t) {
    P.house(g, p, s, t);
    g.save();
    // 药幌（带挑杆）
    g.strokeStyle = '#4a3a2a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-44, -118); g.lineTo(-96, -118); g.stroke();
    g.beginPath(); g.moveTo(-44, -118); g.lineTo(-44, -90); g.stroke();
    g.strokeStyle = '#6b5238'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-90, -118); g.lineTo(-90, -110); g.stroke();
    g.fillStyle = 'rgba(100,148,108,0.94)';
    g.fillRect(-102, -110, 24, 48);
    g.strokeStyle = 'rgba(240,244,228,0.45)'; g.lineWidth = 1;
    g.strokeRect(-102, -110, 24, 48);
    g.fillStyle = 'rgba(240,240,225,0.92)';
    g.font = '15px "Noto Serif SC",serif'; g.textAlign = 'center';
    g.fillText('药', -90, -86);
    g.fillText('庐', -90, -68);
    // 晾药架
    g.strokeStyle = '#5a4632'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(70, -10); g.lineTo(70, -70); g.moveTo(130, -10); g.lineTo(130, -70);
    g.moveTo(64, -66); g.lineTo(136, -66); g.stroke();
    for (let i = 0; i < 5; i++) {
      g.fillStyle = ['#8aa86a', '#a8b06a', '#c9a06a'][i % 3];
      g.beginPath(); g.ellipse(72 + i * 14, -66 + 12, 5, 9, 0, 0, S.TAU); g.fill();
    }
    g.restore();
  };

  P.well = function (g, p, s) {
    g.fillStyle = '#5a6462';
    g.beginPath(); g.ellipse(0, 0, 26, 14, 0, 0, S.TAU); g.fill();
    g.fillStyle = '#1a2a2c';
    g.beginPath(); g.ellipse(0, -2, 18, 9, 0, 0, S.TAU); g.fill();
    g.strokeStyle = '#7f8b86'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(0, -2, 26, 13, 0, 0, S.TAU); g.stroke();
    g.fillStyle = 'rgba(120,200,200,0.25)';
    g.beginPath(); g.ellipse(0, -2, 16, 8, 0, 0, S.TAU); g.fill();
  };

  P.gate = function (g, p, s, t) {
    g.fillStyle = '#4a3a2a';
    g.fillRect(-92, -150, 14, 150);
    g.fillRect(78, -150, 14, 150);
    g.fillStyle = '#5c4632';
    g.fillRect(-110, -168, 220, 16);
    g.fillStyle = '#6b5238';
    g.fillRect(-96, -150, 192, 10);
    // 旗
    const fl = Math.sin(t * 2 + p.seed) * 5;
    g.fillStyle = 'rgba(126,186,158,0.85)';
    g.beginPath();
    g.moveTo(6, -148); g.lineTo(6, -70);
    g.quadraticCurveTo(30 + fl, -96, 6, -148);
    g.fill();
    g.fillStyle = 'rgba(240,235,215,0.9)';
    g.font = '16px serif'; g.textAlign = 'center';
    g.fillText('云栖', 24 + fl * 0.4, -104);
    g.font = '10px serif';
    g.fillText('栖', 24, -86);
  };

  P.tower = function (g, p, s, t) {
    g.fillStyle = '#3d332a';
    g.fillRect(-46, -120, 8, 120);
    g.fillRect(38, -120, 8, 120);
    g.fillStyle = '#4e4034';
    g.fillRect(-54, -128, 108, 10);
    g.fillRect(-50, -60, 100, 8);
    g.strokeStyle = '#3d332a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-50, -60); g.lineTo(-40, -120); g.moveTo(50, -60); g.lineTo(40, -120); g.stroke();
    // 灯
    const fl = 0.75 + Math.sin(t * 3.1) * 0.12;
    const gg = g.createRadialGradient(0, -140, 2, 0, -140, 22);
    gg.addColorStop(0, `rgba(255,214,140,${0.8 * fl})`);
    gg.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = gg;
    g.beginPath(); g.arc(0, -140, 22, 0, S.TAU); g.fill();
    g.fillStyle = '#ffd894';
    g.beginPath(); g.arc(0, -140, 6, 0, S.TAU); g.fill();
    g.strokeStyle = '#2b2620'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(0, -152); g.lineTo(0, -128); g.stroke();
  };

  P.fence = function (g, p, s) {
    g.strokeStyle = '#6b5a42'; g.lineWidth = 3;
    for (let i = -3; i <= 3; i++) {
      g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16, -20); g.stroke();
    }
    g.beginPath(); g.moveTo(-50, -15); g.lineTo(50, -15); g.stroke();
    g.beginPath(); g.moveTo(-50, -7); g.lineTo(50, -7); g.stroke();
  };

  P.field = function (g, p) {
    g.save();
    g.strokeStyle = 'rgba(176,152,110,0.45)'; g.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      g.beginPath(); g.moveTo(-70, -10 + i * 6); g.quadraticCurveTo(0, -16 + i * 6, 70, -10 + i * 6); g.stroke();
    }
    g.strokeStyle = 'rgba(120,160,90,0.5)'; g.lineWidth = 1.4;
    for (let i = 0; i < 26; i++) {
      const x = -66 + (i * 5.2) % 132, y = -8 + (i * 13) % 44;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2, y - 7); g.stroke();
    }
    g.restore();
  };

  P.lamp = function (g, p, s, t) {
    g.strokeStyle = '#4a3b2c'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -58); g.stroke();
    g.beginPath(); g.moveTo(0, -58); g.lineTo(12, -58); g.stroke();
    const fl = 0.8 + Math.sin(t * 2.4 + p.seed) * 0.1;
    const gg = g.createRadialGradient(12, -48, 1, 12, -48, 16);
    gg.addColorStop(0, `rgba(255,214,140,${0.55 * fl})`);
    gg.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gg; g.beginPath(); g.arc(12, -48, 16, 0, S.TAU); g.fill();
    g.fillStyle = '#ffe0a8';
    g.beginPath(); g.ellipse(12, -48, 5, 7, 0, 0, S.TAU); g.fill();
  };

  P.lampBlue = function (g, p, s, t) {
    const fl = 0.7 + Math.sin(t * 1.7 + p.seed) * 0.15;
    const bob = Math.sin(t * 0.9 + p.seed) * 4;
    const gg = g.createRadialGradient(0, -40 + bob, 1, 0, -40 + bob, 40);
    gg.addColorStop(0, `rgba(150,240,255,${0.6 * fl})`);
    gg.addColorStop(1, 'rgba(120,220,255,0)');
    g.fillStyle = gg; g.beginPath(); g.arc(0, -40 + bob, 40, 0, S.TAU); g.fill();
    g.fillStyle = '#ccf6ff';
    g.beginPath(); g.arc(0, -40 + bob, 4.5, 0, S.TAU); g.fill();
  };

  P.stele = function (g, p, s, t) {
    const h = 74 * s, w = 26 * s;
    g.fillStyle = '#8d968f';
    g.beginPath();
    g.moveTo(-w / 2, 0); g.lineTo(-w / 2, -h + 8); g.quadraticCurveTo(0, -h - 8, w / 2, -h + 8);
    g.lineTo(w / 2, 0); g.closePath(); g.fill();
    g.fillStyle = 'rgba(200,212,204,0.55)';
    g.fillRect(-w / 2, -h + 6, 3, h - 6);
    g.fillStyle = 'rgba(30,40,42,0.28)';
    g.fillRect(w / 2 - 4, -h + 6, 4, h - 6);
    // 刮痕
    g.strokeStyle = 'rgba(40,50,52,0.55)'; g.lineWidth = 1.6;
    for (let i = 0; i < 5; i++) {
      const y = -h + 16 + i * 11 * s;
      g.beginPath(); g.moveTo(-w * 0.3, y); g.lineTo(w * 0.32, y + 1); g.stroke();
    }
    g.fillStyle = 'rgba(120,140,120,0.35)';
    g.beginPath(); g.ellipse(0, -2, w * 0.8, 5, 0, 0, S.TAU); g.fill();
  };

  P.steleBig = function (g, p, s, t) {
    const h = 150 * s, w = 62 * s;
    g.fillStyle = '#78827c';
    g.beginPath();
    g.moveTo(-w / 2, 0); g.lineTo(-w / 2, -h + 16); g.quadraticCurveTo(0, -h - 14, w / 2, -h + 16);
    g.lineTo(w / 2, 0); g.closePath(); g.fill();
    g.fillStyle = 'rgba(190,204,196,0.5)';
    g.fillRect(-w / 2, -h + 8, 5, h - 8);
    g.strokeStyle = 'rgba(36,46,48,0.5)'; g.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const y = -h + 26 + i * 13 * s;
      g.beginPath(); g.moveTo(-w * 0.28, y); g.lineTo(w * 0.3, y + 2); g.stroke();
    }
    // 唯一没被刮掉的字
    g.fillStyle = 'rgba(233,215,171,0.75)';
    g.font = `${20 * s}px serif`; g.textAlign = 'center';
    g.fillText('秤', 0, -h * 0.62);
    g.fillStyle = 'rgba(120,140,120,0.3)';
    g.beginPath(); g.ellipse(0, -4, w * 0.9, 8, 0, 0, S.TAU); g.fill();
  };

  P.arch = function (g, p, s, t) {
    g.strokeStyle = '#6a756d'; g.lineWidth = 12 * s; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(-44 * s, 0); g.lineTo(-44 * s, -54 * s);
    g.quadraticCurveTo(0, -96 * s, 44 * s, -54 * s); g.lineTo(44 * s, 0); g.stroke();
    g.strokeStyle = 'rgba(200,214,204,0.4)'; g.lineWidth = 2.4 * s;
    g.beginPath(); g.moveTo(-44 * s, -6); g.lineTo(-44 * s, -52 * s); g.stroke();
  };

  P.archBig = function (g, p, s, t) {
    g.strokeStyle = '#78837a'; g.lineWidth = 26 * s;
    g.beginPath(); g.moveTo(-100 * s, 0); g.lineTo(-100 * s, -90 * s);
    g.quadraticCurveTo(0, -190 * s, 100 * s, -90 * s); g.lineTo(100 * s, 0); g.stroke();
    g.strokeStyle = 'rgba(226,236,226,0.35)'; g.lineWidth = 4 * s;
    g.beginPath(); g.moveTo(-100 * s, -10); g.lineTo(-100 * s, -92 * s);
    g.quadraticCurveTo(0, -186 * s, 100 * s, -92 * s); g.stroke();
    // 藤
    g.strokeStyle = 'rgba(96,140,96,0.55)'; g.lineWidth = 2.4 * s;
    for (let i = 0; i < 6; i++) {
      const x = -90 * s + i * 36 * s;
      g.beginPath(); g.moveTo(x, -96 * s - Math.cos(i) * 20 * s);
      g.quadraticCurveTo(x + 8 * s, -50 * s, x - 4 * s, -10 * s); g.stroke();
    }
  };

  P.column = function (g, p, s, t) {
    const h = p.broken ? 96 * s : 150 * s;
    const w = 22 * s;
    g.fillStyle = '#828e84';
    g.fillRect(-w / 2, -h, w, h);
    g.fillStyle = 'rgba(214,224,210,0.45)';
    g.fillRect(-w / 2, -h, w * 0.32, h);
    g.fillStyle = 'rgba(60,72,72,0.30)';
    g.fillRect(w / 2 - w * 0.22, -h, w * 0.22, h);
    g.fillStyle = '#aab4a8';
    g.fillRect(-w * 0.75, -h - 7, w * 1.5, 8);
    g.fillRect(-w * 0.8, -6, w * 1.6, 6);
    if (p.broken) {
      g.fillStyle = 'rgba(80,92,90,0.9)';
      g.beginPath(); g.moveTo(-w / 2, -h); g.lineTo(-w * 0.2, -h + 12); g.lineTo(w * 0.3, -h + 2); g.lineTo(w / 2, -h + 14); g.lineTo(w / 2, -h); g.closePath(); g.fill();
    }
    // 苔
    g.fillStyle = 'rgba(110,156,110,0.28)';
    g.beginPath(); g.ellipse(0, -12, w * 0.9, 8, 0, 0, S.TAU); g.fill();
  };

  P.ruinWall = function (g, p, s, t) {
    g.save();
    const grd = g.createLinearGradient(-120, -150, 120, 0);
    grd.addColorStop(0, '#949f92');
    grd.addColorStop(0.55, '#78857c');
    grd.addColorStop(1, '#4e5c58');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(-118, 0);
    g.lineTo(-118, -104); g.lineTo(-96, -112); g.lineTo(-92, -136); g.lineTo(-58, -142);
    g.lineTo(-52, -86); g.lineTo(-20, -80); g.lineTo(-16, -70);
    g.lineTo(16, -74); g.lineTo(20, -128); g.lineTo(44, -140); g.lineTo(58, -118);
    g.lineTo(84, -126); g.lineTo(92, -96); g.lineTo(118, -88); g.lineTo(118, 0);
    g.closePath(); g.fill();
    // 砖块
    const rr = p._rr || (p._rr = rndArr(p.seed || 3, 40));
    g.strokeStyle = 'rgba(46,56,54,0.30)'; g.lineWidth = 1.2;
    for (let row = 0; row < 6; row++) {
      const y = -12 - row * 22;
      g.beginPath(); g.moveTo(-116, y); g.lineTo(116, y); g.stroke();
      const off = (row % 2) * 18;
      for (let i = 0; i < 7; i++) {
        const x = -108 + off + i * 36;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 22); g.stroke();
      }
    }
    // 受光面
    g.fillStyle = 'rgba(206,216,200,0.18)';
    g.beginPath();
    g.moveTo(-118, 0); g.lineTo(-118, -102); g.lineTo(-96, -110); g.lineTo(-92, -134);
    g.lineTo(-72, -138); g.lineTo(-72, 0); g.closePath(); g.fill();
    // 阴影面
    g.fillStyle = 'rgba(20,28,28,0.22)';
    g.fillRect(84, -120, 34, 120);
    // 苔
    g.fillStyle = 'rgba(104,142,104,0.30)';
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.ellipse(-90 + rr[i] * 190, -6 - rr[i + 7] * 40, 12 + rr[i + 14] * 18, 5 + rr[i + 21] * 6, 0.2, 0, S.TAU);
      g.fill();
    }
    g.restore();
  };

  P.altar = function (g, p, s, t) {
    g.fillStyle = '#aeb6a8';
    g.fillRect(-58, -34, 116, 34);
    g.fillStyle = '#cdd3c4';
    g.fillRect(-46, -46, 92, 14);
    g.fillStyle = 'rgba(120,240,230,0.25)';
    g.beginPath(); g.ellipse(0, -40, 34, 8, 0, 0, S.TAU); g.fill();
    g.fillStyle = 'rgba(150,255,240,0.6)';
    g.beginPath(); g.arc(0, -46, 4, 0, S.TAU); g.fill();
    // 符文圈
    g.strokeStyle = `rgba(140,240,230,${0.25 + Math.sin(t * 1.4) * 0.08})`;
    g.lineWidth = 1.6;
    g.beginPath(); g.ellipse(0, -46, 78, 26, 0, 0, S.TAU); g.stroke();
  };

  P.obsPillar = function (g, p, s, t) {
    const h = 210 * s;
    g.fillStyle = '#232833';
    g.beginPath();
    g.moveTo(-16, 0); g.lineTo(-11, -h); g.lineTo(11, -h); g.lineTo(16, 0);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(96,120,150,0.35)';
    g.fillRect(-13, -h, 4, h);
    g.strokeStyle = `rgba(${120 + Math.sin(t * 2 + p.seed) * 40 | 0},230,255,0.50)`;
    g.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      const y = -h * (0.25 + i * 0.17);
      g.beginPath(); g.moveTo(-8, y); g.lineTo(8, y - 6); g.stroke();
    }
    g.fillStyle = 'rgba(140,240,255,0.55)';
    g.beginPath(); g.arc(0, -h - 4, 4, 0, S.TAU); g.fill();
  };

  P.crystal = function (g, p, s, t) {
    const bob = Math.sin(t * 0.8) * 8;
    g.save();
    g.translate(0, -70 + bob);
    // 光柱
    const bg = g.createLinearGradient(0, -300, 0, 120);
    bg.addColorStop(0, 'rgba(150,240,255,0)');
    bg.addColorStop(0.5, `rgba(150,240,255,${0.10 + Math.sin(t) * 0.03})`);
    bg.addColorStop(1, 'rgba(150,240,255,0)');
    g.fillStyle = bg;
    g.fillRect(-30, -300, 60, 420);
    // 晶体
    g.rotate(t * 0.25);
    const cg = g.createLinearGradient(-20, 0, 20, 0);
    cg.addColorStop(0, '#c8f8ff'); cg.addColorStop(0.5, '#7fd8ee'); cg.addColorStop(1, '#3d7fa8');
    g.fillStyle = cg;
    g.beginPath();
    g.moveTo(0, -70); g.lineTo(22, -20); g.lineTo(14, 40); g.lineTo(-14, 40); g.lineTo(-22, -20);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(230,255,255,0.85)'; g.lineWidth = 1.6; g.stroke();
    g.beginPath(); g.moveTo(0, -70); g.lineTo(0, 40); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.stroke();
    g.restore();
    const gg = g.createRadialGradient(0, -70, 4, 0, -70, 100);
    gg.addColorStop(0, 'rgba(180,250,255,0.30)');
    gg.addColorStop(1, 'rgba(140,230,255,0)');
    g.fillStyle = gg; g.beginPath(); g.arc(0, -70, 100, 0, S.TAU); g.fill();
  };

  P.shard = function (g, p, s, t) {
    const bob = Math.sin(t * 0.6 + p.seed) * 10;
    g.save();
    g.translate(0, -110 + bob);
    g.rotate(Math.sin(t * 0.3 + p.seed) * 0.3);
    g.fillStyle = 'rgba(60,70,88,0.95)';
    g.beginPath();
    g.moveTo(0, -60 * s); g.lineTo(26 * s, -6 * s); g.lineTo(10 * s, 44 * s); g.lineTo(-16 * s, 30 * s); g.lineTo(-24 * s, -14 * s);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(140,230,255,0.5)'; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = 'rgba(140,230,255,0.20)';
    g.beginPath(); g.moveTo(0, -60 * s); g.lineTo(26 * s, -6 * s); g.lineTo(0, 4 * s); g.closePath(); g.fill();
    g.restore();
  };

  P.shardSmall = function (g, p, s, t) {
    const bob = Math.sin(t * 0.9 + p.seed) * 5;
    g.save(); g.translate(0, -14 + bob);
    g.fillStyle = 'rgba(120,200,220,0.55)';
    g.beginPath(); g.moveTo(0, -16 * s); g.lineTo(9 * s, 0); g.lineTo(0, 12 * s); g.lineTo(-8 * s, 0); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(200,250,255,0.5)'; g.lineWidth = 1; g.stroke();
    g.restore();
  };

  P.bridgeWood = function (g, p, s) {
    g.save();
    g.rotate(0);
    // 桥面
    g.fillStyle = '#6a5238';
    g.fillRect(-160, -70, 320, 140);
    for (let i = 0; i < 12; i++) {
      g.fillStyle = i % 2 ? 'rgba(126,100,68,0.9)' : 'rgba(94,74,50,0.9)';
      g.fillRect(-160 + i * 26.6, -70, 25, 140);
      g.strokeStyle = 'rgba(40,30,20,0.5)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-160 + i * 26.6, -70); g.lineTo(-160 + i * 26.6, 70); g.stroke();
    }
    g.strokeStyle = '#4a3a28'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(-160, -68); g.lineTo(160, -68); g.moveTo(-160, 68); g.lineTo(160, 68); g.stroke();
    // 栏杆
    g.strokeStyle = '#5a4632'; g.lineWidth = 3;
    for (let i = -3; i <= 3; i++) {
      g.beginPath(); g.moveTo(i * 46, -72); g.lineTo(i * 46, -92); g.stroke();
    }
    g.beginPath(); g.moveTo(-150, -88); g.lineTo(150, -88); g.stroke();
    g.restore();
  };

  P.bridgeStone = function (g, p, s) {
    g.fillStyle = '#5a636a';
    g.fillRect(-210, -90, 420, 180);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 3; j++) {
        g.fillStyle = `rgba(${120 + (i * 7 + j * 11) % 40},${128 + (i * 5) % 30},${132 + (j * 9) % 26},0.55)`;
        g.fillRect(-210 + i * 52, -90 + j * 60, 50, 58);
      }
    }
    g.strokeStyle = 'rgba(30,36,40,0.6)'; g.lineWidth = 2;
    g.strokeRect(-210, -90, 420, 180);
    g.strokeStyle = 'rgba(160,220,240,0.30)'; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(-204, -86); g.lineTo(204, -86); g.stroke();
    g.beginPath(); g.moveTo(-204, 86); g.lineTo(204, 86); g.stroke();
  };

  P.brokenBridge = function (g, p, s) {
    g.save();
    g.fillStyle = '#5b4632';
    g.fillRect(-150, -60, 150, 120);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? 'rgba(118,94,64,0.9)' : 'rgba(86,68,46,0.9)';
      g.fillRect(-150 + i * 25, -60, 23, 120);
    }
    g.strokeStyle = '#3a2c1e'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(-150, -58); g.lineTo(0, -58); g.moveTo(-150, 58); g.lineTo(0, 58); g.stroke();
    // 断口
    g.fillStyle = 'rgba(10,18,24,0.9)';
    g.beginPath(); g.moveTo(0, -60); g.lineTo(30, -30); g.lineTo(6, 0); g.lineTo(26, 30); g.lineTo(0, 60); g.closePath(); g.fill();
    g.restore();
  };

  P.obsFloor = function (g, p, s, t) {
    g.save();
    g.translate(0, 0);
    g.strokeStyle = 'rgba(120,180,220,0.16)'; g.lineWidth = 2;
    for (let i = 1; i <= 5; i++) {
      g.beginPath(); g.ellipse(0, 0, i * 92, i * 82, 0, 0, S.TAU); g.stroke();
    }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * S.TAU;
      g.beginPath(); g.moveTo(Math.cos(a) * 100, Math.sin(a) * 90);
      g.lineTo(Math.cos(a) * 470, Math.sin(a) * 415); g.stroke();
    }
    g.strokeStyle = `rgba(200,120,150,${0.12 + Math.sin(t) * 0.03})`;
    g.beginPath(); g.ellipse(0, 0, 300, 270, 0, 0, S.TAU); g.stroke();
    g.restore();
  };

  P.ruinFloor = function (g, p, s, t) {
    g.save();
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * S.TAU;
      g.strokeStyle = 'rgba(210,214,200,0.10)';
      g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 300, Math.sin(a) * 270); g.stroke();
    }
    g.strokeStyle = 'rgba(210,214,200,0.14)';
    g.beginPath(); g.ellipse(0, 0, 300, 270, 0, 0, S.TAU); g.stroke();
    g.beginPath(); g.ellipse(0, 0, 150, 135, 0, 0, S.TAU); g.stroke();
    g.restore();
  };

  P.compass = function (g, p, s, t) {
    const bob = Math.sin(t * 1.4) * 5;
    g.save();
    // 光柱
    g.globalCompositeOperation = 'lighter';
    const lg = g.createLinearGradient(0, -220, 0, 10);
    lg.addColorStop(0, 'rgba(150,240,230,0)');
    lg.addColorStop(0.7, 'rgba(150,240,230,0.10)');
    lg.addColorStop(1, 'rgba(200,255,248,0.26)');
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(-28, 6); g.lineTo(-6, -220); g.lineTo(6, -220); g.lineTo(28, 6);
    g.closePath(); g.fill();
    // 光晕
    const gg = g.createRadialGradient(0, -16 + bob, 2, 0, -16 + bob, 58);
    gg.addColorStop(0, 'rgba(200,255,248,0.55)');
    gg.addColorStop(0.4, 'rgba(150,230,225,0.18)');
    gg.addColorStop(1, 'rgba(150,230,225,0)');
    g.fillStyle = gg;
    g.beginPath(); g.arc(0, -16 + bob, 58, 0, S.TAU); g.fill();
    g.globalCompositeOperation = 'source-over';
    // 星盘
    g.translate(0, -16 + bob);
    g.rotate(Math.sin(t * 0.7) * 0.18);
    g.fillStyle = '#c9a45c';
    g.beginPath(); g.ellipse(0, 0, 15, 15, 0, 0, S.TAU); g.fill();
    g.fillStyle = '#2b3a38';
    g.beginPath(); g.ellipse(0, 0, 12, 12, 0, 0, S.TAU); g.fill();
    g.strokeStyle = 'rgba(200,255,248,0.9)'; g.lineWidth = 1;
    g.beginPath(); g.arc(0, 0, 12, 0, S.TAU); g.stroke();
    g.beginPath(); g.arc(0, 0, 8, 0, S.TAU); g.stroke();
    // 指针
    const a = t * 1.8;
    g.strokeStyle = '#bff6ea'; g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(Math.cos(a) * 9, Math.sin(a) * 9);
    g.lineTo(-Math.cos(a) * 4, -Math.sin(a) * 4);
    g.stroke();
    // 裂纹
    g.strokeStyle = 'rgba(20,30,30,0.8)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-12, -3); g.lineTo(-3, 2); g.lineTo(2, 12); g.stroke();
    g.restore();
  };

  P.campfire = function (g, p, s, t) {
    g.strokeStyle = '#4a3828'; g.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * S.TAU + 0.4;
      g.beginPath(); g.moveTo(Math.cos(a) * 14, Math.sin(a) * 8); g.lineTo(Math.cos(a + 2.5) * 14, Math.sin(a + 2.5) * 8); g.stroke();
    }
    const fl = 0.8 + Math.sin(t * 7 + p.seed) * 0.2;
    const gg = g.createRadialGradient(0, -14, 2, 0, -14, 54);
    gg.addColorStop(0, `rgba(255,200,120,${0.55 * fl})`);
    gg.addColorStop(0.4, `rgba(255,140,70,${0.20 * fl})`);
    gg.addColorStop(1, 'rgba(255,120,60,0)');
    g.fillStyle = gg; g.beginPath(); g.arc(0, -14, 54, 0, S.TAU); g.fill();
    for (let i = 0; i < 3; i++) {
      const h = 26 + Math.sin(t * 9 + i * 2) * 8;
      const x = Math.sin(t * 6 + i * 2.2) * 5;
      g.fillStyle = ['rgba(255,210,120,0.9)', 'rgba(255,150,80,0.8)', 'rgba(255,235,180,0.85)'][i];
      g.beginPath();
      g.moveTo(x - 6, 0);
      g.quadraticCurveTo(x - 3, -h * 0.6, x, -h);
      g.quadraticCurveTo(x + 4, -h * 0.5, x + 6, 0);
      g.closePath(); g.fill();
    }
  };

  /* 扁平物件（画在地表之上、实体之下） */
  const FLAT = { ruinFloor: 1, obsFloor: 1, field: 1, bridgeWood: 1, bridgeStone: 1, brokenBridge: 1 };

  R.drawFlatProps = function (g, list) {
    for (const p of list) {
      if (!FLAT[p.t]) continue;
      const fn = P[p.t];
      if (!fn) continue;
      g.save();
      g.translate(this.sx(p.x), this.sy(p.y));
      g.scale(Cam.z, Cam.z);
      if (p.rot) g.rotate(p.rot);
      fn(g, p, p.s || 1, this.t);
      g.restore();
    }
  };

  R.drawProp = function (g, p, game) {
    const fn = P[p.t];
    if (!fn) return;
    if (p.t === 'compass' && game && game.stage !== 'wake') return;
    g.save();
    g.translate(this.sx(p.x), this.sy(p.y));
    g.scale(Cam.z, Cam.z);
    if (p.rot) g.rotate(p.rot || 0);
    fn(g, p, p.s || 1, this.t, game);
    g.restore();
  };

  /* ==========================================================
     人物立绘（矢量）
     ========================================================== */
  function hairShape(g, c, shape, sway) {
    if (shape === 'long') {
      g.fillStyle = c.hair2;
      g.beginPath();
      g.moveTo(-15, -96);
      g.quadraticCurveTo(-24 + sway, -70, -18 + sway, -30);
      g.lineTo(18 + sway, -30);
      g.quadraticCurveTo(24 + sway, -70, 15, -96);
      g.closePath(); g.fill();
    }
    if (shape === 'pony') {
      g.fillStyle = c.hair2;
      g.beginPath();
      g.moveTo(8, -92);
      g.quadraticCurveTo(34 + sway * 2, -78, 30 + sway * 3, -44);
      g.quadraticCurveTo(20 + sway, -60, 10, -84);
      g.closePath(); g.fill();
    }
    if (shape === 'braid') {
      g.fillStyle = c.hair2;
      for (let i = 0; i < 5; i++) {
        const y = -84 + i * 13, x = -18 + i * 1.5 + sway * (i / 5);
        g.beginPath(); g.ellipse(x, y, 6 - i * 0.6, 8 - i * 0.7, 0.2, 0, S.TAU); g.fill();
      }
    }
  }

  /**
   * 绘制角色
   * st: {t, walk, dir, atk, hurt, dead, alpha, isNpc}
   */
  R.drawHuman = function (g, id, x, y, scale, st) {
    const def = S.CHARS[id] || S.CHARS.villager;
    const c = def.c;
    st = st || {};
    const t = st.t || 0;
    const walk = st.walk || 0;
    const dir = st.dir === undefined ? 1 : st.dir;
    const atk = st.atk || 0;
    const S0 = scale;
    const bob = Math.sin(t * 9) * walk * 1.6;
    const sway = Math.sin(t * 2.2 + (st.seed || 0)) * (2 + walk * 4);

    g.save();
    g.translate(x, y);
    g.scale(S0 * dir, S0);

    const body = (c.cloth || '#5a6a6a');
    const body2 = (c.cloth2 || '#3a4848');
    const accent = (c.accent || '#e9d7ab');
    const skin = (c.skin || '#f0d8c4');

    const gy = -bob * 0.4;

    // 腿
    const legSw = Math.sin(t * 9) * walk * 7;
    g.strokeStyle = body2; g.lineWidth = 7.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-4, -34 + gy); g.lineTo(-4 + legSw * 0.5, -2); g.stroke();
    g.beginPath(); g.moveTo(4, -34 + gy); g.lineTo(4 - legSw * 0.5, -2); g.stroke();
    g.strokeStyle = '#2a2320'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(-4 + legSw * 0.5, -4); g.lineTo(-5 + legSw * 0.5, 0); g.stroke();
    g.beginPath(); g.moveTo(4 - legSw * 0.5, -4); g.lineTo(3 - legSw * 0.5, 0); g.stroke();

    // 裙/外袍
    const skirtSway = Math.sin(t * 2.4) * (1.5 + walk * 3);
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(-9, -66 + gy);
    g.quadraticCurveTo(-14, -40, -16 + skirtSway, -22);
    g.quadraticCurveTo(0, -16, 16 + skirtSway, -22);
    g.quadraticCurveTo(14, -40, 9, -66 + gy);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.14)';
    g.beginPath();
    g.moveTo(2, -66 + gy); g.quadraticCurveTo(10, -42, 16 + skirtSway, -22);
    g.quadraticCurveTo(4, -18, 0, -20); g.closePath(); g.fill();
    // 金边
    g.strokeStyle = accent; g.lineWidth = 1.2; g.globalAlpha = 0.75;
    g.beginPath(); g.moveTo(-15 + skirtSway, -23); g.quadraticCurveTo(0, -17, 15 + skirtSway, -23); g.stroke();
    g.globalAlpha = 1;

    // 躯干
    const tg = g.createLinearGradient(-10, -80, 12, -40);
    tg.addColorStop(0, body);
    tg.addColorStop(1, body2);
    g.fillStyle = tg;
    g.beginPath();
    g.moveTo(-10, -78 + gy);
    g.quadraticCurveTo(-12, -60, -9, -44 + gy);
    g.lineTo(9, -44 + gy);
    g.quadraticCurveTo(12, -60, 10, -78 + gy);
    g.closePath(); g.fill();
    // 衣领
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath(); g.moveTo(-9, -78 + gy); g.lineTo(0, -66 + gy); g.lineTo(9, -78 + gy); g.lineTo(0, -74 + gy); g.closePath(); g.fill();
    g.strokeStyle = accent; g.globalAlpha = 0.6; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(0, -66 + gy); g.lineTo(0, -46 + gy); g.stroke(); g.globalAlpha = 1;

    // 手臂
    const armSw = Math.sin(t * 9 + Math.PI) * walk * 8;
    g.strokeStyle = body2; g.lineWidth = 6.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-9, -74 + gy); g.quadraticCurveTo(-16, -60 + gy, -14 + armSw * 0.4, -46 + gy); g.stroke();
    g.strokeStyle = body; g.lineWidth = 6;
    const atkArm = atk * 50;
    g.beginPath(); g.moveTo(9, -74 + gy);
    g.quadraticCurveTo(20 + atkArm * 0.4, -66 - atkArm * 0.25 + gy, 17 + atkArm, -50 - atkArm * 0.5 + gy);
    g.stroke();
    // 手
    g.fillStyle = skin;
    g.beginPath(); g.arc(-14 + armSw * 0.4, -45 + gy, 3.2, 0, S.TAU); g.fill();
    g.beginPath(); g.arc(17 + atkArm, -49 - atkArm * 0.5 + gy, 3.2, 0, S.TAU); g.fill();

    // 头
    const hy = -88 + gy;
    g.fillStyle = skin;
    g.beginPath(); g.ellipse(0, hy, 11, 12, 0, 0, S.TAU); g.fill();
    // 脖子
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(-3.5, hy + 9, 7, 5);

    // 后发
    hairShape(g, c, def.hair || 'short', sway);

    // 头发主体
    g.fillStyle = c.hair;
    g.beginPath();
    g.moveTo(-12, hy + 4);
    g.quadraticCurveTo(-15, hy - 14, 0, hy - 15);
    g.quadraticCurveTo(15, hy - 14, 12, hy + 4);
    g.quadraticCurveTo(9, hy - 3, 0, hy - 5);
    g.quadraticCurveTo(-9, hy - 3, -12, hy + 4);
    g.closePath(); g.fill();
    // 刘海
    g.beginPath();
    g.moveTo(-12, hy - 2);
    g.quadraticCurveTo(-8, hy + 6, -3, hy + 1);
    g.quadraticCurveTo(1, hy + 7, 5, hy + 1);
    g.quadraticCurveTo(9, hy + 6, 12, hy - 3);
    g.quadraticCurveTo(6, hy - 12, 0, hy - 13);
    g.quadraticCurveTo(-7, hy - 12, -12, hy - 2);
    g.closePath(); g.fill();

    // 脸
    const faceDir = 0.6;
    g.fillStyle = 'rgba(252,250,244,0.95)';
    g.beginPath(); g.ellipse(-4.3 + faceDir, hy + 1.4, 2.6, 2.9, 0, 0, S.TAU); g.fill();
    g.beginPath(); g.ellipse(4.3 + faceDir, hy + 1.4, 2.6, 2.9, 0, 0, S.TAU); g.fill();
    g.fillStyle = c.eye || '#4a6f6a';
    g.beginPath(); g.ellipse(-4.0 + faceDir, hy + 1.5, 1.75, 2.45, 0, 0, S.TAU); g.fill();
    g.beginPath(); g.ellipse(4.6 + faceDir, hy + 1.5, 1.75, 2.45, 0, 0, S.TAU); g.fill();
    g.fillStyle = 'rgba(20,28,30,0.72)';
    g.beginPath(); g.ellipse(-3.9 + faceDir, hy + 1.9, 0.85, 1.5, 0, 0, S.TAU); g.fill();
    g.beginPath(); g.ellipse(4.7 + faceDir, hy + 1.9, 0.85, 1.5, 0, 0, S.TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath(); g.arc(-4.7 + faceDir, hy + 0.5, 0.72, 0, S.TAU); g.fill();
    g.beginPath(); g.arc(3.9 + faceDir, hy + 0.5, 0.72, 0, S.TAU); g.fill();
    g.strokeStyle = 'rgba(40,36,36,0.5)'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(-6.6 + faceDir, hy - 0.6); g.quadraticCurveTo(-4.3 + faceDir, hy - 1.9, -1.9 + faceDir, hy - 0.5); g.stroke();
    g.beginPath(); g.moveTo(2.1 + faceDir, hy - 0.5); g.quadraticCurveTo(4.5 + faceDir, hy - 1.9, 6.8 + faceDir, hy - 0.6); g.stroke();
    g.strokeStyle = 'rgba(96,84,82,0.30)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(-6.2 + faceDir, hy - 4.4); g.lineTo(-2.6 + faceDir, hy - 4.9); g.stroke();
    g.beginPath(); g.moveTo(2.6 + faceDir, hy - 4.9); g.lineTo(6.2 + faceDir, hy - 4.4); g.stroke();
    // 腮红
    g.fillStyle = 'rgba(240,160,160,0.28)';
    g.beginPath(); g.ellipse(-7 + faceDir, hy + 5, 3, 1.6, 0, 0, S.TAU); g.fill();
    g.beginPath(); g.ellipse(7 + faceDir, hy + 5, 3, 1.6, 0, 0, S.TAU); g.fill();
    // 嘴
    g.strokeStyle = 'rgba(150,90,90,0.6)'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(-1.4 + faceDir, hy + 7); g.quadraticCurveTo(faceDir, hy + 8.2, 1.6 + faceDir, hy + 7); g.stroke();

    // 角色特有装饰
    if (id === 'xu') {
      // 星盘
      const gx = 17 + atkArm, gy2 = -49 - atkArm * 0.5 + gy;
      const gg = g.createRadialGradient(gx, gy2, 0, gx, gy2, 22);
      gg.addColorStop(0, 'rgba(140,240,224,0.55)');
      gg.addColorStop(1, 'rgba(140,240,224,0)');
      g.fillStyle = gg; g.beginPath(); g.arc(gx, gy2, 22, 0, S.TAU); g.fill();
      g.strokeStyle = '#e9d7ab'; g.lineWidth = 1.3;
      g.beginPath(); g.arc(gx, gy2, 4.6, 0, S.TAU); g.stroke();
      g.fillStyle = '#bff6ea';
      g.beginPath(); g.arc(gx + Math.cos(t * 3) * 2.6, gy2 + Math.sin(t * 3) * 2.6, 1.4, 0, S.TAU); g.fill();
      // 披风
      g.fillStyle = 'rgba(56,104,110,0.85)';
      g.beginPath();
      g.moveTo(-9, -76 + gy);
      g.quadraticCurveTo(-26 - sway, -50, -22 - sway * 2, -18);
      g.quadraticCurveTo(-12, -22, -6, -44 + gy);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(233,215,171,0.4)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-22 - sway * 2, -18); g.quadraticCurveTo(-20 - sway * 1.5, -48, -9, -74 + gy); g.stroke();
    } else if (id === 'qingwu') {
      // 药篓
      g.strokeStyle = '#8a7550'; g.lineWidth = 1.4;
      g.fillStyle = 'rgba(160,140,100,0.9)';
      g.beginPath(); g.ellipse(-19 - sway * 0.4, -54 + gy, 9, 11, 0.2, 0, S.TAU); g.fill();
      g.beginPath(); g.ellipse(-19, -64, 8, 4, 0, 0, S.TAU); g.stroke();
      g.fillStyle = '#8fbf7a';
      for (let i = 0; i < 3; i++) {
        g.beginPath(); g.ellipse(-23 + i * 4, -68 - i * 2, 3, 5, 0.4, 0, S.TAU); g.fill();
      }
      // 草叶发饰
      g.fillStyle = '#9ad88a';
      g.beginPath(); g.ellipse(10, hy - 9, 2.4, 6, 0.6, 0, S.TAU); g.fill();
    } else if (id === 'lan') {
      // 断剑
      g.save();
      g.translate(-14, -50 + gy);
      g.rotate(-0.5 + Math.sin(t * 1.2) * 0.04);
      g.strokeStyle = '#c9cdc2'; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(0, 4); g.lineTo(0, -34); g.stroke();
      g.strokeStyle = '#8a7a58'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-5, -2); g.lineTo(5, -2); g.stroke();
      g.fillStyle = '#c9a45c';
      g.beginPath(); g.arc(0, -36, 2.2, 0, S.TAU); g.fill();
      g.restore();
      // 外袍下摆
      g.fillStyle = 'rgba(240,238,228,0.65)';
      g.beginPath();
      g.moveTo(6, -46 + gy); g.quadraticCurveTo(22 + sway, -30, 20 + sway * 2, -8); g.quadraticCurveTo(12, -12, 5, -40 + gy);
      g.closePath(); g.fill();
    } else if (id === 'sun') {
      g.fillStyle = 'rgba(30,30,30,0.7)';
      g.fillRect(-6, hy - 1, 5, 1.6);
      // 灯杖
      g.strokeStyle = '#3a2e22'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(17, -50 + gy); g.lineTo(17, 0); g.stroke();
      const lg = g.createRadialGradient(17, -52 + gy, 0, 17, -52 + gy, 20);
      lg.addColorStop(0, 'rgba(255,210,130,0.5)');
      lg.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = lg; g.beginPath(); g.arc(17, -52 + gy, 20, 0, S.TAU); g.fill();
      g.fillStyle = 'rgba(40,36,30,0.9)';
      g.fillRect(14, -56 + gy, 6, 9);
    } else if (id === 'bailu') {
      // 光环
      g.strokeStyle = `rgba(255,244,216,${0.4 + Math.sin(t * 1.6) * 0.1})`;
      g.lineWidth = 1.4;
      g.beginPath(); g.ellipse(0, hy - 20, 16, 5, 0, 0, S.TAU); g.stroke();
      // 面纱
      g.fillStyle = 'rgba(250,246,236,0.35)';
      g.beginPath();
      g.moveTo(-11, hy + 2); g.quadraticCurveTo(-16, hy + 20, -10, hy + 30);
      g.lineTo(10, hy + 30); g.quadraticCurveTo(16, hy + 20, 11, hy + 2); g.closePath(); g.fill();
      // 飘带
      g.fillStyle = 'rgba(245,240,226,0.6)';
      g.beginPath();
      g.moveTo(-6, -50 + gy);
      g.quadraticCurveTo(-30 - sway * 2, -40, -26 - sway * 3, -6);
      g.quadraticCurveTo(-14, -20, -2, -44 + gy);
      g.closePath(); g.fill();
    } else if (id === 'cen') {
      g.globalAlpha = 0.75;
      const gg = g.createRadialGradient(0, -60, 4, 0, -60, 60);
      gg.addColorStop(0, 'rgba(150,240,232,0.18)');
      gg.addColorStop(1, 'rgba(150,240,232,0)');
      g.fillStyle = gg; g.beginPath(); g.arc(0, -60, 60, 0, S.TAU); g.fill();
    } else if (id === 'ache') {
      // 空白面具
      g.fillStyle = 'rgba(246,242,232,0.95)';
      g.beginPath(); g.ellipse(0, hy + 1, 12, 14, 0, 0, S.TAU); g.fill();
      g.strokeStyle = 'rgba(60,54,48,0.5)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(0, hy + 1, 12, 14, 0, 0, S.TAU); g.stroke();
      // 渗墨
      g.fillStyle = 'rgba(20,24,28,0.5)';
      g.beginPath(); g.ellipse(3, hy + 11, 5, 3, 0.4, 0, S.TAU); g.fill();
      // 短褂
      g.fillStyle = 'rgba(210,196,166,0.9)';
      g.fillRect(-11, -50 + gy, 22, 34);
    }

    // 受击闪白
    if (st.hurt > 0) {
      g.globalAlpha = st.hurt * 0.65;
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = '#ffd0d0';
      g.beginPath(); g.ellipse(0, -58 + gy, 22, 40, 0, 0, S.TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }

    // 边缘光
    g.strokeStyle = `rgba(220,255,250,0.22)`;
    g.lineWidth = 1;
    g.beginPath(); g.ellipse(0, hy, 11.6, 12.6, 0, -2.4, -0.8); g.stroke();

    g.restore();
  };

  /* ==========================================================
     半身像
     ========================================================== */
  R.drawPortrait = function (canvas, id, t, mood) {
    const g = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    g.clearRect(0, 0, W, H);
    if (!id) return;
    const def = S.CHARS[id];
    if (!def || def.narr) return;

    // 背景光晕
    const cx = W * 0.5, cy = H * 0.46;
    const bg = g.createRadialGradient(cx, cy + 20, 8, cx, cy + 20, W * 0.62);
    bg.addColorStop(0, 'rgba(18,40,44,0.42)');
    bg.addColorStop(0.6, 'rgba(8,20,24,0.25)');
    bg.addColorStop(1, 'rgba(5,12,16,0)');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);

    // 角色（放大，取上半身）
    const sc = W / 96;
    g.save();
    g.translate(W * 0.5, H * 1.42);
    g.scale(sc, sc);
    // 裁剪到画布
    g.beginPath(); g.rect(-W / 2 / sc * 0.0 - 60, 0, 0, 0); // noop
    g.restore();

    g.save();
    g.translate(W * 0.5, H * 1.28);
    g.scale(sc * 1.06, sc * 1.06);
    const savedT = t;
    R.drawHuman(g, id, 0, 0, 1, { t: savedT * 0.35, walk: 0, dir: 1, atk: 0, hurt: 0, seed: 1 });
    g.restore();

    // 下部渐隐
    const fade = g.createLinearGradient(0, H * 0.62, 0, H);
    fade.addColorStop(0, 'rgba(6,14,18,0)');
    fade.addColorStop(1, 'rgba(6,14,18,0.96)');
    g.fillStyle = fade;
    g.fillRect(0, H * 0.6, W, H * 0.4);
    // 顶部渐隐
    const fade2 = g.createLinearGradient(0, 0, 0, H * 0.16);
    fade2.addColorStop(0, 'rgba(6,14,18,0.7)');
    fade2.addColorStop(1, 'rgba(6,14,18,0)');
    g.fillStyle = fade2; g.fillRect(0, 0, W, H * 0.16);
    // 椭圆羽化，融进对话框
    g.globalCompositeOperation = 'destination-in';
    const mask = g.createRadialGradient(W * 0.5, H * 0.54, W * 0.10, W * 0.5, H * 0.54, W * 0.66);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(0.58, 'rgba(0,0,0,1)');
    mask.addColorStop(0.82, 'rgba(0,0,0,0.55)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = mask;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
  };

  /* ==========================================================
     后期
     ========================================================== */
  R.post = function (g, game) {
    const W = this.W, H = this.H;
    // 泛光
    const b1 = this.bloomA, b2 = this.bloomB;
    const c1 = b1.getContext('2d'), c2 = b2.getContext('2d');
    c1.clearRect(0, 0, b1.width, b1.height);
    c1.filter = 'blur(4px)';
    c1.drawImage(this.cv, 0, 0, this.cv.width, this.cv.height, 0, 0, b1.width, b1.height);
    c1.filter = 'none';
    c2.clearRect(0, 0, b2.width, b2.height);
    c2.filter = 'blur(3px)';
    c2.drawImage(b1, 0, 0, b1.width, b1.height, 0, 0, b2.width, b2.height);
    c2.filter = 'none';

    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.30;
    g.drawImage(b1, 0, 0, W, H);
    g.globalAlpha = 0.26;
    g.drawImage(b2, 0, 0, W, H);
    g.restore();

    // 色彩分级
    const mc = this.moodC, mb = this.moodB;
    g.save();
    g.globalCompositeOperation = 'overlay';
    const gg = g.createLinearGradient(0, 0, W * 0.4, H);
    if (mc > 0.4) {
      gg.addColorStop(0, 'rgba(60,90,140,0.30)');
      gg.addColorStop(0.6, 'rgba(20,30,60,0.12)');
      gg.addColorStop(1, 'rgba(120,40,80,0.20)');
    } else if (mb > 0.4) {
      gg.addColorStop(0, 'rgba(150,200,200,0.22)');
      gg.addColorStop(1, 'rgba(40,70,90,0.16)');
    } else {
      gg.addColorStop(0, 'rgba(255,236,190,0.20)');
      gg.addColorStop(0.55, 'rgba(200,220,200,0.08)');
      gg.addColorStop(1, 'rgba(30,70,80,0.18)');
    }
    g.fillStyle = gg;
    g.fillRect(0, 0, W, H);
    g.restore();

    // 暗角
    const vg = g.createRadialGradient(W * 0.5, H * 0.48, Math.min(W, H) * 0.28, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.7, 'rgba(2,8,10,0.18)');
    vg.addColorStop(1, 'rgba(2,6,8,0.62)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);

    // 闪光
    if (this.flash > 0) {
      g.save();
      g.globalAlpha = Math.min(1, this.flash);
      g.fillStyle = this.flashColor;
      g.fillRect(0, 0, W, H);
      g.restore();
      this.flash = Math.max(0, this.flash - 0.045);
    }
  };

  /* ==========================================================
     美术调校层（覆盖默认实现）
     ========================================================== */
  function rndArr(seed, n) {
    const r = S.rng((seed * 9781 + 13) | 0);
    const a = [];
    for (let i = 0; i < n; i++) a.push(r());
    return a;
  }
  function cloudFill(g, cx, cy, r, n, rr, squash, col, off) {
    g.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const a = rr[(off + i * 3) % rr.length] * S.TAU;
      const dd = rr[(off + i * 3 + 1) % rr.length] * r * 0.52;
      const rad = r * (0.52 + rr[(off + i * 3 + 2) % rr.length] * 0.44);
      g.beginPath();
      g.arc(cx + Math.cos(a) * dd, cy + Math.sin(a) * dd * squash, rad, 0, S.TAU);
      g.fill();
    }
  }

  /* ---------------- 后期 ---------------- */
  R.post = function (g) {
    const W = this.W, H = this.H;
    const b1 = this.bloomA, b2 = this.bloomB;
    const c1 = b1.getContext('2d'), c2 = b2.getContext('2d');
    const cheap = !!(S.QUALITY && S.QUALITY.bloomCheap);
    if (!this.noBloom && cheap) {
      // 移动端：省掉 ctx.filter 的高斯模糊，用 1/8 降采样 + 平滑放大当柔光
      c2.clearRect(0, 0, b2.width, b2.height);
      c2.imageSmoothingEnabled = true;
      c2.drawImage(this.cv, 0, 0, this.cv.width, this.cv.height, 0, 0, b2.width, b2.height);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.17;
      g.drawImage(b2, 0, 0, W, H);
      g.restore();
    } else if (!this.noBloom) {
      c1.clearRect(0, 0, b1.width, b1.height);
      c1.filter = 'blur(5px)';
      c1.drawImage(this.cv, 0, 0, this.cv.width, this.cv.height, 0, 0, b1.width, b1.height);
      c1.filter = 'none';
      c2.clearRect(0, 0, b2.width, b2.height);
      c2.filter = 'blur(4px)';
      c2.drawImage(b1, 0, 0, b1.width, b1.height, 0, 0, b2.width, b2.height);
      c2.filter = 'none';

      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.075;
      g.drawImage(b1, 0, 0, W, H);
      g.globalAlpha = 0.05;
      g.drawImage(b2, 0, 0, W, H);
      g.restore();
    }

    // 色彩分级
    const mc = this.moodC, mb = this.moodB;
    g.save();
    g.globalCompositeOperation = 'soft-light';
    const gg = g.createLinearGradient(0, 0, W * 0.45, H);
    if (mc > 0.4) {
      gg.addColorStop(0, 'rgba(70,100,160,0.28)');
      gg.addColorStop(0.55, 'rgba(26,34,70,0.14)');
      gg.addColorStop(1, 'rgba(120,40,80,0.24)');
    } else if (mb > 0.4) {
      gg.addColorStop(0, 'rgba(170,210,220,0.20)');
      gg.addColorStop(1, 'rgba(30,70,90,0.24)');
    } else {
      gg.addColorStop(0, 'rgba(255,226,164,0.17)');
      gg.addColorStop(0.5, 'rgba(190,210,195,0.04)');
      gg.addColorStop(1, 'rgba(16,54,72,0.26)');
    }
    g.fillStyle = gg;
    g.fillRect(0, 0, W, H);
    g.restore();

    // 空气感：上冷下暖
    g.save();
    const air = g.createLinearGradient(0, 0, 0, H);
    air.addColorStop(0, mc > 0.5 ? 'rgba(16,28,52,0.34)' : 'rgba(24,44,46,0.20)');
    air.addColorStop(0.40, 'rgba(0,0,0,0)');
    air.addColorStop(1, mc > 0.5 ? 'rgba(26,8,22,0.26)' : 'rgba(30,44,26,0.18)');
    g.fillStyle = air;
    g.fillRect(0, 0, W, H);
    g.restore();

    // 暗角
    const vg = g.createRadialGradient(W * 0.5, H * 0.46, Math.min(W, H) * 0.30, W * 0.5, H * 0.5, Math.max(W, H) * 0.76);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.62, 'rgba(3,9,10,0.16)');
    vg.addColorStop(1, 'rgba(2,6,8,0.70)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);

    if (this.flash > 0) {
      g.save();
      g.globalAlpha = Math.min(1, this.flash);
      g.fillStyle = this.flashColor;
      g.fillRect(0, 0, W, H);
      g.restore();
      this.flash = Math.max(0, this.flash - 0.045);
    }
  };

  /* ---------------- 草海 ---------------- */
  R.drawGrass = function (g, game) {
    const vr = this.visibleRect(26);
    const cell = (S.QUALITY && S.QUALITY.grassCell) || 17;
    const t = this.t;
    const p = game.player;
    const px = p ? p.x : 1e9, py = p ? p.y : 1e9;
    const f = S.World;
    const mc = this.moodC, mb = this.moodB;
    const colsA = [
      ['rgba(74,106,58,0.92)', 1.5],
      ['rgba(96,130,66,0.88)', 1.35],
      ['rgba(126,150,78,0.80)', 1.2],
      ['rgba(58,88,64,0.85)', 1.45]
    ];
    const colsB = [
      ['rgba(58,96,80,0.9)', 1.5],
      ['rgba(76,118,96,0.85)', 1.35],
      ['rgba(102,138,110,0.75)', 1.2],
      ['rgba(48,80,74,0.85)', 1.45]
    ];
    const colsC = [
      ['rgba(46,50,60,0.75)', 1.3],
      ['rgba(58,60,72,0.7)', 1.2],
      ['rgba(74,70,84,0.6)', 1.1],
      ['rgba(38,42,52,0.7)', 1.25]
    ];
    const buckets = [[], [], [], []];
    const flowers = [];
    const x0 = Math.floor(vr.x0 / cell) * cell, x1 = vr.x1;
    const y0 = Math.floor(vr.y0 / cell) * cell, y1 = vr.y1;
    const wind = Math.sin(t * 1.15) * 0.5 + 0.5;
    for (let y = y0; y < y1; y += cell) {
      for (let x = x0; x < x1; x += cell) {
        let h = (x * 374761393 + y * 668265263) | 0;
        h = (h ^ (h >> 13)) * 1274126177 | 0;
        const r1 = ((h ^ (h >> 16)) >>> 0) / 4294967296;
        const h2 = (h * 31 + 7) | 0;
        const r2 = ((h2 ^ (h2 >> 15)) >>> 0) / 4294967296;
        if (r1 > 0.90) continue;
        const wx = x + r2 * cell, wy = y + r1 * cell;
        if (f.terrainAt(wx, wy) !== 0) continue;
        if (S.dist2(wx, wy, S.LM.crater.x, S.LM.crater.y) < 16900) continue;
        const reg = f.regionAt(wx);
        if (reg === 'C' && r1 > 0.28) continue;
        if (r1 < 0.016 && reg !== 'C') flowers.push([this.sx(wx), this.sy(wy), reg === 'B' ? 1 : (r2 > 0.6 ? 2 : 0)]);
        const clump = r2 > 0.86;
        const n = clump ? 3 : 1;
        for (let k = 0; k < n; k++) {
          const jx = (k ? (r2 - 0.5) * 9 : 0);
          const jy = (k ? (r1 - 0.5) * 7 : 0);
          const hgt = (5 + r2 * 8 + (reg === 'B' ? 3 : 0)) * (clump ? 1.2 : 1);
          const gust = Math.sin(wx * 0.0035 + t * 0.85) * 0.5 + Math.sin(wy * 0.0028 - t * 0.55) * 0.42;
          let bend = (Math.sin(t * 1.9 + wx * 0.024 + wy * 0.018) * 0.5 + gust * 1.2 + (wind - 0.5) + (r1 - 0.5) * 1.1) * (1.5 + hgt * 0.15);
          const dd = S.dist2(wx, wy, px, py);
          if (dd < 5200) {
            const d = Math.sqrt(dd) || 1;
            const push = 1 - d / 72;
            bend += ((wx - px) / d) * push * 7;
          }
          const sxp = this.sx(wx + jx), syp = this.sy(wy + jy);
          const bi = (r1 * 3.99) | 0;
          buckets[bi].push([sxp, syp, bend * Cam.z, hgt * Cam.z]);
        }
      }
    }
    g.save();
    g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const arr = buckets[i];
      if (!arr.length) continue;
      const pal = mc > 0.5 ? colsC : (mb > 0.4 ? colsB : colsA);
      g.strokeStyle = pal[i][0];
      g.lineWidth = pal[i][1] * Cam.z;
      g.beginPath();
      for (let k = 0; k < arr.length; k++) {
        const b = arr[k];
        g.moveTo(b[0], b[1]);
        g.quadraticCurveTo(b[0] + b[2] * 0.3, b[1] - b[3] * 0.6, b[0] + b[2], b[1] - b[3]);
        g.moveTo(b[0] + 1.2 * Cam.z, b[1]);
        g.quadraticCurveTo(b[0] + b[2] * 0.1 + 1.2 * Cam.z, b[1] - b[3] * 0.5, b[0] + b[2] * 0.55, b[1] - b[3] * 0.78);
      }
      g.stroke();
    }
    // 野花
    const fcol = ['rgba(246,242,224,0.55)', 'rgba(240,200,214,0.5)', 'rgba(244,226,150,0.5)'];
    for (let c = 0; c < 3; c++) {
      g.fillStyle = fcol[c];
      g.beginPath();
      let any = false;
      for (let k = 0; k < flowers.length; k++) {
        const fl = flowers[k];
        if (fl[2] !== c) continue;
        any = true;
        g.moveTo(fl[0] + 1.5 * Cam.z, fl[1] - 2 * Cam.z);
        g.arc(fl[0], fl[1] - 3 * Cam.z, 1.25 * Cam.z, 0, S.TAU);
      }
      if (any) g.fill();
    }
    g.restore();
  };

  /* ---------------- 风痕 ---------------- */
  R.drawWindStreaks = function (g) {
    const t = this.t, W = this.W, H = this.H;
    const mc = this.moodC;
    if (mc > 0.5) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.055 + i * 0.33) % 1;
      const x = -W * 0.25 + ph * W * 1.5;
      const y = H * (0.22 + i * 0.26) + Math.sin(t * 0.4 + i) * 30;
      const len = W * (0.28 + 0.1 * Math.sin(i * 2.1));
      const a = 0.030 + 0.022 * Math.sin(t * 0.7 + i * 1.7);
      const lg = g.createLinearGradient(x, y, x + len, y - 26);
      lg.addColorStop(0, 'rgba(255,255,245,0)');
      lg.addColorStop(0.5, `rgba(240,255,248,${a})`);
      lg.addColorStop(1, 'rgba(255,255,245,0)');
      g.strokeStyle = lg;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + len * 0.3, y - 14, x + len * 0.7, y + 8, x + len, y - 22);
      g.stroke();
    }
    g.restore();
  };

  /* ---------------- 树 ---------------- */
  P.tree = function (g, p, s, t) {
    const rr = p._rr || (p._rr = rndArr(p.seed || 1, 30));
    const H0 = 118 * s;
    const sway = Math.sin(t * 0.62 + (p.sw || 0)) * 0.022;
    // 树干
    g.fillStyle = '#3d2e24';
    g.beginPath();
    g.moveTo(-8 * s, 0);
    g.quadraticCurveTo(-5 * s, -H0 * 0.4, -3.5 * s, -H0 * 0.62);
    g.lineTo(3.5 * s, -H0 * 0.62);
    g.quadraticCurveTo(6 * s, -H0 * 0.35, 9 * s, 0);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(150,120,90,0.45)';
    g.fillRect(-3 * s, -H0 * 0.6, 2 * s, H0 * 0.58);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(3 * s, -H0 * 0.6, 3 * s, H0 * 0.58);

    const cy = -H0 * 0.92;
    const R0 = 40 * s;
    g.save();
    g.rotate(sway);
    // 暗部
    cloudFill(g, 0, cy + R0 * 0.12, R0 * 1.06, 8, rr, 0.86, '#26402c', 0);
    // 中间调
    cloudFill(g, -R0 * 0.10, cy - R0 * 0.14, R0 * 0.94, 7, rr, 0.86, '#3c6138', 4);
    // 受光
    cloudFill(g, -R0 * 0.26, cy - R0 * 0.34, R0 * 0.66, 6, rr, 0.86, '#5c8a48', 9);
    // 亮叶
    cloudFill(g, -R0 * 0.38, cy - R0 * 0.5, R0 * 0.38, 5, rr, 0.86, '#83ad5c', 14);
    // 零星叶点
    g.fillStyle = 'rgba(168,204,116,0.55)';
    for (let i = 0; i < 9; i++) {
      const a = rr[i] * S.TAU, d = rr[i + 11] * R0 * 0.9;
      g.beginPath();
      g.arc(Math.cos(a) * d - R0 * 0.2, cy + Math.sin(a) * d * 0.8 - R0 * 0.35, R0 * 0.08, 0, S.TAU);
      g.fill();
    }
    g.restore();
  };

  P.sakura = function (g, p, s, t) {
    const rr = p._rr || (p._rr = rndArr(p.seed || 1, 30));
    const H0 = 108 * s;
    const sway = Math.sin(t * 0.55 + (p.sw || 0)) * 0.028;
    g.fillStyle = '#443029';
    g.beginPath();
    g.moveTo(-8 * s, 0);
    g.quadraticCurveTo(-5 * s, -H0 * 0.4, -3.5 * s, -H0 * 0.62);
    g.lineTo(3.5 * s, -H0 * 0.62);
    g.quadraticCurveTo(6 * s, -H0 * 0.35, 9 * s, 0);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(160,120,100,0.35)';
    g.fillRect(-3 * s, -H0 * 0.6, 2 * s, H0 * 0.58);
    const cy = -H0 * 0.94, R0 = 38 * s;
    g.save();
    g.rotate(sway);
    cloudFill(g, 0, cy + R0 * 0.1, R0 * 1.02, 8, rr, 0.9, '#8c5a74', 0);
    cloudFill(g, -R0 * 0.1, cy - R0 * 0.12, R0 * 0.9, 7, rr, 0.9, '#c07f9a', 5);
    cloudFill(g, -R0 * 0.24, cy - R0 * 0.3, R0 * 0.62, 6, rr, 0.9, '#e7b4c6', 10);
    cloudFill(g, -R0 * 0.34, cy - R0 * 0.44, R0 * 0.34, 4, rr, 0.9, '#fbd9e2', 15);
    g.restore();
  };

  P.pine = function (g, p, s, t) {
    const rr = p._rr || (p._rr = rndArr(p.seed || 1, 20));
    const H0 = 180 * s;
    const sway = Math.sin(t * 0.5 + (p.sw || 0)) * 0.02;
    g.fillStyle = '#332a24';
    g.fillRect(-5.5 * s, -H0 * 0.42, 11 * s, H0 * 0.42);
    g.save();
    g.rotate(sway);
    for (let i = 0; i < 5; i++) {
      const y = -H0 * (0.22 + i * 0.155);
      const w = (54 - i * 9) * s;
      const hgt = (46 - i * 5) * s;
      g.fillStyle = i > 2 ? '#2f5a48' : '#274a3e';
      g.beginPath();
      g.moveTo(-w, y);
      g.quadraticCurveTo(-w * 0.4, y - 6 * s, 0, y - hgt);
      g.quadraticCurveTo(w * 0.4, y - 6 * s, w, y);
      g.quadraticCurveTo(w * 0.5, y + 7 * s, 0, y + 4 * s);
      g.quadraticCurveTo(-w * 0.5, y + 7 * s, -w, y);
      g.closePath(); g.fill();
      // 受光边
      g.strokeStyle = 'rgba(140,200,160,0.30)';
      g.lineWidth = 1.4 * s;
      g.beginPath();
      g.moveTo(-w * 0.86, y - 2 * s);
      g.quadraticCurveTo(-w * 0.3, y - 8 * s, 0, y - hgt + 2 * s);
      g.stroke();
      // 暗边
      g.strokeStyle = 'rgba(10,30,26,0.35)';
      g.beginPath();
      g.moveTo(w * 0.86, y - 2 * s);
      g.quadraticCurveTo(w * 0.3, y - 6 * s, 0, y - hgt + 2 * s);
      g.stroke();
    }
    g.restore();
  };

  P.dead = function (g, p, s, t) {
    const sway = Math.sin(t * 0.45 + (p.sw || 0)) * 0.024;
    g.save(); g.rotate(sway);
    g.strokeStyle = '#20222a'; g.lineCap = 'round';
    g.lineWidth = 7 * s;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-7 * s, -50 * s, -3 * s, -104 * s); g.stroke();
    g.lineWidth = 3 * s;
    for (let i = 0; i < 6; i++) {
      const y = -46 * s - i * 13 * s;
      const dir = i % 2 ? 1 : -1;
      g.beginPath();
      g.moveTo(-3 * s, y);
      g.quadraticCurveTo(dir * 24 * s, y - 18 * s, dir * 40 * s, y - 34 * s);
      g.stroke();
    }
    g.strokeStyle = 'rgba(140,170,200,0.18)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-2 * s, 0); g.quadraticCurveTo(-7 * s, -50 * s, -3 * s, -104 * s); g.stroke();
    g.restore();
  };

  /* ---------------- 房屋 ---------------- */
  P.house = function (g, p, s, t) {
    const w = 92, h = 58;
    const warm = 0.85 + Math.sin(t * 2.1 + (p.seed || 0)) * 0.06;
    // 墙体
    const wg = g.createLinearGradient(-w / 2, 0, w / 2, 0);
    wg.addColorStop(0, '#6d553f');
    wg.addColorStop(0.55, '#5a4535');
    wg.addColorStop(1, '#42332a');
    g.fillStyle = wg;
    g.fillRect(-w / 2, -h, w, h);
    // 木骨
    g.fillStyle = 'rgba(38,28,22,0.55)';
    g.fillRect(-w / 2, -h, 3, h);
    g.fillRect(w / 2 - 3, -h, 3, h);
    g.fillRect(-w / 2, -h * 0.55, w, 3);
    for (let i = 1; i < 4; i++) g.fillRect(-w / 2 + i * (w / 4), -h, 2, h);
    // 屋檐阴影
    const eg = g.createLinearGradient(0, -h, 0, -h + 18);
    eg.addColorStop(0, 'rgba(10,10,14,0.75)');
    eg.addColorStop(1, 'rgba(10,10,14,0)');
    g.fillStyle = eg;
    g.fillRect(-w / 2, -h, w, 18);
    // 屋顶
    const rg = g.createLinearGradient(0, -h - 60, 0, -h + 8);
    rg.addColorStop(0, '#527b82');
    rg.addColorStop(0.5, '#35565f');
    rg.addColorStop(1, '#1f343c');
    g.fillStyle = rg;
    g.beginPath();
    g.moveTo(-w / 2 - 20, -h + 4);
    g.quadraticCurveTo(0, -h - 64, w / 2 + 20, -h + 4);
    g.lineTo(w / 2 + 13, -h + 19);
    g.quadraticCurveTo(0, -h - 42, -w / 2 - 13, -h + 19);
    g.closePath(); g.fill();
    // 瓦楞
    g.strokeStyle = 'rgba(150,200,205,0.13)';
    g.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      g.beginPath();
      g.moveTo(i * 13, -h - 40 + Math.abs(i) * 7);
      g.lineTo(i * 16, -h + 10 + Math.abs(i) * 1.5);
      g.stroke();
    }
    // 屋脊
    g.strokeStyle = 'rgba(210,240,238,0.5)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-w / 2 - 16, -h + 6);
    g.quadraticCurveTo(0, -h - 60, w / 2 + 16, -h + 6);
    g.stroke();
    g.strokeStyle = 'rgba(10,20,24,0.45)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-w / 2 - 14, -h + 20);
    g.quadraticCurveTo(0, -h - 38, w / 2 + 14, -h + 20);
    g.stroke();
    // 窗
    const flick = 0.78 + Math.sin(t * 1.7 + (p.seed || 0)) * 0.08;
    const cxw = 20, cyw = -h + 26;
    const gg = g.createRadialGradient(cxw, cyw, 1, cxw, cyw, 16);
    gg.addColorStop(0, `rgba(255,214,140,${0.40 * flick})`);
    gg.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = gg;
    g.beginPath(); g.arc(cxw, cyw, 16, 0, S.TAU); g.fill();
    g.fillStyle = `rgba(255,226,160,${0.92 * flick})`;
    g.fillRect(cxw - 8, cyw - 8, 16, 15);
    g.strokeStyle = '#2e241d'; g.lineWidth = 2;
    g.strokeRect(cxw - 8, cyw - 8, 16, 15);
    g.beginPath(); g.moveTo(cxw, cyw - 8); g.lineTo(cxw, cyw + 7); g.stroke();
    // 门
    g.fillStyle = '#241a14';
    g.fillRect(-w / 2 + 12, -34, 24, 34);
    g.strokeStyle = 'rgba(190,150,100,0.35)'; g.lineWidth = 1.4;
    g.strokeRect(-w / 2 + 12, -34, 24, 34);
    g.fillStyle = 'rgba(220,180,110,0.5)';
    g.beginPath(); g.arc(-w / 2 + 31, -17, 2, 0, S.TAU); g.fill();
    // 烟囱与炊烟
    g.fillStyle = '#3d4a4c';
    g.fillRect(w / 2 - 26, -h - 46, 13, 26);
    g.fillStyle = '#263335';
    g.fillRect(w / 2 - 26, -h - 46, 13, 4);
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.35 + i * 0.33 + (p.seed || 0)) % 1;
      g.fillStyle = `rgba(230,235,230,${0.10 * (1 - ph)})`;
      g.beginPath();
      g.arc(w / 2 - 19 + Math.sin(ph * 5) * 9, -h - 54 - ph * 46, 6 + ph * 14, 0, S.TAU);
      g.fill();
    }
  };

  /* ---------------- 门 / 栅栏 / 碑 ---------------- */
  P.gate = function (g, p, s, t) {
    g.fillStyle = '#3f2f22';
    g.fillRect(-96, -152, 15, 152);
    g.fillRect(81, -152, 15, 152);
    g.fillStyle = 'rgba(150,120,80,0.3)';
    g.fillRect(-96, -152, 4, 152);
    g.fillRect(81, -152, 4, 152);
    // 横梁
    g.fillStyle = '#4b3726';
    g.fillRect(-118, -172, 236, 18);
    g.fillStyle = '#5f452f';
    g.fillRect(-104, -154, 208, 11);
    g.fillStyle = 'rgba(20,14,10,0.45)';
    g.fillRect(-118, -156, 236, 4);
    // 匾
    g.fillStyle = '#2b1f16';
    g.fillRect(-42, -170, 84, 26);
    g.strokeStyle = 'rgba(200,170,110,0.55)'; g.lineWidth = 1.4;
    g.strokeRect(-42, -170, 84, 26);
    g.fillStyle = 'rgba(232,214,168,0.92)';
    g.font = '17px "Noto Serif SC",serif'; g.textAlign = 'center';
    g.fillText('云栖', 0, -151);
    // 旗
    const fl = Math.sin(t * 1.8 + (p.seed || 0)) * 6;
    g.fillStyle = 'rgba(120,178,150,0.75)';
    g.beginPath();
    g.moveTo(23, -150); g.lineTo(23, -66);
    g.quadraticCurveTo(48 + fl, -96, 44 + fl * 0.6, -150);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(240,240,220,0.4)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(23, -150); g.lineTo(23, -66); g.stroke();
  };

  P.fence = function (g, p, s) {
    g.strokeStyle = '#4d3c2b'; g.lineWidth = 3.4;
    g.lineCap = 'round';
    for (let i = -3; i <= 3; i++) {
      g.beginPath(); g.moveTo(i * 17, 2); g.lineTo(i * 17 + 1, -24); g.stroke();
      g.fillStyle = 'rgba(150,120,86,0.35)';
      g.fillRect(i * 17 - 1, -24, 2.4, 8);
    }
    g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(-54, -18); g.lineTo(54, -16); g.stroke();
    g.beginPath(); g.moveTo(-54, -7); g.lineTo(54, -5); g.stroke();
  };

  P.stele = function (g, p, s, t) {
    const h = 76 * s, w = 27 * s;
    g.fillStyle = 'rgba(20,30,30,0.18)';
    g.beginPath(); g.ellipse(2, 1, w * 0.75, 5, 0, 0, S.TAU); g.fill();
    const grd = g.createLinearGradient(-w / 2, -h, w / 2, 0);
    grd.addColorStop(0, '#96a096');
    grd.addColorStop(0.45, '#727c74');
    grd.addColorStop(1, '#4c5652');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(-w / 2, 0); g.lineTo(-w / 2, -h + 8);
    g.quadraticCurveTo(0, -h - 9, w / 2, -h + 8);
    g.lineTo(w / 2, 0); g.closePath(); g.fill();
    g.fillStyle = 'rgba(226,236,226,0.35)';
    g.fillRect(-w / 2, -h + 6, 3, h - 6);
    g.fillStyle = 'rgba(24,34,36,0.25)';
    g.fillRect(w / 2 - 5, -h + 6, 5, h - 6);
    // 刮痕
    g.strokeStyle = 'rgba(38,48,50,0.5)'; g.lineWidth = 1.8;
    for (let i = 0; i < 5; i++) {
      const y = -h + 18 + i * 11 * s;
      g.beginPath(); g.moveTo(-w * 0.28, y); g.lineTo(w * 0.3, y + 1.5); g.stroke();
    }
    g.strokeStyle = 'rgba(40,60,44,0.35)';
    g.beginPath(); g.moveTo(w * 0.2, -4); g.lineTo(w * 0.3, -h * 0.5); g.stroke();
  };



  /* 村口：一双小鞋与一只空碗（阿澈的伏笔） */
  P.shoes = function (g, p, s, t) {
    g.save();
    g.translate(0, 0);
    // 碗
    g.fillStyle = 'rgba(222,216,196,0.92)';
    g.beginPath(); g.ellipse(16, -1, 6, 3.2, 0, 0, S.TAU); g.fill();
    g.strokeStyle = 'rgba(150,144,124,0.8)'; g.lineWidth = 0.8;
    g.beginPath(); g.ellipse(16, -1, 6, 3.2, 0, 0, S.TAU); g.stroke();
    // 小鞋两只
    const drawShoe = (x, y, rot) => {
      g.save(); g.translate(x, y); g.rotate(rot);
      g.fillStyle = '#5a4232';
      g.beginPath();
      g.moveTo(-6, 0); g.quadraticCurveTo(-7, -5, -2, -5.6);
      g.lineTo(5, -5.2); g.quadraticCurveTo(8, -4, 7, 0);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(190,160,120,0.5)';
      g.beginPath(); g.ellipse(0, -4.6, 4, 1.2, 0, 0, S.TAU); g.fill();
      g.fillStyle = 'rgba(20,16,12,0.5)';
      g.fillRect(-6, -1, 13, 1.2);
      g.restore();
    };
    drawShoe(-10, 0, -0.18);
    drawShoe(-1, 2, 0.12);
    g.restore();
  };
  /* ---------------- 村落生活道具 ---------------- */
  P.stall = function (g, p, s, t) {
    const fl = Math.sin(t * 1.6 + (p.seed || 0)) * 3;
    // 柱
    g.fillStyle = '#5a4530';
    g.fillRect(-40, -92, 5, 92);
    g.fillRect(35, -92, 5, 92);
    g.fillRect(-46, -40, 6, 40);
    g.fillRect(40, -40, 6, 40);
    // 台面
    g.fillStyle = '#8a6c48';
    g.fillRect(-52, -46, 104, 10);
    g.fillStyle = '#a3845a';
    g.fillRect(-52, -50, 104, 5);
    // 货
    for (let i = 0; i < 6; i++) {
      const x = -44 + i * 16;
      g.fillStyle = ['#c9694e', '#d8a55e', '#8fae5e'][i % 3];
      g.beginPath(); g.arc(x, -54, 5, 0, S.TAU); g.fill();
    }
    // 遮阳布
    g.fillStyle = 'rgba(196,120,110,0.88)';
    g.beginPath();
    g.moveTo(-60, -92);
    g.quadraticCurveTo(-30 + fl, -108, 0, -104);
    g.quadraticCurveTo(30 + fl, -108, 60, -92);
    g.lineTo(52, -86);
    g.quadraticCurveTo(0, -96, -52, -86);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(238,228,208,0.55)';
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(-60 + i * 30, -92);
      g.quadraticCurveTo(-45 + i * 30 + fl, -108, -30 + i * 30, -104);
      g.lineTo(-36 + i * 30, -96);
      g.quadraticCurveTo(-46 + i * 30, -101, -55 + i * 30, -88);
      g.closePath(); g.fill();
    }
  };

  P.board = function (g, p, s, t) {
    g.fillStyle = '#5a4530';
    g.fillRect(-2.4, -66, 4.8, 66);
    g.fillRect(-2.4, -70, 4.8, 8);
    g.fillStyle = '#7a6044';
    g.fillRect(-30, -74, 60, 40);
    g.fillStyle = '#8d7150';
    g.fillRect(-30, -74, 60, 4);
    // 纸
    const rr = p._rr || (p._rr = rndArr(p.seed || 1, 12));
    for (let i = 0; i < 4; i++) {
      g.save();
      g.translate(-20 + i * 13, -66 + rr[i] * 14);
      g.rotate((rr[i + 4] - 0.5) * 0.2);
      g.fillStyle = 'rgba(232,224,200,0.9)';
      g.fillRect(-5, -6, 10, 13);
      g.fillStyle = 'rgba(90,80,66,0.5)';
      for (let k = 0; k < 3; k++) g.fillRect(-3.4, -3 + k * 3, 6.8, 0.8);
      g.restore();
    }
  };

  P.hay = function (g, p, s, t) {
    g.fillStyle = '#b09150';
    g.beginPath();
    g.moveTo(-26, 0);
    g.quadraticCurveTo(-24, -34, 0, -40);
    g.quadraticCurveTo(24, -34, 26, 0);
    g.closePath(); g.fill();
    g.fillStyle = '#c9a862';
    g.beginPath();
    g.moveTo(-22, -3);
    g.quadraticCurveTo(-18, -30, 0, -36);
    g.quadraticCurveTo(4, -18, 8, -3);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(120,96,48,0.5)'; g.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.moveTo(-24 + i * 8, -2);
      g.quadraticCurveTo(-20 + i * 7, -22, -4 + i * 3, -34 + Math.abs(i - 3) * 3);
      g.stroke();
    }
    g.strokeStyle = '#8a6f3a'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-14, -16); g.lineTo(14, -18); g.stroke();
  };

  P.cart = function (g, p, s, t) {
    g.fillStyle = '#6b5236';
    g.fillRect(-34, -30, 68, 20);
    g.fillStyle = '#836547';
    g.fillRect(-34, -34, 68, 6);
    for (let i = 0; i < 5; i++) g.fillRect(-30 + i * 14, -30, 2, 20);
    // 轮
    for (const wx of [-22, 22]) {
      g.fillStyle = '#3c2f22';
      g.beginPath(); g.arc(wx, -8, 12, 0, S.TAU); g.fill();
      g.strokeStyle = '#8a6c48'; g.lineWidth = 2;
      g.beginPath(); g.arc(wx, -8, 12, 0, S.TAU); g.stroke();
      g.strokeStyle = 'rgba(180,150,110,0.5)'; g.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI;
        g.beginPath();
        g.moveTo(wx + Math.cos(a) * 11, -8 + Math.sin(a) * 11);
        g.lineTo(wx - Math.cos(a) * 11, -8 - Math.sin(a) * 11);
        g.stroke();
      }
    }
    // 车辕
    g.strokeStyle = '#5a4530'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(-34, -18); g.lineTo(-58, -26); g.stroke();
    // 货物
    g.fillStyle = '#b09150';
    g.beginPath(); g.ellipse(-6, -42, 16, 10, 0, 0, S.TAU); g.fill();
    g.fillStyle = '#c9a862';
    g.beginPath(); g.ellipse(-10, -45, 10, 6, 0, 0, S.TAU); g.fill();
  };

  P.barrel = function (g, p, s, t) {
    g.fillStyle = '#7a5c3c';
    g.beginPath();
    g.moveTo(-9, 0);
    g.quadraticCurveTo(-11, -14, -8, -26);
    g.lineTo(8, -26);
    g.quadraticCurveTo(11, -14, 9, 0);
    g.closePath(); g.fill();
    g.fillStyle = '#8f6d47';
    g.beginPath(); g.ellipse(0, -26, 8, 3, 0, 0, S.TAU); g.fill();
    g.strokeStyle = '#4e3a26'; g.lineWidth = 1.6;
    g.beginPath(); g.ellipse(0, -7, 9, 2.6, 0, 0, S.TAU); g.stroke();
    g.beginPath(); g.ellipse(0, -19, 9, 2.6, 0, 0, S.TAU); g.stroke();
  };

  /* ==========================================================
     角色立绘（重写：分层 + 赛璐璐 + 边缘光）
     st: {t, walk, dir, atk, hurt, seed}
     ========================================================== */
  const VILLAGER_CLOTH = [
    ['#8a6f52', '#5c4835'], ['#7d6b52', '#4f4231'], ['#6f7a68', '#48524a'], ['#8a7268', '#5a4842']
  ];
  function shadeC(hex, amt) {
    const c = S.hex2rgb(hex);
    const f = amt > 0 ? (v) => v + (255 - v) * amt : (v) => v * (1 + amt);
    return 'rgb(' + Math.round(f(c[0])) + ',' + Math.round(f(c[1])) + ',' + Math.round(f(c[2])) + ')';
  }

  R.drawHuman = function (g, id, x, y, scale, st) {
    const def = S.CHARS[id] || S.CHARS.villager;
    const c = def.c;
    st = st || {};
    const t = st.t || 0;
    const walk = st.walk || 0;
    const dir = st.dir === undefined ? 1 : st.dir;
    const atk = st.atk || 0;
    const bob = Math.sin(t * 9) * walk * 1.5;
    const sway = Math.sin(t * 2.0 + (st.seed || 0)) * (1.0 + walk * 2.4);

    let cloth = c.cloth, cloth2 = c.cloth2;
    if (id === 'villager') {
      const k = ((st.seed || 0) * 37 | 0) % 4;
      cloth = VILLAGER_CLOTH[k][0]; cloth2 = VILLAGER_CLOTH[k][1];
    }
    const accent = c.accent || '#e9d7ab';
    const skin = c.skin || '#f0d8c4';
    const hair = c.hair || '#5a5048';
    const hair2 = c.hair2 || '#3e3730';

    g.save();
    g.translate(x, y);
    g.scale(scale * dir, scale);
    g.lineJoin = 'round';

    const gy = -bob * 0.35;
    const legSw = Math.sin(t * 9) * walk * 6;

    /* 后发 */
    g.fillStyle = hair2;
    if (def.hair === 'long') {
      g.beginPath();
      g.moveTo(-10.5, -100 + gy);
      g.quadraticCurveTo(-14 - sway * 0.3, -72, -12 - sway * 0.7, -36);
      g.quadraticCurveTo(0, -30, 12 - sway * 0.7, -36);
      g.quadraticCurveTo(14 - sway * 0.3, -72, 10.5, -100 + gy);
      g.closePath(); g.fill();
    } else if (def.hair === 'braid') {
      g.beginPath();
      g.moveTo(-10, -100 + gy);
      g.quadraticCurveTo(-13, -84, -11, -70);
      g.lineTo(11, -70); g.quadraticCurveTo(13, -84, 10, -100 + gy);
      g.closePath(); g.fill();
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.ellipse(-11 + i * 1.2 - sway * 0.5, -66 + i * 10, 5.4 - i * 0.5, 6.6 - i * 0.5, 0.15, 0, S.TAU);
        g.fill();
      }
    } else if (def.hair === 'pony') {
      g.beginPath();
      g.moveTo(-10, -100 + gy);
      g.quadraticCurveTo(-13, -84, -10, -72);
      g.lineTo(10, -72); g.quadraticCurveTo(13, -84, 10, -100 + gy);
      g.closePath(); g.fill();
      g.beginPath();
      g.moveTo(6, -94 + gy);
      g.quadraticCurveTo(24 + sway * 1.6, -80, 20 + sway * 2.4, -44);
      g.quadraticCurveTo(13 + sway, -62, 6, -84 + gy);
      g.closePath(); g.fill();
    } else {
      g.beginPath();
      g.moveTo(-11, -100 + gy);
      g.quadraticCurveTo(-14, -82, -10, -72);
      g.lineTo(10, -72); g.quadraticCurveTo(14, -82, 11, -100 + gy);
      g.closePath(); g.fill();
    }

    /* 披风 / 外袍 */
    if (id !== 'ache') {
      g.fillStyle = c.cape || cloth2;
      g.beginPath();
      g.moveTo(-9, -80 + gy);
      g.quadraticCurveTo(-21 - sway * 1.5, -52, -17 - sway * 2.2, -12);
      g.quadraticCurveTo(-6, -20, 1, -46 + gy);
      g.closePath(); g.fill();
      g.strokeStyle = accent; g.globalAlpha = 0.35; g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(-19 - sway * 2, -16); g.quadraticCurveTo(-19 - sway * 1.6, -50, -9, -78 + gy);
      g.stroke();
      g.globalAlpha = 1;
    }

    /* 腿 */
    g.strokeStyle = cloth2;
    g.lineWidth = 6.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-3.6, -44 + gy); g.lineTo(-3.6 + legSw * 0.55, -8); g.stroke();
    g.beginPath(); g.moveTo(3.6, -44 + gy); g.lineTo(3.6 - legSw * 0.55, -8); g.stroke();
    g.strokeStyle = '#241d19'; g.lineWidth = 6.2;
    g.beginPath(); g.moveTo(-3.6 + legSw * 0.55, -9); g.lineTo(-3.9 + legSw * 0.55, -1.5); g.stroke();
    g.beginPath(); g.moveTo(3.6 - legSw * 0.55, -9); g.lineTo(3.3 - legSw * 0.55, -1.5); g.stroke();
    g.strokeStyle = 'rgba(200,190,170,0.20)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-5.4 + legSw * 0.55, -6); g.lineTo(-2.6 + legSw * 0.55, -6); g.stroke();

    /* 下摆 */
    const hem = Math.sin(t * 2.2) * (0.8 + walk * 1.8);
    g.fillStyle = cloth;
    g.beginPath();
    g.moveTo(-8.5, -50 + gy);
    g.quadraticCurveTo(-12, -38, -14.5 + hem, -22);
    g.quadraticCurveTo(0, -17, 14.5 + hem, -22);
    g.quadraticCurveTo(12, -38, 8.5, -50 + gy);
    g.closePath(); g.fill();
    g.fillStyle = shadeC(cloth, -0.28);
    g.beginPath();
    g.moveTo(2.5, -50 + gy);
    g.quadraticCurveTo(9, -38, 14.5 + hem, -22);
    g.quadraticCurveTo(6, -19, 0, -21);
    g.closePath(); g.fill();
    g.strokeStyle = accent; g.globalAlpha = 0.55; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-13.6 + hem, -22.5); g.quadraticCurveTo(0, -17.5, 13.6 + hem, -22.5); g.stroke();
    g.globalAlpha = 1;

    /* 躯干 */
    const tg = g.createLinearGradient(-9, -76, 10, -46);
    tg.addColorStop(0, shadeC(cloth, 0.12));
    tg.addColorStop(0.6, cloth);
    tg.addColorStop(1, shadeC(cloth, -0.30));
    g.fillStyle = tg;
    g.beginPath();
    g.moveTo(-8.6, -77 + gy);
    g.quadraticCurveTo(-10.4, -62, -8.2, -47 + gy);
    g.quadraticCurveTo(0, -43 + gy, 8.2, -47 + gy);
    g.quadraticCurveTo(10.4, -62, 8.6, -77 + gy);
    g.quadraticCurveTo(0, -81 + gy, -8.6, -77 + gy);
    g.closePath(); g.fill();
    g.fillStyle = shadeC(cloth, -0.22);
    g.beginPath();
    g.moveTo(-2.4, -78 + gy); g.lineTo(0, -46 + gy); g.lineTo(2.6, -78 + gy);
    g.closePath(); g.fill();
    g.strokeStyle = accent; g.globalAlpha = 0.5; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(0, -74 + gy); g.lineTo(0, -48 + gy); g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = shadeC(cloth2, 0.12);
    g.fillRect(-8.4, -54 + gy, 16.8, 4.4);
    g.fillStyle = accent;
    g.fillRect(-2, -54.4 + gy, 4, 5);
    g.fillStyle = 'rgba(245,240,225,0.22)';
    g.beginPath();
    g.moveTo(-7.6, -77 + gy); g.lineTo(0, -68 + gy); g.lineTo(7.6, -77 + gy);
    g.lineTo(0, -73 + gy); g.closePath(); g.fill();

    /* 手臂 */
    const armSw = Math.sin(t * 9 + Math.PI) * walk * 6.5;
    const atkArm = atk * 46;
    g.strokeStyle = shadeC(cloth, -0.14);
    g.lineWidth = 5.6; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-8, -74 + gy);
    g.quadraticCurveTo(-14, -62 + gy, -12.5 + armSw * 0.4, -48 + gy);
    g.stroke();
    g.strokeStyle = cloth;
    g.beginPath();
    g.moveTo(8, -74 + gy);
    g.quadraticCurveTo(16 + atkArm * 0.4, -66 - atkArm * 0.3 + gy, 14 + atkArm, -52 - atkArm * 0.45 + gy);
    g.stroke();
    g.strokeStyle = accent; g.globalAlpha = 0.45; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(-13.6, -49.6 + gy); g.lineTo(-11.4, -47.4 + gy); g.stroke();
    g.beginPath(); g.moveTo(13 + atkArm, -53.6 - atkArm * 0.45 + gy); g.lineTo(15 + atkArm, -51.4 - atkArm * 0.45 + gy); g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = skin;
    g.beginPath(); g.arc(-12.4 + armSw * 0.4, -47 + gy, 3, 0, S.TAU); g.fill();
    g.beginPath(); g.arc(14.4 + atkArm, -51 - atkArm * 0.45 + gy, 3, 0, S.TAU); g.fill();

    /* 头 */
    const hy = -92 + gy;
    g.fillStyle = shadeC(skin, -0.18);
    g.fillRect(-2.6, hy + 8, 5.2, 5);
    g.fillStyle = skin;
    g.beginPath(); g.ellipse(0, hy, 9.4, 10.6, 0, 0, S.TAU); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.06)';
    g.beginPath(); g.ellipse(3.4, hy + 1, 6, 9.6, 0, 0, S.TAU); g.fill();

    /* 头发 */
    g.fillStyle = hair;
    g.beginPath();
    g.moveTo(-10.2, hy + 4);
    g.quadraticCurveTo(-11.8, hy - 12, 0, hy - 13.4);
    g.quadraticCurveTo(11.8, hy - 12, 10.2, hy + 4);
    g.quadraticCurveTo(7.4, hy - 1.4, 0, hy - 3);
    g.quadraticCurveTo(-7.4, hy - 1.4, -10.2, hy + 4);
    g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(-10.4, hy - 1);
    g.quadraticCurveTo(-7.6, hy + 6.4, -3.2, hy + 1.6);
    g.quadraticCurveTo(0.4, hy + 6.8, 4.2, hy + 1.2);
    g.quadraticCurveTo(8.2, hy + 5.6, 10.4, hy - 2.4);
    g.quadraticCurveTo(7.2, hy - 12, 0, hy - 13.6);
    g.quadraticCurveTo(-7.2, hy - 12, -10.4, hy - 1);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.26)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(-6, hy - 9.5); g.quadraticCurveTo(-2, hy - 11.5, 2.4, hy - 10); g.stroke();
    g.fillStyle = hair2;
    g.beginPath();
    g.moveTo(-10, hy - 2); g.quadraticCurveTo(-12.4, hy + 8, -9.4, hy + 13);
    g.quadraticCurveTo(-7.4, hy + 6, -7.6, hy - 2); g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(10, hy - 2); g.quadraticCurveTo(12.4, hy + 8, 9.4, hy + 13);
    g.quadraticCurveTo(7.4, hy + 6, 7.6, hy - 2); g.closePath(); g.fill();

    /* 五官 */
    const fd = 0.55;
    if (id !== 'ache') {
      g.fillStyle = 'rgba(252,250,244,0.95)';
      g.beginPath(); g.ellipse(-3.9 + fd, hy + 1.6, 2.5, 2.8, 0, 0, S.TAU); g.fill();
      g.beginPath(); g.ellipse(3.9 + fd, hy + 1.6, 2.5, 2.8, 0, 0, S.TAU); g.fill();
      g.fillStyle = c.eye || '#4a6f6a';
      g.beginPath(); g.ellipse(-3.6 + fd, hy + 1.7, 1.7, 2.35, 0, 0, S.TAU); g.fill();
      g.beginPath(); g.ellipse(4.2 + fd, hy + 1.7, 1.7, 2.35, 0, 0, S.TAU); g.fill();
      g.fillStyle = 'rgba(16,24,28,0.7)';
      g.beginPath(); g.ellipse(-3.5 + fd, hy + 2.1, 0.8, 1.4, 0, 0, S.TAU); g.fill();
      g.beginPath(); g.ellipse(4.3 + fd, hy + 2.1, 0.8, 1.4, 0, 0, S.TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath(); g.arc(-4.3 + fd, hy + 0.8, 0.7, 0, S.TAU); g.fill();
      g.beginPath(); g.arc(3.5 + fd, hy + 0.8, 0.7, 0, S.TAU); g.fill();
      g.strokeStyle = 'rgba(40,36,36,0.45)'; g.lineWidth = 0.85;
      g.beginPath(); g.moveTo(-6.2 + fd, hy + 0.1); g.quadraticCurveTo(-3.9 + fd, hy - 1.4, -1.6 + fd, hy + 0.1); g.stroke();
      g.beginPath(); g.moveTo(1.8 + fd, hy + 0.1); g.quadraticCurveTo(4.2 + fd, hy - 1.4, 6.4 + fd, hy + 0.1); g.stroke();
      g.strokeStyle = 'rgba(160,96,96,0.55)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(-1.2 + fd, hy + 6.4); g.quadraticCurveTo(fd, hy + 7.4, 1.4 + fd, hy + 6.4); g.stroke();
      g.fillStyle = 'rgba(238,150,150,0.20)';
      g.beginPath(); g.ellipse(-6.4 + fd, hy + 4.6, 2.6, 1.4, 0, 0, S.TAU); g.fill();
      g.beginPath(); g.ellipse(6.4 + fd, hy + 4.6, 2.6, 1.4, 0, 0, S.TAU); g.fill();
    }

    /* 角色专属 */
    if (id === 'xu') {
      const gx = 14.4 + atkArm, gy2 = -51 - atkArm * 0.45 + gy;
      const gg = g.createRadialGradient(gx, gy2, 0, gx, gy2, 20);
      gg.addColorStop(0, 'rgba(140,240,224,0.45)');
      gg.addColorStop(1, 'rgba(140,240,224,0)');
      g.fillStyle = gg; g.beginPath(); g.arc(gx, gy2, 20, 0, S.TAU); g.fill();
      g.strokeStyle = '#e9d7ab'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(gx, gy2, 4.2, 0, S.TAU); g.stroke();
      g.fillStyle = '#bff6ea';
      g.beginPath(); g.arc(gx + Math.cos(t * 3) * 2.4, gy2 + Math.sin(t * 3) * 2.4, 1.3, 0, S.TAU); g.fill();
      g.fillStyle = '#e9d7ab';
      g.beginPath(); g.moveTo(8.4, hy - 8); g.lineTo(11.4, hy - 5.4); g.lineTo(8.4, hy - 2.8); g.lineTo(5.4, hy - 5.4); g.closePath(); g.fill();
      g.fillStyle = 'rgba(120,214,200,0.85)';
      g.beginPath();
      g.moveTo(-7, -77 + gy); g.quadraticCurveTo(0, -70 + gy, 7, -77 + gy);
      g.quadraticCurveTo(0, -73 + gy, -7, -77 + gy); g.closePath(); g.fill();
      g.beginPath();
      g.moveTo(5, -76 + gy); g.quadraticCurveTo(14 - sway, -66, 12 - sway * 1.6, -52);
      g.lineTo(7 - sway * 0.8, -57); g.quadraticCurveTo(9, -68, 2, -74 + gy);
      g.closePath(); g.fill();
    } else if (id === 'qingwu') {
      const bx = -17 - sway * 0.35;
      g.fillStyle = '#a58b5f';
      g.beginPath(); g.ellipse(bx, -52 + gy, 8.4, 10.5, 0.18, 0, S.TAU); g.fill();
      g.strokeStyle = '#7a6540'; g.lineWidth = 1.1;
      g.beginPath(); g.ellipse(bx, -52 + gy, 8.4, 10.5, 0.18, 0, S.TAU); g.stroke();
      g.beginPath(); g.ellipse(bx, -62 + gy, 7.4, 3.4, 0, 0, S.TAU); g.stroke();
      g.fillStyle = '#6f9e58';
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.ellipse(bx - 6 + i * 4, -66 - i * 1.6 + gy, 2.6, 4.6, 0.4, 0, S.TAU);
        g.fill();
      }
      g.fillStyle = '#8fc97a';
      g.beginPath(); g.ellipse(8.4, hy - 9.4, 2.2, 5.4, 0.55, 0, S.TAU); g.fill();
      g.beginPath(); g.ellipse(10.6, hy - 7.4, 1.8, 4.2, 0.9, 0, S.TAU); g.fill();
    } else if (id === 'lan') {
      g.save();
      g.translate(-13, -52 + gy);
      g.rotate(-0.55 + Math.sin(t * 1.1) * 0.03);
      g.strokeStyle = '#cfd4c8'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(0, 4); g.lineTo(0, -30); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(-0.6, 2); g.lineTo(-0.6, -28); g.stroke();
      g.strokeStyle = '#8a7a58'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-4.6, -2); g.lineTo(4.6, -2); g.stroke();
      g.fillStyle = '#c9a45c';
      g.beginPath(); g.arc(0, -32, 2, 0, S.TAU); g.fill();
      g.restore();
      g.fillStyle = 'rgba(18,24,28,0.6)';
      g.beginPath(); g.arc(8.2, hy + 9, 1.2, 0, S.TAU); g.fill();
    } else if (id === 'sun') {
      g.fillStyle = 'rgba(20,20,20,0.55)';
      g.fillRect(-6.4, hy - 0.6, 4.6, 1.5);
      g.strokeStyle = 'rgba(220,220,210,0.35)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(-6.6, hy + 4.6); g.lineTo(-1.4, hy + 4.4); g.stroke();
      g.strokeStyle = '#3a2e22'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(14.4, -50 + gy); g.lineTo(14.4, 0); g.stroke();
      const lg = g.createRadialGradient(14.4, -54 + gy, 0, 14.4, -54 + gy, 18);
      lg.addColorStop(0, 'rgba(255,206,120,0.55)');
      lg.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = lg; g.beginPath(); g.arc(14.4, -54 + gy, 18, 0, S.TAU); g.fill();
      g.fillStyle = 'rgba(44,38,28,0.92)';
      g.fillRect(11.6, -58 + gy, 5.6, 8.4);
      g.fillStyle = 'rgba(255,220,150,0.9)';
      g.fillRect(12.6, -56.4 + gy, 3.6, 5.2);
    } else if (id === 'bailu') {
      g.strokeStyle = 'rgba(255,244,216,' + (0.35 + Math.sin(t * 1.5) * 0.12) + ')';
      g.lineWidth = 1.3;
      g.beginPath(); g.ellipse(0, hy - 17, 13.5, 4.2, 0, 0, S.TAU); g.stroke();
      g.fillStyle = 'rgba(250,246,236,0.35)';
      g.beginPath();
      g.moveTo(-9.4, hy + 3); g.quadraticCurveTo(-13, hy + 20, -8.4, hy + 28);
      g.lineTo(8.4, hy + 28); g.quadraticCurveTo(13, hy + 20, 9.4, hy + 3);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(246,242,228,0.55)';
      g.beginPath();
      g.moveTo(-6, -50 + gy);
      g.quadraticCurveTo(-26 - sway * 2, -40, -22 - sway * 3, -6);
      g.quadraticCurveTo(-12, -20, -2, -46 + gy);
      g.closePath(); g.fill();
      g.fillStyle = '#e9d7ab';
      g.beginPath(); g.arc(-9, -30 + gy, 1.6, 0, S.TAU); g.fill();
    } else if (id === 'cen') {
      const gg = g.createRadialGradient(0, -60, 4, 0, -60, 62);
      gg.addColorStop(0, 'rgba(150,240,232,0.16)');
      gg.addColorStop(1, 'rgba(150,240,232,0)');
      g.fillStyle = gg; g.beginPath(); g.arc(0, -60, 62, 0, S.TAU); g.fill();
    } else if (id === 'ache') {
      g.fillStyle = 'rgba(244,240,230,0.96)';
      g.beginPath(); g.ellipse(0, hy + 1, 10.4, 12.2, 0, 0, S.TAU); g.fill();
      g.strokeStyle = 'rgba(60,54,48,0.45)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(0, hy + 1, 10.4, 12.2, 0, 0, S.TAU); g.stroke();
      g.fillStyle = 'rgba(18,22,26,0.45)';
      g.beginPath(); g.ellipse(3.4, hy + 9.4, 4.4, 2.6, 0.4, 0, S.TAU); g.fill();
      g.fillStyle = 'rgba(214,200,172,0.95)';
      g.fillRect(-9, -50 + gy, 18, 30);
      g.strokeStyle = 'rgba(120,108,88,0.6)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-9, -26 + gy); g.lineTo(9, -26 + gy); g.stroke();
    }

    /* 受击闪白 */
    if (st.hurt > 0) {
      g.globalAlpha = st.hurt * 0.6;
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = '#ffd0d0';
      g.beginPath(); g.ellipse(0, -56 + gy, 20, 40, 0, 0, S.TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }

    /* 边缘光 */
    g.strokeStyle = 'rgba(212,255,246,0.30)';
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(-9.6, -74 + gy);
    g.quadraticCurveTo(-11.4, -60, -9.6, -48 + gy);
    g.stroke();
    g.beginPath(); g.ellipse(0, hy, 9.8, 11, 0, -2.5, -1.0); g.stroke();

    g.restore();
  };

  /* ==========================================================
     角色立绘 v2 —— 半身胸像（透明背景，可导出为静态素材）
     512 × 600；大头构图 + 三段发色 + 下颌阴影 + 边缘光
     ========================================================== */
  function phex(hex, amt) {
    const c = S.hex2rgb(hex);
    const f = amt > 0 ? (v) => v + (255 - v) * amt : (v) => v * (1 + amt);
    return 'rgb(' + Math.round(f(c[0])) + ',' + Math.round(f(c[1])) + ',' + Math.round(f(c[2])) + ')';
  }
  function pa(hex, a) {
    const c = S.hex2rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }
  const HAIR_ID = { xu: 'long', qingwu: 'braid', lan: 'pony', sun: 'short', bailu: 'long', cen: 'long', ache: 'short' };

  R.drawPortrait = function (canvas, id) {
    const g = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    g.clearRect(0, 0, W, H);
    const def = S.CHARS[id];
    if (!def || def.narr) return;
    const c = def.c;
    g.save();
    g.scale(W / 512, H / 600);
    g.lineJoin = 'round';
    g.lineCap = 'round';

    /* ---------- 骨架 ---------- */
    const cx = 256, cy = 286;           // 头心
    const rx = 97, ry = 128;            // 头半径（鸭蛋脸：宽高比 0.76）
    const chin = cy + ry - 8;
    const hairTop = cy - ry - 26;

    const hair = c.hair, hairD = c.hair2 || phex(c.hair, -0.45), hairL = phex(c.hair, 0.42);
    const skin = c.skin || '#f3ddcb';
    const skinS = phex(skin, -0.10), skinS2 = phex(skin, -0.22), skinL = phex(skin, 0.16);
    const cloth = c.cloth || '#4a5a5a', clothD = c.cloth2 || phex(cloth, -0.35), clothL = phex(cloth, 0.16);
    const accent = c.accent || '#e9d7ab';
    const glow = c.glow || accent;
    const eyeC = c.eye || '#6fd3c7';
    const hairShape = def.hair || HAIR_ID[id] || 'short';
    const isGhost = id === 'cen';
    const isOld = id === 'sun';
    const isChild = id === 'ache';
    if (isGhost) g.globalAlpha = 0.9;

    /* ---------- 后发（暗底） ---------- */
    g.fillStyle = hairD;
    g.beginPath();
    g.ellipse(cx, cy - 10, rx + 26, ry + 22, 0, 0, S.TAU);
    g.fill();
    if (hairShape === 'long' || hairShape === 'braid') {
      g.beginPath();
      g.moveTo(cx - rx - 22, cy - 20);
      g.bezierCurveTo(cx - 196, cy + 120, cx - 190, cy + 280, cx - 168, 620);
      g.lineTo(cx + 168, 620);
      g.bezierCurveTo(cx + 190, cy + 280, cx + 196, cy + 120, cx + rx + 22, cy - 20);
      g.closePath();
      g.fill();
    } else if (hairShape === 'pony') {
      g.beginPath();
      g.moveTo(cx + 84, cy - 92);
      g.bezierCurveTo(cx + 200, cy - 30, cx + 226, cy + 160, cx + 182, 620);
      g.lineTo(cx + 96, 620);
      g.bezierCurveTo(cx + 140, cy + 170, cx + 126, cy + 10, cx + 84, cy - 92);
      g.closePath();
      g.fill();
    } else {
      g.beginPath();
      g.ellipse(cx, cy - 2, rx + 20, ry + 12, 0, 0, S.TAU);
      g.fill();
    }

    // 主色（内缩一圈，形成暗边；在脸之前绘制）
    g.fillStyle = hairD;
    g.beginPath();
    g.ellipse(cx, cy - 20, rx + 16, ry + 16, 0, 0, S.TAU);
    g.fill();

    /* ---------- 脖子（在衣领之下） ---------- */
    const neckG = g.createLinearGradient(cx - 44, chin - 30, cx + 40, 500);
    neckG.addColorStop(0, skinS);
    neckG.addColorStop(1, skinS2);
    g.fillStyle = neckG;
    g.beginPath();
    g.moveTo(cx - 38, chin - 26);
    g.lineTo(cx - 48, 500);
    g.quadraticCurveTo(cx, 516, cx + 48, 500);
    g.lineTo(cx + 38, chin - 26);
    g.closePath();
    g.fill();

    /* ---------- 身体 ---------- */
    const bodyGrad = g.createLinearGradient(cx - 240, 450, cx + 200, 600);
    bodyGrad.addColorStop(0, clothL);
    bodyGrad.addColorStop(0.52, cloth);
    bodyGrad.addColorStop(1, clothD);
    g.fillStyle = bodyGrad;
    g.beginPath();
    g.moveTo(-70, 600);
    g.bezierCurveTo(10, 498, 120, 456, 208, 448);
    g.lineTo(304, 448);
    g.bezierCurveTo(392, 456, 502, 498, 582, 600);
    g.closePath();
    g.fill();
    // 肩部受光
    const shoG = g.createLinearGradient(cx - 190, 480, cx + 30, 600);
    shoG.addColorStop(0, pa(phex(cloth, 0.36), 0.5));
    shoG.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = shoG;
    g.beginPath();
    g.moveTo(-70, 600);
    g.bezierCurveTo(10, 498, 120, 456, 208, 448);
    g.lineTo(220, 486);
    g.bezierCurveTo(130, 498, 40, 526, -10, 600);
    g.closePath();
    g.fill();
    // 领口
    g.fillStyle = phex(cloth, -0.30);
    g.beginPath();
    g.moveTo(204, 464);
    g.quadraticCurveTo(256, 552, 308, 464);
    g.quadraticCurveTo(284, 450, 256, 446);
    g.quadraticCurveTo(228, 450, 204, 464);
    g.closePath();
    g.fill();
    g.fillStyle = phex(cloth, 0.14);
    g.beginPath();
    g.moveTo(218, 460);
    g.quadraticCurveTo(256, 532, 294, 460);
    g.quadraticCurveTo(256, 490, 218, 460);
    g.closePath();
    g.fill();
    // 衣褶
    g.strokeStyle = pa(phex(cloth, -0.45), 0.26);
    g.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const sx2 = cx - 180 + i * 96;
      g.beginPath();
      g.moveTo(sx2, 600);
      g.quadraticCurveTo(sx2 + 22, 540, sx2 + 54 + (i - 1.5) * 12, 492);
      g.stroke();
    }


    /* ---------- 颈根（向下凸出的弧，压在领口之上） ---------- */
    const nbG = g.createLinearGradient(cx - 44, 412, cx + 44, 478);
    nbG.addColorStop(0, skinS);
    nbG.addColorStop(1, skinS2);
    g.fillStyle = nbG;
    g.beginPath();
    g.moveTo(cx - 38, 392);
    g.bezierCurveTo(cx - 40, 428, cx - 50, 448, cx - 44, 464);
    g.quadraticCurveTo(cx, 486, cx + 44, 464);
    g.bezierCurveTo(cx + 50, 448, cx + 40, 428, cx + 38, 392);
    g.closePath();
    g.fill();
    // 颈根投落在衣领上的影
    g.strokeStyle = 'rgba(8,12,14,0.20)';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(cx - 46, 448);
    g.quadraticCurveTo(cx, 498, cx + 46, 448);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.10)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx - 34, 442);
    g.quadraticCurveTo(cx, 480, cx + 34, 442);
    g.stroke();
    /* ---------- 脸 ---------- */
    const faceGrad = g.createLinearGradient(cx - 110, cy - 110, cx + 90, cy + 120);
    faceGrad.addColorStop(0, skinL);
    faceGrad.addColorStop(0.44, skin);
    faceGrad.addColorStop(1, skinS);
    g.fillStyle = faceGrad;
    g.beginPath();
    g.moveTo(cx - rx, cy - 14);
    g.bezierCurveTo(cx - rx - 2, cy - ry * 0.72, cx - rx * 0.54, cy - ry, cx, cy - ry);
    g.bezierCurveTo(cx + rx * 0.54, cy - ry, cx + rx + 2, cy - ry * 0.72, cx + rx, cy - 14);
    g.bezierCurveTo(cx + rx * 0.93, cy + ry * 0.46, cx + rx * 0.42, cy + ry * 0.92, cx, chin);
    g.bezierCurveTo(cx - rx * 0.42, cy + ry * 0.92, cx - rx * 0.93, cy + ry * 0.46, cx - rx, cy - 14);
    g.closePath();
    g.fill();
    // 耳
    g.fillStyle = skinS;
    g.beginPath(); g.ellipse(cx - rx + 2, cy + 24, 13, 24, 0.12, 0, S.TAU); g.fill();
    g.beginPath(); g.ellipse(cx + rx - 2, cy + 24, 13, 24, -0.12, 0, S.TAU); g.fill();
    // 右侧暗部
    g.fillStyle = pa(skinS2, 0.28);
    g.beginPath(); g.ellipse(cx + 66, cy + 34, 27, 58, 0.18, 0, S.TAU); g.fill();
    // 下颌投影（脸压在脖子上，柔和过渡）
    const jawS = g.createLinearGradient(0, chin - 8, 0, chin + 22);
    jawS.addColorStop(0, 'rgba(10,14,18,0.24)');
    jawS.addColorStop(0.55, 'rgba(10,14,18,0.10)');
    jawS.addColorStop(1, 'rgba(10,14,18,0)');
    g.fillStyle = jawS;
    g.beginPath(); g.ellipse(cx, chin - 6, 48, 20, 0, 0, Math.PI); g.fill();
    // 下巴高光
    g.fillStyle = pa('#ffffff', 0.10);
    g.beginPath(); g.ellipse(cx, chin - 16, 24, 13, 0, 0, S.TAU); g.fill();
    // 额头投影
    const fh = g.createLinearGradient(0, cy - ry, 0, cy - 4);
    fh.addColorStop(0, pa(skinS2, 0.26));
    fh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fh;
    g.beginPath(); g.ellipse(cx, cy - 54, rx - 2, 68, 0, 0, S.TAU); g.fill();

    /* ---------- 眼 ---------- */
    const eyeY = cy + 28, eyeDX = 43;
    const eyeW = isChild ? 26 : 26, eyeH = (isChild ? 33 : 31) * (isOld ? 0.66 : 1);
    function eye(px, dir) {
      g.fillStyle = '#fdf9f4';
      g.beginPath(); g.ellipse(px, eyeY, eyeW, eyeH, 0, 0, S.TAU); g.fill();
      g.save();
      g.beginPath(); g.ellipse(px, eyeY, eyeW, eyeH, 0, 0, S.TAU); g.clip();
      const ig = g.createLinearGradient(px, eyeY - eyeH, px, eyeY + eyeH);
      ig.addColorStop(0, phex(eyeC, -0.52));
      ig.addColorStop(0.4, eyeC);
      ig.addColorStop(1, phex(eyeC, 0.55));
      g.fillStyle = ig;
      g.beginPath(); g.ellipse(px, eyeY + 2, eyeW * 0.76, eyeH * 0.9, 0, 0, S.TAU); g.fill();
      // 瞳孔
      g.fillStyle = 'rgba(10,14,20,0.88)';
      g.beginPath(); g.ellipse(px, eyeY + 3, eyeW * 0.26, eyeH * 0.36, 0, 0, S.TAU); g.fill();
      // 上方阴影
      g.fillStyle = 'rgba(96,96,118,0.18)';
      g.beginPath(); g.ellipse(px, eyeY - eyeH * 0.6, eyeW, eyeH * 0.46, 0, 0, S.TAU); g.fill();
      // 下方反光
      g.fillStyle = pa(phex(eyeC, 0.75), 0.45);
      g.beginPath(); g.ellipse(px, eyeY + eyeH * 0.62, eyeW * 0.6, eyeH * 0.26, 0, 0, S.TAU); g.fill();
      g.restore();
      // 高光
      g.fillStyle = 'rgba(255,255,255,0.96)';
      g.beginPath(); g.arc(px - 6, eyeY - 8, 6.4, 0, S.TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath(); g.arc(px + 8, eyeY + 9, 2.8, 0, S.TAU); g.fill();
      // 上眼睑
      g.strokeStyle = phex(hairD, -0.45);
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(px - eyeW - 3, eyeY - 6);
      g.quadraticCurveTo(px, eyeY - eyeH - 10, px + eyeW + 3, eyeY - 5);
      g.stroke();
      // 眼尾
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(px + dir * (eyeW + 2), eyeY - 5);
      g.quadraticCurveTo(px + dir * (eyeW + 13), eyeY - 14, px + dir * (eyeW + 18), eyeY - 21);
      g.stroke();
      // 下睑
      g.strokeStyle = pa(phex(hairD, -0.05), 0.45);
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(px - eyeW + 5, eyeY + eyeH * 0.82);
      g.quadraticCurveTo(px, eyeY + eyeH + 5, px + eyeW - 5, eyeY + eyeH * 0.8);
      g.stroke();
      // 眉
      g.strokeStyle = pa(hairD, 0.85);
      g.lineWidth = 3.6;
      g.beginPath();
      g.moveTo(px - eyeW - 3, eyeY - eyeH - 18);
      g.quadraticCurveTo(px, eyeY - eyeH - 27, px + eyeW + 2, eyeY - eyeH - 14);
      g.stroke();
    }
    eye(cx - eyeDX, -1);
    eye(cx + eyeDX, 1);

    // 鼻
    g.strokeStyle = pa(skinS2, 0.55);
    g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(cx + 3, cy + 62);
    g.quadraticCurveTo(cx + 9, cy + 72, cx + 1, cy + 75);
    g.stroke();
    // 嘴
    g.strokeStyle = pa(phex(skin, -0.5), 0.72);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx - 14, cy + 94);
    g.quadraticCurveTo(cx, cy + 100, cx + 14, cy + 94);
    g.stroke();
    g.fillStyle = 'rgba(236,146,146,0.16)';
    g.beginPath(); g.ellipse(cx - 64, cy + 60, 25, 12, -0.14, 0, S.TAU); g.fill();
    g.beginPath(); g.ellipse(cx + 64, cy + 60, 25, 12, 0.14, 0, S.TAU); g.fill();

    if (isOld) {
      g.strokeStyle = 'rgba(126,84,72,0.5)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx + 10, cy - 76); g.lineTo(cx + 76, cy + 50); g.stroke();
      g.beginPath(); g.moveTo(cx + 24, cy - 68); g.lineTo(cx + 66, cy + 30); g.stroke();
      g.fillStyle = 'rgba(96,90,84,0.13)';
      g.beginPath(); g.ellipse(cx, cy + 86, 62, 28, 0, 0, Math.PI); g.fill();
    }

    /* ---------- 头发（三段 + 裁剪，避免盖到脸） ---------- */
    function traceBangs() {
      g.beginPath();
      g.moveTo(cx - rx - 12, cy - 6);
      g.bezierCurveTo(cx - rx - 16, cy - 92, cx - 54, hairTop - 6, cx, hairTop - 8);
      g.bezierCurveTo(cx + 54, hairTop - 6, cx + rx + 16, cy - 92, cx + rx + 12, cy - 6);
      g.lineTo(cx + rx - 2, cy - 24);
      g.quadraticCurveTo(cx + 58, cy - 58, cx + 40, cy - 8);
      g.quadraticCurveTo(cx + 18, cy - 70, cx - 4, cy - 14);
      g.quadraticCurveTo(cx - 32, cy - 72, cx - 52, cy - 10);
      g.quadraticCurveTo(cx - 78, cy - 56, cx - rx + 2, cy - 22);
      g.closePath();
    }
    traceBangs();
    g.fillStyle = hair;
    g.fill();
    // 刘海内的全部细节都裁剪住
    g.save();
    traceBangs();
    g.clip();
    // 发根暗部
    g.fillStyle = pa(hairD, 0.55);
    g.beginPath();
    g.moveTo(cx - rx - 10, cy - 20);
    g.bezierCurveTo(cx - 96, cy - 86, cx - 50, hairTop + 2, cx - 6, hairTop);
    g.bezierCurveTo(cx - 44, cy - 70, cx - 66, cy - 46, cx - 58, cy - 28);
    g.closePath();
    g.fill();
    // 高光带
    g.strokeStyle = pa(hairL, 0.55);
    g.lineWidth = 15;
    g.beginPath();
    g.arc(cx, cy - 12, rx + 6, Math.PI * 1.10, Math.PI * 1.74);
    g.stroke();
    g.strokeStyle = pa(hairL, 0.95);
    g.lineWidth = 5.5;
    g.beginPath();
    g.arc(cx, cy - 10, rx - 4, Math.PI * 1.14, Math.PI * 1.72);
    g.stroke();
    g.strokeStyle = pa(hairL, 0.6);
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy - 8, rx - 20, Math.PI * 1.18, Math.PI * 1.64);
    g.stroke();
    // 发丝
    g.strokeStyle = pa(hairD, 0.4);
    g.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const a0 = Math.PI * (1.06 + i * 0.092);
      const r0 = rx + 14, r1 = rx - 30;
      g.beginPath();
      g.moveTo(cx + Math.cos(a0) * r0, cy - 12 + Math.sin(a0) * (ry + 12));
      g.quadraticCurveTo(cx + Math.cos(a0) * (r0 + r1) * 0.5, cy - 12 + Math.sin(a0) * (ry + 4), cx + Math.cos(a0) * r1, cy - 12 + Math.sin(a0) * (ry - 26));
      g.stroke();
    }
    g.restore();

    // 侧发（贴脸两侧）
    function traceSide(sign) {
      g.beginPath();
      g.moveTo(cx + sign * (rx - 6), cy - 46);
      g.bezierCurveTo(cx + sign * (rx + 16), cy + 24, cx + sign * (rx + 8), cy + 104, cx + sign * (rx - 12), cy + 150);
      g.lineTo(cx + sign * (rx - 34), cy + 138);
      g.bezierCurveTo(cx + sign * (rx - 16), cy + 72, cx + sign * (rx - 20), cy + 6, cx + sign * (rx - 24), cy - 40);
      g.closePath();
    }
    traceSide(-1); g.fillStyle = hair; g.fill();
    traceSide(1); g.fill();
    g.save();
    traceSide(1); g.clip();
    g.fillStyle = pa(hairD, 0.42);
    g.fillRect(cx + rx - 40, cy - 60, 60, 220);
    g.restore();
    g.save();
    traceSide(-1); g.clip();
    g.strokeStyle = pa(hairL, 0.5);
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx - rx - 2, cy - 30);
    g.quadraticCurveTo(cx - rx - 6, cy + 40, cx - rx + 4, cy + 120);
    g.stroke();
    g.restore();

    /* ---------- 角色专属 ---------- */
    if (id === 'xu') {
      const gx = cx + 138, gy = 546;
      const halo = g.createRadialGradient(gx, gy, 2, gx, gy, 52);
      halo.addColorStop(0, 'rgba(150,240,225,0.5)');
      halo.addColorStop(1, 'rgba(150,240,225,0)');
      g.fillStyle = halo; g.beginPath(); g.arc(gx, gy, 52, 0, S.TAU); g.fill();
      g.strokeStyle = accent; g.lineWidth = 4;
      g.beginPath(); g.arc(gx, gy, 18, 0, S.TAU); g.stroke();
      g.strokeStyle = 'rgba(190,250,240,0.9)'; g.lineWidth = 2;
      g.beginPath(); g.arc(gx, gy, 10, 0, S.TAU); g.stroke();
      g.fillStyle = '#d8fff8';
      g.beginPath(); g.arc(gx - 3, gy - 3, 3, 0, S.TAU); g.fill();
      // 围巾
      g.fillStyle = 'rgba(108,208,194,0.92)';
      g.beginPath();
      g.moveTo(202, 464);
      g.quadraticCurveTo(256, 522, 310, 464);
      g.quadraticCurveTo(288, 518, 300, 600);
      g.lineTo(238, 600);
      g.quadraticCurveTo(250, 522, 202, 486);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(238, 486); g.quadraticCurveTo(258, 540, 262, 596); g.stroke();
      // 发饰
      g.fillStyle = accent;
      g.beginPath();
      g.moveTo(cx + 82, cy - 120); g.lineTo(cx + 100, cy - 102); g.lineTo(cx + 82, cy - 84); g.lineTo(cx + 64, cy - 102);
      g.closePath(); g.fill();
    } else if (id === 'qingwu') {
      g.strokeStyle = '#8a7550'; g.lineWidth = 10;
      g.beginPath(); g.moveTo(150, 458); g.quadraticCurveTo(196, 540, 246, 600); g.stroke();
      // 药篓（右上）
      g.fillStyle = '#a58b5f';
      g.beginPath(); g.ellipse(392, 520, 40, 48, 0.14, 0, S.TAU); g.fill();
      g.strokeStyle = '#7a6540'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(392, 520, 40, 48, 0.14, 0, S.TAU); g.stroke();
      g.fillStyle = '#6f9e58';
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.ellipse(372 + i * 11, 470 - (i % 2) * 10, 7, 20, 0.5 + i * 0.1, 0, S.TAU);
        g.fill();
      }
      // 草叶发饰
      g.fillStyle = '#8fc97a';
      g.save(); g.translate(cx + 74, cy - 116); g.rotate(0.5);
      g.beginPath(); g.ellipse(0, 0, 8, 26, 0, 0, S.TAU); g.fill();
      g.fillStyle = '#a8dd90';
      g.beginPath(); g.ellipse(-14, 8, 7, 20, -0.4, 0, S.TAU); g.fill();
      g.restore();
      // 围裙
      g.fillStyle = 'rgba(242,234,210,0.94)';
      g.beginPath();
      g.moveTo(212, 512); g.lineTo(300, 512);
      g.lineTo(316, 600); g.lineTo(196, 600);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(186,166,126,0.35)';
      g.fillRect(212, 512, 88, 7);
    } else if (id === 'lan') {
      g.save();
      g.translate(cx + 196, 486); g.rotate(0.3);
      g.fillStyle = '#6f7468'; g.fillRect(-11, -230, 22, 300);
      g.fillStyle = '#b6bcb0'; g.fillRect(-6, -226, 6, 290);
      g.fillStyle = '#c9a45c'; g.fillRect(-30, 64, 60, 14);
      g.fillRect(-8, 78, 16, 54);
      g.fillStyle = '#3a3b34';
      g.beginPath(); g.ellipse(0, 138, 13, 17, 0, 0, S.TAU); g.fill();
      g.restore();
      g.fillStyle = phex(cloth, 0.28);
      g.beginPath();
      g.moveTo(182, 444); g.quadraticCurveTo(256, 486, 330, 444);
      g.quadraticCurveTo(256, 522, 182, 444);
      g.closePath(); g.fill();
      g.strokeStyle = accent; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(188, 450); g.quadraticCurveTo(256, 490, 324, 450); g.stroke();
    } else if (id === 'sun') {
      const lx = 404, ly = 540;
      const lg = g.createRadialGradient(lx, ly, 2, lx, ly, 90);
      lg.addColorStop(0, 'rgba(255,206,130,0.5)');
      lg.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = lg; g.beginPath(); g.arc(lx, ly, 90, 0, S.TAU); g.fill();
      g.fillStyle = 'rgba(46,40,30,0.95)';
      g.fillRect(lx - 15, ly - 22, 30, 44);
      g.fillStyle = 'rgba(255,224,160,0.95)';
      g.fillRect(lx - 10, ly - 15, 20, 30);
      g.strokeStyle = 'rgba(40,34,26,0.9)'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(lx, ly - 22); g.lineTo(lx, ly - 48); g.stroke();
      // 斗篷
      g.fillStyle = 'rgba(26,32,36,0.42)';
      g.beginPath();
      g.moveTo(-40, 600); g.quadraticCurveTo(40, 500, 140, 470);
      g.lineTo(180, 520); g.quadraticCurveTo(60, 540, 10, 600);
      g.closePath(); g.fill();
      g.beginPath();
      g.moveTo(552, 600); g.quadraticCurveTo(472, 500, 372, 470);
      g.lineTo(332, 520); g.quadraticCurveTo(452, 540, 502, 600);
      g.closePath(); g.fill();
    } else if (id === 'bailu') {
      g.strokeStyle = 'rgba(255,246,218,0.72)'; g.lineWidth = 3.4;
      g.beginPath(); g.ellipse(cx, cy - 156, 96, 24, 0, 0, S.TAU); g.stroke();
      g.strokeStyle = 'rgba(255,250,230,0.26)'; g.lineWidth = 11;
      g.beginPath(); g.ellipse(cx, cy - 156, 96, 24, 0, 0, S.TAU); g.stroke();
      // 面纱
      g.fillStyle = 'rgba(250,246,238,0.26)';
      g.beginPath();
      g.moveTo(cx - 118, cy + 60); g.quadraticCurveTo(cx - 140, cy + 220, cx - 90, 600);
      g.lineTo(cx + 90, 600); g.quadraticCurveTo(cx + 140, cy + 220, cx + 118, cy + 60);
      g.closePath(); g.fill();
      g.fillStyle = accent;
      g.beginPath(); g.arc(cx - 140, cy + 250, 9, 0, S.TAU); g.fill();
      g.beginPath(); g.arc(cx - 140, cy + 274, 7, 0, S.TAU); g.fill();
    } else if (id === 'cen') {
      const halo = g.createRadialGradient(cx, cy, 20, cx, cy + 70, 340);
      halo.addColorStop(0, 'rgba(150,240,232,0.24)');
      halo.addColorStop(1, 'rgba(150,240,232,0)');
      g.fillStyle = halo; g.beginPath(); g.arc(cx, cy + 70, 340, 0, S.TAU); g.fill();
      g.strokeStyle = 'rgba(180,250,244,0.26)'; g.lineWidth = 1.8;
      for (let i = 0; i < 4; i++) {
        g.beginPath(); g.ellipse(cx, cy + 70, 168 + i * 24, 220 + i * 26, 0, 0, S.TAU); g.stroke();
      }
    } else if (id === 'ache') {
      g.fillStyle = 'rgba(246,242,232,0.97)';
      g.beginPath();
      g.moveTo(cx - 74, cy - 44);
      g.quadraticCurveTo(cx - 66, cy - 104, cx, cy - 112);
      g.quadraticCurveTo(cx + 66, cy - 104, cx + 74, cy - 44);
      g.quadraticCurveTo(cx + 62, cy + 74, cx, cy + 96);
      g.quadraticCurveTo(cx - 62, cy + 74, cx - 74, cy - 44);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(80,72,62,0.30)'; g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(cx - 74, cy - 44);
      g.quadraticCurveTo(cx - 66, cy - 104, cx, cy - 112);
      g.quadraticCurveTo(cx + 66, cy - 104, cx + 74, cy - 44);
      g.quadraticCurveTo(cx + 62, cy + 74, cx, cy + 96);
      g.quadraticCurveTo(cx - 62, cy + 74, cx - 74, cy - 44);
      g.stroke();
      g.fillStyle = 'rgba(12,16,20,0.84)';
      g.beginPath(); g.ellipse(cx - 30, cy - 4, 13, 18, 0, 0, S.TAU); g.fill();
      g.beginPath(); g.ellipse(cx + 30, cy - 4, 13, 18, 0, 0, S.TAU); g.fill();
      g.fillStyle = 'rgba(20,24,28,0.3)';
      g.beginPath(); g.ellipse(cx + 12, cy + 74, 19, 10, 0.3, 0, S.TAU); g.fill();
    }

    /* ---------- 边缘光 ---------- */
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(208,255,250,0.34)';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(cx, cy - 16, rx + 20, Math.PI * 1.02, Math.PI * 1.40);
    g.stroke();
    g.strokeStyle = 'rgba(208,255,250,0.20)';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx - 144, cy + 34);
    g.bezierCurveTo(cx - 176, cy + 160, cx - 196, cy + 320, cx - 216, 600);
    g.stroke();
    g.strokeStyle = pa(glow, 0.14);
    g.lineWidth = 16;
    g.beginPath();
    g.moveTo(cx + rx + 12, cy - 40);
    g.bezierCurveTo(cx + rx + 20, cy + 50, cx + 84, cy + 108, cx + 30, cy + 156);
    g.stroke();
    g.restore();

    /* ---------- 底部渐隐 ---------- */
    const fade = g.createLinearGradient(0, 520, 0, 600);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = fade;
    g.fillRect(0, 520, 512, 80);
    g.globalCompositeOperation = 'source-over';

    g.restore();
  };

})();
