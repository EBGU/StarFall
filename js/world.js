/* =====================================================================
   拾星纪 · 长庚  —  world.js
   大陆生成 / 地表预渲染 / 碰撞 / 物件
   ===================================================================== */
(function () {
  'use strict';
  const S = window.STAR;
  const W = S.WORLD.W, H = S.WORLD.H;
  const BS = 0.5;                 // 底图缩放
  const CX = 3600, CY = 2400, RX = 3300, RY = 2110;

  /* ---------------- 岛屿轮廓 ---------------- */
  function radial(a) {
    const n1 = S.fbm(Math.cos(a) * 2.4 + 11.7, Math.sin(a) * 2.4 + 3.1, 3);
    const n2 = S.fbm(Math.cos(a) * 6.1 - 4.2, Math.sin(a) * 6.1 + 8.8, 2);
    return 1 + (n1 - 0.5) * 0.19 + (n2 - 0.5) * 0.06;
  }
  const OUTLINE = [];
  (function () {
    for (let i = 0; i < 512; i++) {
      const a = (i / 512) * S.TAU;
      const r = radial(a);
      OUTLINE.push([CX + Math.cos(a) * RX * r, CY + Math.sin(a) * RY * r]);
    }
  })();
  function insideIsland(x, y) {
    const u = (x - CX) / RX, v = (y - CY) / RY;
    const rr = Math.hypot(u, v);
    if (rr > 1.09) return false;
    return rr < radial(Math.atan2(v, u)) - 0.004;
  }

  /* ---------------- 折线工具 ---------------- */
  const RIVER = [[2500, -200], [2610, 480], [2760, 1120], [2690, 1760], [2810, 2380],
                 [2760, 3060], [2860, 3620], [2990, 4180], [3050, 5000]];
  const CHASM = [[4970, -200], [5050, 720], [4990, 1520], [5070, 2400], [5000, 3120],
                 [5090, 3900], [5040, 5000]];
  const ROAD_MAIN = [[1180, 3300], [1700, 3180], [2300, 3120], [2760, 3060], [3300, 2960], [3560, 2620], [3700, 2080], [3920, 1700], [4060, 1560]];
  const ROAD_SOUTH = [[4060, 1620], [3960, 2200], [3840, 2820], [3700, 3300], [3640, 3560]];
  const ROAD_EAST = [[3560, 2620], [4100, 2540], [4600, 2500], [5030, 2440]];
  const ROAD_CRATER = [[5030, 2440], [5450, 2420], [5800, 2400], [6250, 2400]];

  function distToPolyline(x, y, pts) {
    let best = Infinity, bw = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1];
      const dx = bx - ax, dy = by - ay;
      const L = dx * dx + dy * dy || 1;
      let t = ((x - ax) * dx + (y - ay) * dy) / L;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = ax + dx * t, py = ay + dy * t;
      const d = Math.hypot(x - px, y - py);
      if (d < best) { best = d; bw = i; }
    }
    return { d: best, i: bw };
  }
  const riverW = (i) => 108 + i * 7;
  const chasmW = () => 118;
  const BRIDGES = [
    { x: 2760, y: 3060, w: 320, h: 190, t: 'wood' },
    { x: 5030, y: 2440, w: 420, h: 210, t: 'stone' }
  ];
  function onBridge(x, y) {
    for (const b of BRIDGES) {
      if (Math.abs(x - b.x) < b.w / 2 && Math.abs(y - b.y) < b.h / 2) return b;
    }
    return null;
  }
  function inRiver(x, y) {
    if (onBridge(x, y)) return false;
    const r = distToPolyline(x, y, RIVER);
    return r.d < riverW(r.i) * 0.5;
  }
  function inChasm(x, y) {
    if (onBridge(x, y)) return false;
    const r = distToPolyline(x, y, CHASM);
    return r.d < chasmW() * 0.5;
  }

  /* ---------------- 区域 ---------------- */
  function regionAt(x) { return x < 2750 ? 'A' : x < 5050 ? 'B' : 'C'; }

  /* ---------------- 碰撞栅格 ---------------- */
  const GS = 20;
  const GW = Math.ceil(W / GS), GH = Math.ceil(H / GS);
  const grid = new Uint8Array(GW * GH); // 0 可走 1 阻挡 2 水
  function buildGrid() {
    for (let gy = 0; gy < GH; gy++) {
      for (let gx = 0; gx < GW; gx++) {
        const x = gx * GS + GS / 2, y = gy * GS + GS / 2;
        let v = 0;
        if (!insideIsland(x, y)) v = 1;
        else if (inChasm(x, y)) v = 1;
        else if (inRiver(x, y)) v = 2;
        grid[gy * GW + gx] = v;
      }
    }
  }
  function terrainAt(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return 1;
    return grid[((y / GS) | 0) * GW + ((x / GS) | 0)];
  }

  /* ---------------- 物件生成 ---------------- */
  const props = [];
  const buckets = new Map();
  const BK = 320;
  function bkey(x, y) { return ((x / BK) | 0) + ',' + ((y / BK) | 0); }
  function addProp(p) {
    p.y = p.y || 0;
    props.push(p);
    const k = bkey(p.x, p.y);
    let a = buckets.get(k); if (!a) { a = []; buckets.set(k, a); }
    a.push(p);
  }
  function propsInRect(x0, y0, x1, y1, out) {
    out.length = 0;
    const ax = Math.floor(x0 / BK), bx = Math.floor(x1 / BK);
    const ay = Math.floor(y0 / BK), by = Math.floor(y1 / BK);
    for (let gy = ay; gy <= by; gy++) {
      for (let gx = ax; gx <= bx; gx++) {
        const a = buckets.get(gx + ',' + gy);
        if (!a) continue;
        for (let i = 0; i < a.length; i++) {
          const p = a[i];
          if (p.x > x0 - 260 && p.x < x1 + 260 && p.y > y0 - 340 && p.y < y1 + 160) out.push(p);
        }
      }
    }
    return out;
  }

  function freeSpot(x, y, pad) {
    if (terrainAt(x, y) !== 0) return false;
    const r = distToPolyline(x, y, ROAD_MAIN);
    if (r.d < 62 + (pad || 0)) return false;
    const r2 = distToPolyline(x, y, ROAD_SOUTH);
    if (r2.d < 56) return false;
    const r3 = distToPolyline(x, y, ROAD_EAST);
    if (r3.d < 56) return false;
    const r4 = distToPolyline(x, y, ROAD_CRATER);
    if (r4.d < 56) return false;
    return true;
  }

  const rnd = S.rng(20261017);

  function generateProps() {
    /* --- 树木 --- */
    const step = 64;
    for (let y = 120; y < H - 120; y += step) {
      for (let x = 120; x < W - 120; x += step) {
        const jx = x + (rnd() - 0.5) * step * 1.5;
        const jy = y + (rnd() - 0.5) * step * 1.5;
        if (!freeSpot(jx, jy, 20)) continue;
        const reg = regionAt(jx);
        const forest = S.fbm(jx * 0.0016 + 3, jy * 0.0016 - 7, 3);
        const near = S.distToPolyline ? 0 : 0;
        let p = 0, type = 'tree';
        if (reg === 'A') {
          p = (forest - 0.60) * 1.9;
          type = rnd() < 0.10 ? 'sakura' : 'tree';
        } else if (reg === 'B') {
          p = (forest - 0.50) * 1.9;
          type = rnd() < 0.74 ? 'pine' : 'tree';
        } else {
          p = (forest - 0.66) * 1.5;
          type = 'dead';
        }
        // 村子/遗迹/观星台周围清空
        if (S.dist(jx, jy, S.LM.village.x, S.LM.village.y) < 460) p *= 0.22;
        if (S.dist(jx, jy, S.LM.ruins.x, S.LM.ruins.y) < 460) p *= 0.25;
        if (S.dist(jx, jy, S.LM.observatory.x, S.LM.observatory.y) < 700) p = 0;
        if (S.dist(jx, jy, S.LM.stele.x, S.LM.stele.y) < 300) p *= 0.2;
        if (S.dist(jx, jy, S.LM.crater.x, S.LM.crater.y) < 300) p = 0;
        if (S.dist(jx, jy, S.LM.start.x, S.LM.start.y) < 230) p = 0;
        if (rnd() < p) {
          const s = 0.75 + rnd() * 0.55;
          addProp({ t: type, x: jx, y: jy, s, seed: rnd() * 999, r: 10 * s, sw: rnd() * 6.28 });
        }
      }
    }

    /* --- 石头 --- */
    for (let i = 0; i < 900; i++) {
      const x = 140 + rnd() * (W - 280), y = 140 + rnd() * (H - 280);
      if (!freeSpot(x, y, 30)) continue;
      if (S.dist(x, y, S.LM.village.x, S.LM.village.y) < 380) continue;
      if (S.dist(x, y, S.LM.crater.x, S.LM.crater.y) < 240) continue;
      const reg = regionAt(x);
      const s = 0.4 + rnd() * (reg === 'C' ? 1.6 : 0.9);
      addProp({ t: 'rock', x, y, s, seed: rnd() * 999, r: reg === 'C' ? 16 * s : 11 * s });
    }

    /* --- 云栖村 --- */
    const V = S.LM.village;
    const houses = [
      [V.x - 250, V.y - 160, 0.02], [V.x + 40, V.y - 245, -0.02], [V.x + 320, V.y - 150, 0.04],
      [V.x - 320, V.y + 60, 0.03], [V.x + 300, V.y + 60, -0.03],
      [V.x - 180, V.y + 260, 0.02], [V.x + 140, V.y + 310, -0.02]
    ];
    houses.forEach((h, i) => addProp({ t: 'house', x: h[0], y: h[1], s: 1, rot: h[2], seed: i * 31, r: 82 }));
    addProp({ t: 'well', x: V.x + 40, y: V.y + 90, s: 1, seed: 3, r: 26 });
    addProp({ t: 'stall', x: V.x - 105, y: V.y + 168, s: 1, seed: 21, r: 44 });
    addProp({ t: 'stall', x: V.x + 128, y: V.y + 118, s: 1, seed: 22, r: 44 });
    addProp({ t: 'board', x: V.x - 148, y: V.y + 26, s: 1, seed: 23, r: 16 });
    addProp({ t: 'hay', x: V.x + 214, y: V.y + 208, s: 1, seed: 24, r: 26 });
    addProp({ t: 'hay', x: V.x - 232, y: V.y - 236, s: 1, seed: 25, r: 26 });
    addProp({ t: 'cart', x: V.x + 88, y: V.y - 118, s: 1, seed: 26, r: 34 });
    addProp({ t: 'barrel', x: V.x + 196, y: V.y + 40, s: 1, seed: 27, r: 14 });
    addProp({ t: 'barrel', x: V.x + 228, y: V.y + 58, s: 1, seed: 28, r: 14 });
    addProp({ t: 'barrel', x: V.x - 196, y: V.y + 108, s: 1, seed: 29, r: 14 });
    addProp({ t: 'gate', x: V.x - 20, y: V.y + 430, s: 1, rot: 0, seed: 5, r: 60 });
    addProp({ t: 'stele', x: V.x - 122, y: V.y + 452, s: 1.15, seed: 91, r: 12 });
    addProp({ t: 'shoes', x: S.LM.pharmacy.x + 74, y: S.LM.pharmacy.y + 52, s: 1, seed: 3, r: 0 });
    addProp({ t: 'tower', x: S.LM.watchtower.x, y: S.LM.watchtower.y, s: 1, seed: 7, r: 34 });
    addProp({ t: 'pharmacy', x: S.LM.pharmacy.x, y: S.LM.pharmacy.y, s: 1, seed: 9, r: 60 });
    for (let i = 0; i < 4; i++) {
      addProp({ t: 'fence', x: V.x - 600 + i * 128, y: V.y + 300, s: 1, rot: 0, seed: i, r: 0 });
      addProp({ t: 'fence', x: V.x + 430 + i * 128, y: V.y + 300, s: 1, rot: 0, seed: i + 4, r: 0 });
      addProp({ t: 'fence', x: V.x - 600 + i * 128, y: V.y + 580, s: 1, rot: 0, seed: i + 8, r: 0 });
      addProp({ t: 'fence', x: V.x + 430 + i * 128, y: V.y + 580, s: 1, rot: 0, seed: i + 12, r: 0 });
    }
    // 田垄
    for (let i = 0; i < 5; i++) {
      addProp({ t: 'field', x: V.x + 520, y: V.y + 300 + i * 54, s: 1, seed: i, r: 0 });
      addProp({ t: 'field', x: V.x - 560, y: V.y + 300 + i * 54, s: 1, seed: i + 9, r: 0 });
    }
    // 灯
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const x = V.x - 60 + t * 900, y = V.y + 250 + Math.sin(t * 3) * 60;
      addProp({ t: 'lamp', x, y, s: 1, seed: i, r: 7 });
    }

    /* --- 风蚀碑林 --- */
    const ST = S.LM.stele;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * S.TAU + 0.3;
      const rr = 150 + (i % 3) * 78;
      addProp({ t: 'stele', x: ST.x + Math.cos(a) * rr, y: ST.y + Math.sin(a) * rr * 0.8, s: 0.85 + (i % 4) * 0.09, seed: i, r: 15 });
    }
    addProp({ t: 'steleBig', x: ST.x, y: ST.y - 20, s: 1.35, seed: 99, r: 30 });
    addProp({ t: 'arch', x: ST.x, y: ST.y + 210, s: 1.1, rot: 0, seed: 41, r: 40 });

    /* --- 白露庭遗迹 --- */
    const RU = S.LM.ruins;
    addProp({ t: 'ruinFloor', x: RU.x, y: RU.y, s: 1, seed: 2, r: 0 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * S.TAU;
      addProp({ t: 'column', x: RU.x + Math.cos(a) * 250, y: RU.y + Math.sin(a) * 210, s: 1, seed: i, r: 20, broken: i % 3 === 0 });
    }
    addProp({ t: 'altar', x: RU.x, y: RU.y - 60, s: 1, seed: 11, r: 36 });
    addProp({ t: 'ruinWall', x: RU.x - 330, y: RU.y + 60, s: 1, rot: 0.2, seed: 3, r: 80 });
    addProp({ t: 'ruinWall', x: RU.x + 320, y: RU.y - 40, s: 1, rot: 3.3, seed: 4, r: 80 });
    addProp({ t: 'archBig', x: RU.x, y: RU.y + 330, s: 1, rot: 0, seed: 8, r: 50 });
    for (let i = 0; i < 5; i++) addProp({ t: 'lampBlue', x: RU.x - 200 + i * 100, y: RU.y + 250, s: 1, seed: i, r: 6 });

    /* --- 桥 --- */
    addProp({ t: 'bridgeWood', x: 2760, y: 3060, s: 1, seed: 1, r: 0 });
    addProp({ t: 'bridgeStone', x: 5030, y: 2440, s: 1, seed: 2, r: 0 });
    addProp({ t: 'brokenBridge', x: S.LM.brokenBridge.x, y: S.LM.brokenBridge.y, s: 1, seed: 3, r: 0 });

    /* --- 观星台 --- */
    const OB = S.LM.observatory;
    addProp({ t: 'obsFloor', x: OB.x, y: OB.y, s: 1, seed: 1, r: 0 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * S.TAU;
      addProp({ t: 'obsPillar', x: OB.x + Math.cos(a) * 300, y: OB.y + Math.sin(a) * 260, s: 1, seed: i, r: 24 });
    }
    addProp({ t: 'crystal', x: OB.x, y: OB.y - 10, s: 1, seed: 5, r: 0 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * S.TAU + 0.4;
      addProp({ t: 'shard', x: OB.x + Math.cos(a) * (560 + i * 40), y: OB.y + Math.sin(a) * (480 + i * 30), s: 1 + i * 0.1, seed: i, r: 0 });
    }

    /* --- 陨星坑（起点） --- */
    const CR = S.LM.crater;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * S.TAU;
      addProp({ t: 'shardSmall', x: CR.x + Math.cos(a) * 150, y: CR.y + Math.sin(a) * 120, s: 0.6 + (i % 3) * 0.2, seed: i, r: 6 });
    }
    addProp({ t: 'compass', x: CR.x + 6, y: CR.y + 24, s: 1, seed: 1, r: 0 });

    /* --- 营火/旗 --- */
    addProp({ t: 'campfire', x: 1560, y: 3560, s: 1, seed: 1, r: 12 });
    addProp({ t: 'campfire', x: 3480, y: 2420, s: 1, seed: 2, r: 12 });
    addProp({ t: 'campfire', x: 5600, y: 2760, s: 1, seed: 3, r: 12 });
  }

  /* ---------------- 底图绘制 ---------------- */
  const PAL = {
    A: { dark: [52, 86, 52], mid: [84, 126, 64], light: [132, 170, 84], dry: [72, 106, 56] },
    B: { dark: [42, 78, 66], mid: [62, 104, 88], light: [98, 140, 108], dry: [48, 88, 80] },
    C: { dark: [28, 30, 38], mid: [44, 46, 56], light: [64, 62, 74], dry: [36, 32, 40] }
  };
  function mixArr(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function regionMixColor(x, y, out) {
    const pal = PAL[regionAt(x)];
    const f1 = S.fbm(x * 0.0011 + 20, y * 0.0011 - 5, 4);
    const f2 = S.fbm(x * 0.016 - 3, y * 0.016 + 9, 3);
    const f3 = S.noise(x * 0.075, y * 0.075);
    const f4 = S.noise(x * 0.26 + 11, y * 0.26 - 7);
    const t1 = S.smoothstep(0.30, 0.62, f1);
    const t2 = S.smoothstep(0.56, 0.86, f1) * 0.8;
    let c = mixArr(pal.dark, pal.mid, t1);
    c = mixArr(c, pal.light, t2);
    // 干斑 / 苔斑（细碎，不做大团）
    const dry = S.smoothstep(0.50, 0.92, f2) * 0.42;
    c = mixArr(c, pal.dry, dry);
    const g = (f3 - 0.5) * 14 + (f4 - 0.5) * 9;
    out[0] = c[0] + g;
    out[1] = c[1] + g;
    out[2] = c[2] + g * 0.85;
  }

  function smoothPath(ctx, pts, closed) {
    const p = pts;
    const n = p.length;
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 0; i < n - (closed ? 0 : 1); i++) {
      const p0 = p[(i - 1 + n) % n], p1 = p[i % n], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
      if (!closed && (i === 0 || i === n - 2)) {
        ctx.lineTo(p2[0], p2[1]);
        continue;
      }
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2[0], p2[1]);
    }
    if (closed) ctx.closePath();
  }

  const World = S.World = {
    W, H, BS, OUTLINE, RIVER, CHASM, BRIDGES, props, buckets,
    insideIsland, inRiver, inChasm, onBridge, regionAt, terrainAt, propsInRect, freeSpot,
    distToPolyline, riverW, chasmW,
    base: null,

    build() {
      buildGrid();
      generateProps();
      this.paint();
    },

    /* ---- 主绘制 ---- */
    paint() {
      const cw = Math.round(W * BS), ch = Math.round(H * BS);
      const base = document.createElement('canvas');
      base.width = cw; base.height = ch;
      const g = base.getContext('2d');
      g.imageSmoothingEnabled = true;

      /* 1. 粗糙色彩场（低分辨率 + 平滑放大，得到绘画感） */
      const rough = document.createElement('canvas');
      const rw = 900, rh = 600;
      rough.width = rw; rough.height = rh;
      const rg = rough.getContext('2d');
      const img = rg.createImageData(rw, rh);
      const d = img.data;
      const tmp = [0, 0, 0];
      for (let y = 0; y < rh; y++) {
        const wy = (y / rh) * H;
        for (let x = 0; x < rw; x++) {
          const wx = (x / rw) * W;
          const i = (y * rw + x) * 4;
          if (!insideIsland(wx, wy)) { d[i + 3] = 0; continue; }
          regionMixColor(wx, wy, tmp);
          // 光照：西北方向的伪造高差
          const hgt = S.fbm(wx * 0.0018 + 100, wy * 0.0018 + 50, 3);
          const sh = 0.74 + hgt * 0.52;
          d[i] = Math.min(255, tmp[0] * sh);
          d[i + 1] = Math.min(255, tmp[1] * sh);
          d[i + 2] = Math.min(255, tmp[2] * sh);
          d[i + 3] = 255;
        }
      }
      rg.putImageData(img, 0, 0);
      g.drawImage(rough, 0, 0, cw, ch);

      g.save();
      g.scale(BS, BS);
      g.lineJoin = 'round'; g.lineCap = 'round';

      /* 2. 道路 */
      const drawRoad = (pts, w, dark) => {
        if (dark) {
          g.strokeStyle = 'rgba(10,14,20,0.40)'; g.lineWidth = w + 18;
          smoothPath(g, pts); g.stroke();
          g.strokeStyle = 'rgba(74,80,90,0.42)'; g.lineWidth = w;
          smoothPath(g, pts); g.stroke();
          g.strokeStyle = 'rgba(130,150,170,0.16)'; g.lineWidth = w * 0.42;
          smoothPath(g, pts); g.stroke();
          return;
        }
        g.strokeStyle = 'rgba(92,84,62,0.22)'; g.lineWidth = w + 14;
        smoothPath(g, pts); g.stroke();
        g.strokeStyle = 'rgba(196,174,132,0.66)'; g.lineWidth = w;
        smoothPath(g, pts); g.stroke();
        g.strokeStyle = 'rgba(214,196,160,0.28)'; g.lineWidth = w * 0.42;
        smoothPath(g, pts); g.stroke();
      };
      drawRoad(ROAD_MAIN, 34);
      drawRoad(ROAD_SOUTH, 26);
      drawRoad(ROAD_EAST, 28);
      drawRoad(ROAD_CRATER, 30, true);

      /* 3. 河 */
      const drawRiver = () => {
        for (let pass = 0; pass < 3; pass++) {
          for (let i = 0; i < RIVER.length - 1; i++) {
            const w = riverW(i);
            g.beginPath();
            g.moveTo(RIVER[i][0], RIVER[i][1]);
            g.lineTo(RIVER[i + 1][0], RIVER[i + 1][1]);
            g.lineWidth = w - pass * 22;
            g.strokeStyle = pass === 0 ? 'rgba(74,102,88,0.95)'
              : pass === 1 ? 'rgba(76,128,140,0.92)' : 'rgba(116,176,182,0.55)';
            g.stroke();
          }
        }
        // 深水
        g.globalCompositeOperation = 'source-over';
        for (let i = 0; i < RIVER.length - 1; i++) {
          g.beginPath(); g.moveTo(RIVER[i][0], RIVER[i][1]); g.lineTo(RIVER[i + 1][0], RIVER[i + 1][1]);
          g.lineWidth = riverW(i) * 0.42;
          g.strokeStyle = 'rgba(38,74,86,0.75)';
          g.stroke();
        }
        // 岸边泡沫
        g.strokeStyle = 'rgba(210,236,230,0.30)';
        for (let i = 0; i < RIVER.length - 1; i++) {
          const w = riverW(i) + 4;
          const dx = RIVER[i + 1][0] - RIVER[i][0], dy = RIVER[i + 1][1] - RIVER[i][1];
          const L = Math.hypot(dx, dy) || 1;
          const nx = -dy / L, ny = dx / L;
          for (const sgn of [-1, 1]) {
            g.beginPath();
            g.moveTo(RIVER[i][0] + nx * w * 0.5 * sgn, RIVER[i][1] + ny * w * 0.5 * sgn);
            g.lineTo(RIVER[i + 1][0] + nx * w * 0.5 * sgn, RIVER[i + 1][1] + ny * w * 0.5 * sgn);
            g.lineWidth = 2.4; g.stroke();
          }
        }
      };
      drawRiver();

      /* 4. 断崖 */
      for (let i = 0; i < CHASM.length - 1; i++) {
        g.beginPath(); g.moveTo(CHASM[i][0], CHASM[i][1]); g.lineTo(CHASM[i + 1][0], CHASM[i + 1][1]);
        g.lineWidth = chasmW() + 26; g.strokeStyle = 'rgba(20,24,30,0.55)'; g.stroke();
      }
      for (let i = 0; i < CHASM.length - 1; i++) {
        g.beginPath(); g.moveTo(CHASM[i][0], CHASM[i][1]); g.lineTo(CHASM[i + 1][0], CHASM[i + 1][1]);
        g.lineWidth = chasmW(); g.strokeStyle = '#0a1016'; g.stroke();
      }
      for (let i = 0; i < CHASM.length - 1; i++) {
        g.beginPath(); g.moveTo(CHASM[i][0], CHASM[i][1]); g.lineTo(CHASM[i + 1][0], CHASM[i + 1][1]);
        g.lineWidth = chasmW() * 0.5; g.strokeStyle = 'rgba(26,48,60,0.9)'; g.stroke();
      }
      // 崖边碎岩
      for (let i = 0; i < 400; i++) {
        const t = rnd();
        const seg = Math.min(CHASM.length - 2, Math.floor(t * (CHASM.length - 1)));
        const k = t * (CHASM.length - 1) - seg;
        const x = S.lerp(CHASM[seg][0], CHASM[seg + 1][0], k) + (rnd() - 0.5) * chasmW() * 1.1;
        const y = S.lerp(CHASM[seg][1], CHASM[seg + 1][1], k) + (rnd() - 0.5) * 40;
        g.fillStyle = rnd() > 0.5 ? 'rgba(52,58,64,0.7)' : 'rgba(30,36,42,0.75)';
        g.fillRect(x - 3 - rnd() * 5, y - 2, 6 + rnd() * 10, 4 + rnd() * 4);
      }

      /* 5. 陨星坑（起点） */
      const CR = S.LM.crater;
      // 外圈焦土
      const outer = g.createRadialGradient(CR.x, CR.y, CR.r * 0.5, CR.x, CR.y, CR.r * 1.6);
      outer.addColorStop(0, 'rgba(50,38,30,0.62)');
      outer.addColorStop(0.55, 'rgba(76,58,42,0.30)');
      outer.addColorStop(1, 'rgba(82,64,44,0)');
      g.fillStyle = outer;
      g.beginPath(); g.ellipse(CR.x, CR.y, CR.r * 1.6, CR.r * 1.38, 0, 0, S.TAU); g.fill();
      // 坑体
      const pit = g.createRadialGradient(CR.x - CR.r * 0.22, CR.y - CR.r * 0.2, CR.r * 0.08, CR.x, CR.y, CR.r);
      pit.addColorStop(0, 'rgba(16,12,11,0.98)');
      pit.addColorStop(0.42, 'rgba(36,26,21,0.96)');
      pit.addColorStop(0.80, 'rgba(72,54,38,0.88)');
      pit.addColorStop(1, 'rgba(104,84,58,0.18)');
      g.fillStyle = pit;
      g.beginPath(); g.ellipse(CR.x, CR.y, CR.r, CR.r * 0.86, 0, 0, S.TAU); g.fill();
      // 内壁受光
      g.strokeStyle = 'rgba(166,134,92,0.40)'; g.lineWidth = 12;
      g.beginPath(); g.ellipse(CR.x, CR.y, CR.r * 0.80, CR.r * 0.68, 0, 0.25, 2.55); g.stroke();
      // 放射裂纹
      g.strokeStyle = 'rgba(24,17,13,0.5)'; g.lineWidth = 3;
      for (let i = 0; i < 13; i++) {
        const a = (i / 13) * S.TAU + rnd() * 0.4;
        let rr = CR.r * 0.3;
        g.beginPath();
        g.moveTo(CR.x + Math.cos(a) * rr, CR.y + Math.sin(a) * rr * 0.86);
        for (let k = 0; k < 3; k++) {
          rr += CR.r * (0.22 + rnd() * 0.2);
          const aa = a + (rnd() - 0.5) * 0.25;
          g.lineTo(CR.x + Math.cos(aa) * rr, CR.y + Math.sin(aa) * rr * 0.86);
        }
        g.stroke();
      }
      // 焦块
      for (let i = 0; i < 46; i++) {
        const a = rnd() * S.TAU, rr = CR.r * (0.3 + rnd() * 1.1);
        g.fillStyle = 'rgba(30,22,18,' + (0.3 + rnd() * 0.4).toFixed(2) + ')';
        g.beginPath();
        g.ellipse(CR.x + Math.cos(a) * rr, CR.y + Math.sin(a) * rr * 0.86, 4 + rnd() * 12, 3 + rnd() * 7, rnd() * 3, 0, S.TAU);
        g.fill();
      }
      // 余烬
      for (let i = 0; i < 90; i++) {
        const a = rnd() * S.TAU, rr = 20 + rnd() * CR.r * 1.05;
        g.fillStyle = 'rgba(' + (170 + rnd() * 70 | 0) + ',' + (110 + rnd() * 80 | 0) + ',' + (50 + rnd() * 50 | 0) + ',' + (0.15 + rnd() * 0.45).toFixed(2) + ')';
        g.beginPath(); g.arc(CR.x + Math.cos(a) * rr, CR.y + Math.sin(a) * rr * 0.86, 0.8 + rnd() * 2.4, 0, S.TAU); g.fill();
      }

      /* 6. 村落地面 */
      const V = S.LM.village;
      const vg = g.createRadialGradient(V.x, V.y, 40, V.x, V.y, 560);
      vg.addColorStop(0, 'rgba(168,152,118,0.40)');
      vg.addColorStop(0.6, 'rgba(160,146,114,0.20)');
      vg.addColorStop(1, 'rgba(160,146,112,0)');
      g.fillStyle = vg;
      g.beginPath(); g.ellipse(V.x, V.y, 580, 500, 0, 0, S.TAU); g.fill();
      // 石板广场
      g.save();
      const PY = S.LM.watchtower.y, PX = S.LM.watchtower.x;
      g.fillStyle = 'rgba(116,110,92,0.50)';
      g.beginPath(); g.ellipse(PX, PY, 178, 156, 0, 0, S.TAU); g.fill();
      // 铺砖缝：同心环 + 放射
      g.strokeStyle = 'rgba(70,66,56,0.28)'; g.lineWidth = 2.2;
      for (let ring = 1; ring <= 4; ring++) {
        const rr = ring * 38;
        g.beginPath(); g.ellipse(PX, PY, rr, rr * 0.88, 0, 0, S.TAU); g.stroke();
      }
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * S.TAU + 0.16;
        g.beginPath();
        g.moveTo(PX + Math.cos(a) * 26, PY + Math.sin(a) * 23);
        g.lineTo(PX + Math.cos(a) * 178, PY + Math.sin(a) * 156);
        g.stroke();
      }
      // 外圈石缘
      g.strokeStyle = 'rgba(84,80,66,0.55)'; g.lineWidth = 9;
      g.beginPath(); g.ellipse(PX, PY, 178, 156, 0, 0, S.TAU); g.stroke();
      g.strokeStyle = 'rgba(176,170,148,0.22)'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(PX, PY, 182, 160, 0, 0, S.TAU); g.stroke();
      // 中央石台
      g.fillStyle = 'rgba(132,124,104,0.55)';
      g.beginPath(); g.ellipse(PX, PY, 36, 31, 0, 0, S.TAU); g.fill();
      g.strokeStyle = 'rgba(70,66,56,0.35)'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(PX, PY, 36, 31, 0, 0, S.TAU); g.stroke();
      g.restore();

      /* 7. 遗迹地面 */
      const RU = S.LM.ruins;
      const rg2 = g.createRadialGradient(RU.x, RU.y, 20, RU.x, RU.y, 420);
      rg2.addColorStop(0, 'rgba(206,202,188,0.60)');
      rg2.addColorStop(0.7, 'rgba(188,190,178,0.22)');
      rg2.addColorStop(1, 'rgba(180,186,176,0)');
      g.fillStyle = rg2;
      g.beginPath(); g.ellipse(RU.x, RU.y, 430, 380, 0, 0, S.TAU); g.fill();
      for (let i = 0; i < 90; i++) {
        const a = rnd() * S.TAU, rr = Math.sqrt(rnd()) * 330;
        g.fillStyle = `rgba(${190 + rnd() * 40 | 0},${192 + rnd() * 36 | 0},${182 + rnd() * 30 | 0},0.4)`;
        g.beginPath(); g.ellipse(RU.x + Math.cos(a) * rr, RU.y + Math.sin(a) * rr * 0.85, 10 + rnd() * 18, 7 + rnd() * 10, rnd() * 3, 0, S.TAU); g.fill();
      }

      /* 8. 星陨之庭：巨坑 */
      const OB = S.LM.observatory;
      const bigG = g.createRadialGradient(OB.x, OB.y, 60, OB.x, OB.y, 900);
      bigG.addColorStop(0, 'rgba(16,20,26,0.86)');
      bigG.addColorStop(0.5, 'rgba(24,26,34,0.6)');
      bigG.addColorStop(1, 'rgba(30,30,40,0)');
      g.fillStyle = bigG;
      g.beginPath(); g.ellipse(OB.x, OB.y, 920, 780, 0, 0, S.TAU); g.fill();
      // 环形裂纹
      for (let ring = 0; ring < 5; ring++) {
        const rr = 200 + ring * 130;
        g.beginPath();
        for (let a = 0; a <= 64; a++) {
          const ang = (a / 64) * S.TAU;
          const jitter = S.noise(Math.cos(ang) * 3 + ring * 7, Math.sin(ang) * 3) * 46;
          const x = OB.x + Math.cos(ang) * (rr + jitter), y = OB.y + Math.sin(ang) * (rr + jitter) * 0.86;
          a ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.closePath();
        g.strokeStyle = ring % 2 ? 'rgba(120,180,210,0.16)' : 'rgba(190,120,150,0.13)';
        g.lineWidth = 2 + ring; g.stroke();
      }
      for (let i = 0; i < 120; i++) {
        const a = rnd() * S.TAU, rr = 160 + rnd() * 780;
        g.fillStyle = `rgba(${120 + rnd() * 90 | 0},${200 + rnd() * 50 | 0},${220 + rnd() * 30 | 0},${0.05 + rnd() * 0.2})`;
        g.beginPath(); g.arc(OB.x + Math.cos(a) * rr, OB.y + Math.sin(a) * rr * 0.86, 1 + rnd() * 2.4, 0, S.TAU); g.fill();
      }

      /* 9. 烘焙草簇 */
      this.bakeGrass(g);

      /* 10. 边缘 */
      this.paintRim(g);

      g.restore();
      this.base = base;
      this.baseCtx = g;
    },

    bakeGrass(g) {
      const bucketsC = [
        ['rgba(48,80,42,0.70)', 0.42], ['rgba(72,104,52,0.64)', 0.3],
        ['rgba(132,158,78,0.52)', 0.18], ['rgba(44,74,56,0.56)', 0.1]
      ];
      g.lineWidth = 2.4; g.lineCap = 'round';
      const rand = S.rng(777);
      for (let b = 0; b < bucketsC.length; b++) {
        g.strokeStyle = bucketsC[b][0];
        g.beginPath();
        const n = Math.floor(32000 * bucketsC[b][1]);
        for (let i = 0; i < n; i++) {
          const x = 120 + rand() * (W - 240), y = 120 + rand() * (H - 240);
          if (terrainAt(x, y) !== 0) continue;
          const reg = regionAt(x);
          if (reg !== 'A' && reg !== 'B') continue;
          if (S.dist(x, y, S.LM.village.x, S.LM.village.y) < 300) continue;
          const l = 5 + rand() * 8;
          const lean = (rand() - 0.5) * 5;
          g.moveTo(x, y); g.quadraticCurveTo(x + lean * 0.5, y - l * 0.6, x + lean, y - l);
        }
        g.stroke();
      }
      // 花
      const fl = [['rgba(238,232,206,0.30)', 520], ['rgba(232,190,204,0.26)', 300], ['rgba(222,208,150,0.24)', 380]];
      for (const [col, n] of fl) {
        g.fillStyle = col;
        for (let i = 0; i < n; i++) {
          const x = 150 + rand() * (W - 300), y = 150 + rand() * (H - 300);
          if (terrainAt(x, y) !== 0) continue;
          const reg = regionAt(x);
          if (reg === 'C') continue;
          if (S.dist(x, y, S.LM.village.x, S.LM.village.y) < 380) continue;
          g.beginPath(); g.arc(x, y, 0.7 + rand() * 0.9, 0, S.TAU); g.fill();
        }
      }
    },

    paintRim(g) {
      const pts = OUTLINE;
      // 外投影
      g.save();
      g.beginPath();
      pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
      g.closePath();
      g.shadowColor = 'rgba(20,40,48,0.85)';
      g.shadowBlur = 60;
      g.strokeStyle = 'rgba(30,40,44,1)';
      g.lineWidth = 26;
      g.stroke();
      g.restore();

      // 崖壁
      g.beginPath();
      pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
      g.closePath();
      g.lineWidth = 46; g.strokeStyle = '#3b4650'; g.stroke();
      g.lineWidth = 34; g.strokeStyle = '#4d5a62'; g.stroke();
      g.lineWidth = 14; g.strokeStyle = 'rgba(150,168,170,0.55)'; g.stroke();

      // 崖壁纹理
      const rand = S.rng(4242);
      g.lineCap = 'butt';
      for (let i = 0; i < 1400; i++) {
        const p = pts[(rand() * pts.length) | 0];
        const nx = (p[0] - CX) / RX, ny = (p[1] - CY) / RY;
        const L = Math.hypot(nx, ny) || 1;
        const off = (rand() - 0.55) * 40;
        const x = p[0] + (nx / L) * off, y = p[1] + (ny / L) * off;
        g.strokeStyle = rand() > 0.5 ? 'rgba(24,32,38,0.5)' : 'rgba(140,158,160,0.35)';
        g.lineWidth = 1 + rand() * 3;
        g.beginPath(); g.moveTo(x, y);
        g.lineTo(x + (nx / L) * (4 + rand() * 22), y + (ny / L) * (4 + rand() * 22));
        g.stroke();
      }
      // 内侧柔光
      g.beginPath();
      pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
      g.closePath();
      g.lineWidth = 90; g.strokeStyle = 'rgba(228,236,214,0.06)'; g.stroke();
    }
  };
})();
