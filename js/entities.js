/* =====================================================================
   拾星纪 · 长庚  —  entities.js
   玩家 / 敌人 / NPC / Boss / 粒子特效
   ===================================================================== */
(function () {
  'use strict';
  const S = window.STAR;
  const R = S.Render;

  /* ---------------- 工具 ---------------- */
  function propBlock(x, y, rad) {
    const BK = 320;
    const bx = (x / BK) | 0, by = (y / BK) | 0;
    for (let gy = by - 1; gy <= by + 1; gy++) {
      for (let gx = bx - 1; gx <= bx + 1; gx++) {
        const a = S.World.buckets.get(gx + ',' + gy);
        if (!a) continue;
        for (let i = 0; i < a.length; i++) {
          const p = a[i];
          if (p.r > 0 && p.r < 200) {
            const rr = p.r * 0.62 + rad;
            if (S.dist2(x, y, p.x, p.y) < rr * rr) return true;
          }
        }
      }
    }
    return false;
  }
  function free(x, y, rad) {
    const w = S.World;
    if (w.terrainAt(x, y) !== 0) return false;
    // 四角检测，避免卡边
    const d = rad * 0.7;
    if (w.terrainAt(x - d, y) !== 0 || w.terrainAt(x + d, y) !== 0 ||
        w.terrainAt(x, y - d) !== 0 || w.terrainAt(x, y + d) !== 0) return false;
    return !propBlock(x, y, rad);
  }
  S.free = free;
  S.propBlock = propBlock;

  /* ==========================================================
     粒子 / 特效
     ========================================================== */
  const FX = S.FX = {
    parts: [], vfx: [],
    clear() { this.parts.length = 0; this.vfx.length = 0; },

    spawn(x, y, n, opt) {
      opt = opt || {};
      if (S.QUALITY && S.QUALITY.particles < 1) n = Math.max(1, Math.round(n * S.QUALITY.particles));
      for (let i = 0; i < n; i++) {
        const a = opt.ang !== undefined ? opt.ang + (Math.random() - 0.5) * (opt.spread || 1.2) : Math.random() * S.TAU;
        const sp = (opt.spd || 60) * (0.4 + Math.random() * 0.9);
        this.parts.push({
          x: x + (Math.random() - 0.5) * (opt.jx || 0),
          y: y + (Math.random() - 0.5) * (opt.jy || 0),
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opt.up || 0),
          life: 0, max: (opt.life || 0.7) * (0.6 + Math.random() * 0.8),
          size: (opt.size || 2.4) * (0.6 + Math.random() * 0.9),
          col: Array.isArray(opt.col) ? opt.col[(Math.random() * opt.col.length) | 0] : (opt.col || '#fff'),
          type: opt.type || 'dot',
          grav: opt.grav === undefined ? 0 : opt.grav,
          drag: opt.drag === undefined ? 0.92 : opt.drag,
          rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 8,
          add: opt.add !== false, floor: opt.floor || 0
        });
        if (this.parts.length > 700) this.parts.shift();
      }
    },

    add(v) { this.vfx.push(v); if (this.vfx.length > 80) this.vfx.shift(); },

    slash(x, y, ang, r, col) {
      this.add({ t: 'slash', x, y, ang, r: r || 84, col: col || '#d8fff4', life: 0, max: 0.22 });
    },
    ring(x, y, r0, r1, col, max, w) {
      this.add({ t: 'ring', x, y, r0, r1: r1 || r0 * 2.4, col: col || '#bff6ea', life: 0, max: max || 0.5, w: w || 3 });
    },
    beam(x, y, col, max) {
      this.add({ t: 'beam', x, y, col: col || '#d8fff4', life: 0, max: max || 0.6 });
    },
    burst(x, y, col) {
      this.ring(x, y, 10, 210, col || '#ffe9b0', 0.65, 6);
      this.ring(x, y, 4, 130, '#fff', 0.42, 3);
      this.spawn(x, y, 34, { spd: 320, life: 0.9, size: 3.2, col: [col || '#ffe9b0', '#fff8e0', '#ffd08a'], add: true, drag: 0.9 });
      this.spawn(x, y, 16, { spd: 120, life: 1.4, size: 2, col: ['#bff6ea', '#ffffff'], up: 90, grav: -20 });
    },

    update(dt) {
      const P = this.parts;
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i];
        p.life += dt;
        if (p.life >= p.max) { P.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += p.grav * dt;
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy *= Math.pow(p.drag, dt * 60);
        p.rot += p.spin * dt;
      }
      const V = this.vfx;
      for (let i = V.length - 1; i >= 0; i--) {
        const v = V[i];
        v.life += dt;
        if (v.life >= v.max) V.splice(i, 1);
      }
    },

    drawWarp(g) { /* 预留 */ },

    draw(g, layer) {
      const t = R.t;
      g.save();
      for (const v of this.vfx) {
        const k = v.life / v.max;
        if (layer === 'under' && v.t !== 'ring') continue;
        if (layer === 'over' && v.t === 'ring') continue;
        g.save();
        if (v.t === 'slash') {
          const a = 1 - k;
          const x = R.sx(v.x), y = R.sy(v.y) - 34 * R.Cam.z;
          g.translate(x, y);
          g.rotate(v.ang);
          g.globalCompositeOperation = 'lighter';
          const rr = v.r * R.Cam.z * (0.85 + k * 0.4);
          const gg = g.createLinearGradient(0, 0, rr, 0);
          gg.addColorStop(0, `rgba(255,255,255,0)`);
          gg.addColorStop(0.55, v.col.replace('rgb', 'rgba').replace(')', `,${a * 0.75})`));
          gg.addColorStop(1, `rgba(255,255,255,0)`);
          g.strokeStyle = gg;
          g.lineWidth = 12 * R.Cam.z * a;
          g.beginPath();
          g.arc(0, 0, rr, -0.85, 0.85);
          g.stroke();
          g.strokeStyle = `rgba(255,255,255,${a * 0.55})`;
          g.lineWidth = 2.4 * R.Cam.z * a;
          g.beginPath(); g.arc(0, 0, rr, -0.5, 0.5); g.stroke();
        } else if (v.t === 'ring') {
          const rr = S.lerp(v.r0, v.r1, S.easeOut(k));
          const x = R.sx(v.x), y = R.sy(v.y);
          g.globalCompositeOperation = 'lighter';
          g.strokeStyle = v.col;
          g.globalAlpha = (1 - k) * 0.85;
          g.lineWidth = v.w * R.Cam.z * (1 - k * 0.6);
          g.beginPath(); g.ellipse(x, y, rr * R.Cam.z, rr * R.Cam.z * 0.55, 0, 0, S.TAU); g.stroke();
        } else if (v.t === 'beam') {
          const x = R.sx(v.x), y = R.sy(v.y);
          const a = Math.sin(k * Math.PI);
          g.globalCompositeOperation = 'lighter';
          const lg = g.createLinearGradient(x, y - 500, x, y);
          lg.addColorStop(0, 'rgba(255,255,255,0)');
          lg.addColorStop(1, v.col);
          g.globalAlpha = a * 0.6;
          g.fillStyle = lg;
          g.fillRect(x - 26 * R.Cam.z, y - 500 * R.Cam.z, 52 * R.Cam.z, 500 * R.Cam.z);
        }
        g.restore();
      }
      // 粒子
      for (const p of this.parts) {
        const k = p.life / p.max;
        const a = 1 - k;
        const x = R.sx(p.x), y = R.sy(p.y);
        if (x < -40 || y < -40 || x > R.W + 40 || y > R.H + 40) continue;
        g.globalAlpha = a;
        if (p.add) g.globalCompositeOperation = 'lighter';
        g.fillStyle = p.col;
        if (p.type === 'petal') {
          g.save(); g.translate(x, y); g.rotate(p.rot);
          g.beginPath(); g.ellipse(0, 0, p.size * 1.6, p.size * 0.8, 0, 0, S.TAU); g.fill();
          g.restore();
        } else if (p.type === 'spark') {
          g.strokeStyle = p.col; g.lineWidth = p.size * 0.6;
          g.beginPath(); g.moveTo(x, y);
          g.lineTo(x - p.vx * 0.03, y - p.vy * 0.03); g.stroke();
        } else {
          g.beginPath(); g.arc(x, y, p.size * (0.4 + a * 0.8), 0, S.TAU); g.fill();
        }
        g.globalCompositeOperation = 'source-over';
      }
      g.globalAlpha = 1;
      g.restore();
    }
  };

  /* ==========================================================
     玩家
     ========================================================== */
  const Player = S.Player = class {
    constructor(x, y) {
      this.x = x; this.y = y; this.vx = 0; this.vy = 0;
      this.r = 13;
      this.hp = 120; this.maxhp = 120;
      this.st = 100; this.maxst = 100;
      this.en = 0; this.maxen = 100;
      this.faceX = 0; this.faceY = 1;
      this.dir = 1;
      this.walk = 0; this.walkPhase = 0;
      this.t = 0;
      this.atk = 0; this.atkT = 0; this.combo = 0; this.atkCd = 0;
      this.hurt = 0; this.inv = 0;
      this.dashT = 0; this.dashCd = 0;
      this.skillCd = 0;
      this.dead = false;
      this.stDelay = 0;
      this.hitFlash = 0;
      this.moving = false;
      this.isPlayer = true;
      this.spawnX = x; this.spawnY = y;
    }

    update(dt, game) {
      this.t += dt;
      const In = S.Input;
      let ix = 0, iy = 0;
      const locked = game.locked;
      if (!locked) {
        if (In.down('a')) ix -= 1;
        if (In.down('d')) ix += 1;
        if (In.down('w')) iy -= 1;
        if (In.down('s')) iy += 1;
        if (In.stick && In.stick.active) { ix += In.stick.x; iy += In.stick.y; }
      }
      const mag = Math.hypot(ix, iy);
      this.moveMag = Math.min(1, mag);
      if (mag > 0.001) { ix /= mag; iy /= mag; this.faceX = ix; this.faceY = iy; if (Math.abs(ix) > 0.1) this.dir = ix > 0 ? 1 : -1; }
      this.moving = mag > 0.12;

      // 冲刺
      if (!locked && In.hit('shift') && this.st > 12 && this.dashCd <= 0 && mag > 0) {
        this.dashT = 0.20; this.dashCd = 0.42; this.st -= 18; this.stDelay = 0.7;
        this.dvx = ix; this.dvy = iy;
        FX.spawn(this.x, this.y, 10, { spd: 80, life: 0.45, size: 3, col: ['#cfeae0', '#9fd8cc'], ang: Math.atan2(-iy, -ix), spread: 1.2 });
        S.Audio.sfx('slash');
      }
      this.dashCd = Math.max(0, this.dashCd - dt);
      this.dashT = Math.max(0, this.dashT - dt);

      // 移动
      let speed = 232 * (this.moveMag === undefined ? 1 : this.moveMag);
      if (this.atkCd > 0) speed *= 0.35;
      let mvx = 0, mvy = 0;
      if (this.dashT > 0) {
        mvx = this.dvx * 660; mvy = this.dvy * 660;
      } else if (!locked) {
        mvx = ix * speed; mvy = iy * speed;
      }
      // 平滑
      const acc = 1 - Math.pow(0.0008, dt);
      this.vx += (mvx - this.vx) * acc;
      this.vy += (mvy - this.vy) * acc;
      if (this.dashT > 0 && this.t % 0.02 < dt) {
        FX.spawn(this.x, this.y - 6, 1, { spd: 10, life: 0.5, size: 4, col: ['#9fe6d8'], type: 'dot', drag: 0.85 });
      }

      const nx = this.x + this.vx * dt;
      const ny = this.y + this.vy * dt;
      if (free(nx, this.y, this.r)) this.x = nx; else this.vx *= 0.2;
      if (free(this.x, ny, this.r)) this.y = ny; else this.vy *= 0.2;
      this.x = S.clamp(this.x, 60, S.World.W - 60);
      this.y = S.clamp(this.y, 60, S.World.H - 60);

      this.walkPhase += dt * (Math.hypot(this.vx, this.vy) / 60);
      this.walk = S.clamp(Math.hypot(this.vx, this.vy) / 240, 0, 1);

      // 体力
      this.stDelay = Math.max(0, this.stDelay - dt);
      if (this.stDelay <= 0) this.st = Math.min(this.maxst, this.st + 30 * dt);
      // 能量
      this.en = S.clamp(this.en, 0, this.maxen);

      // 计时器
      this.inv = Math.max(0, this.inv - dt);
      this.hurt = Math.max(0, this.hurt - dt * 3);
      this.atkCd = Math.max(0, this.atkCd - dt);
      this.skillCd = Math.max(0, this.skillCd - dt);
      if (this.atkT > 0) {
        this.atkT -= dt;
        if (this.atkT <= 0) { this.atk = 0; this.atkCd = 0.12; }
      }
      if (this.atk > 0) this.atk = Math.min(1, this.atk + dt * 7);
      else this.atk = Math.max(0, this.atk - dt * 8);

      // 攻击
      if (!locked && (In.hit('j') || (!S.Touch.on && In.mclick)) && this.atkCd <= 0 && this.atk === 0) {
        this.doAttack(game);
      }
      // 技能
      if (!locked && In.hit('e') && this.skillCd <= 0) this.doSkill(game);
      if (!locked && In.hit('q') && this.en >= 100) this.doBurst(game);
    }

    /* 自动索敌：优先正前方锥形内最近的敌人；贴身时无视朝向 */
    aimAt(game, range, maxAng) {
      let best = null, bd = 1e9;
      const fx = this.faceX, fy = this.faceY;
      const base = Math.atan2(fy, fx);
      for (const e of game.enemies) {
        if (e.dead) continue;
        const d = S.dist(this.x, this.y, e.x, e.y);
        if (d > range + e.r) continue;
        let da = Math.atan2(e.y - this.y, e.x - this.x) - base;
        while (da > Math.PI) da -= S.TAU;
        while (da < -Math.PI) da += S.TAU;
        if (Math.abs(da) > maxAng && d > 52) continue;
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const a = Math.atan2(best.y - this.y, best.x - this.x);
        this.faceX = Math.cos(a); this.faceY = Math.sin(a);
        if (this.faceX > 0.12) this.dir = 1; else if (this.faceX < -0.12) this.dir = -1;
        this.lockTarget = best;
        this.lockT = 0.5;
        return a;
      }
      return base;
    }

    doAttack(game) {
      this.combo = (this.combo + 1) % 3;
      const dmg = [17, 17, 28][this.combo];
      const range = [98, 102, 120][this.combo];
      const arc = [1.75, 1.85, 2.35][this.combo];
      this.atkT = 0.26; this.atk = 0.01; this.atkCd = 0.10;
      const ang = this.aimAt(game, range + 24, 1.45);
      FX.slash(this.x + this.faceX * 40, this.y + this.faceY * 26, ang, range * 0.95,
        this.combo === 2 ? '#ffe9b0' : '#d8fff4');
      if (this.combo === 2) {
        FX.spawn(this.x + this.faceX * 60, this.y + this.faceY * 40, 12, {
          spd: 180, life: 0.4, size: 2.6, col: ['#ffe9b0', '#fff'], ang, spread: 1.0
        });
        R.Cam.kick(3);
      }
      S.Audio.sfx('slash');
      // 判定
      game.hitEnemies(this, this.x + this.faceX * 30, this.y + this.faceY * 20, range, dmg, ang, arc, 120);
      // 草
      FX.spawn(this.x + this.faceX * 50, this.y + this.faceY * 30, 5, {
        spd: 90, life: 0.45, size: 2, col: ['#cfe0b0'], ang, spread: 1.4, type: 'petal'
      });
    }

    doSkill(game) {
      this.skillCd = 6.5;
      this.stDelay = 1;
      S.Audio.sfx('skill');
      const ang = this.aimAt(game, 190, 1.9);
      FX.ring(this.x, this.y, 20, 190, '#bff6ea', 0.55, 5);
      FX.spawn(this.x, this.y, 24, { spd: 260, life: 0.6, size: 3, col: ['#c9fff0', '#8fe6d4', '#fff'], ang, spread: 2.4 });
      R.Cam.kick(6);
      game.hitEnemies(this, this.x + this.faceX * 60, this.y + this.faceY * 36, 170, 46, ang, 2.6, 340);
      game.shockwave(this.x, this.y, 190);
    }

    doBurst(game) {
      this.en = 0;
      S.Audio.sfx('burst');
      R.flash = 0.55; R.flashColor = 'rgba(255,240,200,1)';
      R.Cam.kick(16);
      game.slowmo(0.55, 0.25);
      const x = this.x, y = this.y;
      for (let i = 0; i < 3; i++) setTimeout(() => {}, 0);
      FX.burst(x, y, '#ffe9b0');
      FX.beam(x, y, 'rgba(255,240,200,0.8)', 0.5);
      game.hitEnemies(this, x, y, 260, 130, 0, S.TAU, 500);
      game.shockwave(x, y, 260);
      // 星落
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * S.TAU + Math.random();
        const dd = 90 + Math.random() * 150;
        game.delayedStars.push({ x: x + Math.cos(a) * dd, y: y + Math.sin(a) * dd, t: 0.12 + i * 0.06 });
      }
    }

    damage(v, game, srcX, srcY) {
      if (this.inv > 0 || this.dead) return;
      if (game && game.locked) return;
      this.hp -= v;
      this.inv = 0.75;
      this.hurt = 1;
      R.Cam.kick(9);
      R.flash = 0.12; R.flashColor = 'rgba(180,40,50,1)';
      S.Audio.sfx('hurt');
      game.hitstop = 0.06;
      FX.spawn(this.x, this.y - 30, 14, { spd: 150, life: 0.5, size: 3, col: ['#e8607a', '#ffd0d8'] });
      if (srcX !== undefined) {
        const a = Math.atan2(this.y - srcY, this.x - srcX);
        this.vx += Math.cos(a) * 260; this.vy += Math.sin(a) * 260;
      }
      if (this.hp <= 0) this.die(game);
    }

    die(game) {
      this.hp = 0; this.dead = true;
      S.Audio.sfx('death');
      R.Cam.kick(20);
      game.onPlayerDown();
    }

    drawShadow(g) {
      R.shadow(g, this.x, this.y, 15, 6.5, 0.26);
    }

    draw(g, game) {
      const x = R.sx(this.x), y = R.sy(this.y);
      const scale = 0.92 * R.Cam.z * (1 + this.atk * 0.03);
      g.save();
      if (this.inv > 0 && Math.floor(this.t * 22) % 2 === 0) g.globalAlpha = 0.55;
      R.drawHuman(g, 'xu', x, y, scale, {
        t: this.t, walk: this.walk, dir: this.dir,
        atk: this.atk, hurt: this.hurt, seed: 0
      });
      g.restore();
      // 脚下光环
      if (this.dashT > 0 || this.atk > 0.2) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        const gg = g.createRadialGradient(x, y, 2, x, y, 42);
        gg.addColorStop(0, 'rgba(160,240,230,0.28)');
        gg.addColorStop(1, 'rgba(160,240,230,0)');
        g.fillStyle = gg;
        g.beginPath(); g.ellipse(x, y, 42, 18, 0, 0, S.TAU); g.fill();
        g.restore();
      }
    }
  };

  /* ==========================================================
     敌人基类
     ========================================================== */
  class Enemy {
    constructor(x, y, hp, r) {
      this.x = x; this.y = y; this.hx = x; this.hy = y;
      this.hp = hp; this.maxhp = hp; this.r = r || 16;
      this.vx = 0; this.vy = 0;
      this.t = Math.random() * 10;
      this.state = 'idle'; this.stT = 0;
      this.dir = 1; this.walk = 0; this.hurt = 0; this.dead = false;
      this.hitT = 0; this.windup = 0; this.actionCd = 1 + Math.random();
      this.aggro = 360; this.deatht = 0; this.isEnemy = true;
      this.showHp = 0; this.wanderA = Math.random() * S.TAU;
    }
    get alive() { return !this.dead; }
    faceTo(x, y) { this.dir = x > this.x ? 1 : -1; }
    knock(ang, force) {
      this.vx += Math.cos(ang) * force;
      this.vy += Math.sin(ang) * force * 0.6;
    }
    hurtBy(dmg, ang, game, crit) {
      this.hp -= dmg;
      this.hurt = 1; this.hitT = 0.22; this.showHp = 2.2;
      R.Cam.kick(crit ? 7 : 3.4);
      S.Audio.sfx('hit');
      if (!crit) this.knock(ang, 130);
      FX.spawn(this.x, this.y - 28, crit ? 14 : 8, {
        spd: 200, life: 0.42, size: 2.6, col: ['#fff3d4', '#ffd08a', '#ffffff'], ang: ang + Math.PI, spread: 1.4
      });
      S.HUD.dmg(this.x, this.y - 46, dmg, crit);
      if (this.hp <= 0 && !this.dead) this.onDeath(game);
    }
    onDeath(game) {
      this.dead = true; this.deatht = 0.6;
      FX.spawn(this.x, this.y - 24, 26, { spd: 190, life: 0.9, size: 3, col: ['#2a2f38', '#6d7f8a', '#c9d8dd'], up: 30, grav: 40 });
      FX.ring(this.x, this.y, 10, 110, 'rgba(180,220,230,0.6)', 0.5, 3);
      S.Audio.sfx('death');
      game.onEnemyDeath(this);
    }
    update(dt, game) {
      this.t += dt;
      this.hurt = Math.max(0, this.hurt - dt * 3);
      this.hitT = Math.max(0, this.hitT - dt);
      this.showHp = Math.max(0, this.showHp - dt);
      if (this.dead) { this.deatht -= dt; return; }
      this.walk = S.clamp(Math.hypot(this.vx, this.vy) / 180, 0, 1);
      this.ai(dt, game);
      // 物理
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= Math.pow(0.0016, dt);
      this.vy *= Math.pow(0.0016, dt);
      const p = game.player;
      const dd = S.dist(this.x, this.y, p.x, p.y);
      const minD = this.r + p.r - 6;
      if (dd < minD && dd > 0.1) {
        const a = Math.atan2(this.y - p.y, this.x - p.x);
        this.x = p.x + Math.cos(a) * minD;
        this.y = p.y + Math.sin(a) * minD;
      }
    }
    ai(dt, game) { }
    drawShadow(g) { R.shadow(g, this.x, this.y, this.r * 1.1, this.r * 0.5, 0.24); }
    drawHpBar(g) {
      if (this.showHp <= 0 || this.hp >= this.maxhp) return;
      const x = R.sx(this.x), y = R.sy(this.y) - 62 * R.Cam.z;
      const w = 46 * R.Cam.z;
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(x - w / 2, y, w, 3.4);
      g.fillStyle = '#e8778c';
      g.fillRect(x - w / 2, y, w * S.clamp(this.hp / this.maxhp, 0, 1), 3.4);
    }
  }

  /* --- 失名兽 --- */
  class Beast extends Enemy {
    constructor(x, y) {
      super(x, y, 78, 17);
      this.bob = Math.random() * 6.28;
      this.wanderA = Math.random() * S.TAU;
      this.aggro = 340;
    }
    ai(dt, game) {
      const p = game.player;
      const d = S.dist(this.x, this.y, p.x, p.y);
      this.actionCd -= dt;
      if (this.state === 'idle') {
        this.wanderA += (Math.random() - 0.5) * dt * 3;
        this.vx += Math.cos(this.wanderA) * 22 * dt * 60;
        this.vy += Math.sin(this.wanderA) * 22 * dt * 60;
        if (d < this.aggro) this.setState('chase');
      } else if (this.state === 'chase') {
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        this.vx += Math.cos(a) * 400 * dt;
        this.vy += Math.sin(a) * 400 * dt;
        this.faceTo(p.x, p.y);
        if (d < 120 && this.actionCd <= 0) this.setState('windup');
        if (d > this.aggro * 1.8) this.setState('idle');
      } else if (this.state === 'windup') {
        this.stT += dt;
        this.vx *= 0.7; this.vy *= 0.7;
        if (this.stT > 0.48) {
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          this.vx = Math.cos(a) * 620; this.vy = Math.sin(a) * 620;
          this.setState('lunge');
          S.Audio.sfx('slash');
        }
      } else if (this.state === 'lunge') {
        this.stT += dt;
        this.vx *= Math.pow(0.02, dt);
        this.vy *= Math.pow(0.02, dt);
        if (d < this.r + p.r + 12) { p.damage(9, game, this.x, this.y); this.setState('recover'); }
        if (this.stT > 0.42) this.setState('recover');
      } else if (this.state === 'recover') {
        this.stT += dt;
        if (this.stT > 0.55) { this.actionCd = 1.4; this.setState('chase'); }
      }
    }
    setState(s) { this.state = s; this.stT = 0; }
    draw(g, game) {
      const x = R.sx(this.x), y = R.sy(this.y);
      const z = R.Cam.z;
      const bob = Math.sin(this.t * 2.4 + this.bob) * 4;
      const wind = this.state === 'windup' ? (1 + this.stT * 0.7) : 1;
      g.save();
      g.translate(x, y - 26 * z + bob);
      g.scale(z * this.dir, z);
      if (this.hurt > 0.2) g.globalAlpha = 0.7 + Math.sin(this.t * 40) * 0.2;

      // 墨影
      const grd = g.createRadialGradient(0, 0, 4, 0, 0, 40 * wind);
      grd.addColorStop(0, 'rgba(26,32,40,0.95)');
      grd.addColorStop(0.6, 'rgba(38,48,58,0.75)');
      grd.addColorStop(1, 'rgba(30,40,50,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(0, 0, 34 * wind, 0, S.TAU); g.fill();

      // 触须
      g.strokeStyle = 'rgba(20,26,34,0.85)';
      g.lineWidth = 3.4; g.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * S.TAU + this.t * 0.5;
        const len = 26 + Math.sin(this.t * 2 + i) * 9;
        g.beginPath();
        g.moveTo(Math.cos(a) * 10, Math.sin(a) * 6);
        g.quadraticCurveTo(Math.cos(a) * len * 0.7, Math.sin(a) * len * 0.5 + 8,
          Math.cos(a) * len, Math.sin(a) * len * 0.6 + 14);
        g.stroke();
      }
      // 面具碎片
      g.fillStyle = 'rgba(240,238,228,0.92)';
      g.beginPath();
      g.moveTo(-11, -6); g.quadraticCurveTo(-4, -18, 10, -8);
      g.quadraticCurveTo(6, 8, -4, 7); g.closePath(); g.fill();
      g.fillStyle = 'rgba(20,24,30,0.85)';
      g.beginPath(); g.ellipse(-2, -4, 2.2, 3.2, 0, 0, S.TAU); g.fill();
      g.beginPath(); g.ellipse(6, -3, 2, 2.8, 0, 0, S.TAU); g.fill();
      // 眼里的光
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(180,240,255,0.9)';
      g.beginPath(); g.arc(-2, -4, 1.6, 0, S.TAU); g.fill();
      g.beginPath(); g.arc(6, -3, 1.4, 0, S.TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
      // 蓄力
      if (this.state === 'windup') {
        g.strokeStyle = `rgba(255,120,140,${0.3 + Math.sin(this.t * 30) * 0.2})`;
        g.lineWidth = 1.6;
        g.beginPath(); g.arc(0, 0, 30 + this.stT * 30, 0, S.TAU); g.stroke();
      }
      g.restore();
      this.drawHpBar(g);
    }
  }

  /* --- 无名者 --- */
  class Shade extends Enemy {
    constructor(x, y) {
      super(x, y, 120, 15);
      this.aggro = 420;
      this.atkCd = 1;
    }
    ai(dt, game) {
      const p = game.player;
      const d = S.dist(this.x, this.y, p.x, p.y);
      this.actionCd -= dt;
      if (this.state === 'idle') {
        if (d < this.aggro) this.setState('chase');
        this.vx *= 0.9; this.vy *= 0.9;
      } else if (this.state === 'chase') {
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        const spd = d > 70 ? 240 : 0;
        this.vx += Math.cos(a) * spd * dt * 2.4;
        this.vy += Math.sin(a) * spd * dt * 2.4;
        this.faceTo(p.x, p.y);
        if (d < 100 && this.actionCd <= 0) { this.setState('windup'); S.Audio.sfx('ui'); }
      } else if (this.state === 'windup') {
        this.stT += dt; this.vx *= 0.8; this.vy *= 0.8;
        if (this.stT > 0.62) {
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          this.vx = Math.cos(a) * 420; this.vy = Math.sin(a) * 420;
          this.setState('dash');
          FX.slash(this.x, this.y - 20, a, 60, '#c8d8e0');
          S.Audio.sfx('slash');
        }
      } else if (this.state === 'dash') {
        this.stT += dt;
        this.vx *= Math.pow(0.03, dt); this.vy *= Math.pow(0.03, dt);
        if (d < this.r + p.r + 14) { p.damage(12, game, this.x, this.y); this.setState('recover'); }
        if (this.stT > 0.3) this.setState('recover');
      } else if (this.state === 'recover') {
        this.stT += dt;
        if (this.stT > 0.8) { this.actionCd = 1.6; this.setState('chase'); }
      }
    }
    setState(s) { this.state = s; this.stT = 0; }
    draw(g, game) {
      const x = R.sx(this.x), y = R.sy(this.y);
      const z = R.Cam.z;
      g.save();
      if (this.hurt > 0.2) g.globalAlpha = 0.7;
      // 阴影身体
      g.fillStyle = 'rgba(24,30,38,0.92)';
      g.beginPath();
      g.moveTo(x - 14 * z, y);
      g.quadraticCurveTo(x - 10 * z, y - 52 * z, x, y - 58 * z);
      g.quadraticCurveTo(x + 10 * z, y - 52 * z, x + 14 * z, y);
      g.closePath(); g.fill();
      // 面具
      g.fillStyle = 'rgba(238,236,226,0.92)';
      g.beginPath();
      g.ellipse(x + this.dir * 2 * z, y - 54 * z, 9 * z, 11 * z, 0, 0, S.TAU); g.fill();
      g.fillStyle = 'rgba(24,28,34,0.9)';
      g.beginPath(); g.ellipse(x - 2 * z, y - 55 * z, 1.8 * z, 2.6 * z, 0, 0, S.TAU); g.fill();
      g.beginPath(); g.ellipse(x + 5 * z, y - 55 * z, 1.8 * z, 2.6 * z, 0, 0, S.TAU); g.fill();
      // 剑
      g.strokeStyle = 'rgba(190,210,220,0.7)'; g.lineWidth = 2.4 * z;
      g.beginPath();
      g.moveTo(x + this.dir * 10 * z, y - 36 * z);
      g.lineTo(x + this.dir * 30 * z, y - 10 * z);
      g.stroke();
      // 蓄力红光
      if (this.state === 'windup') {
        g.strokeStyle = `rgba(255,110,130,${0.4 * this.stT})`;
        g.lineWidth = 2 * z;
        g.beginPath(); g.arc(x, y - 30 * z, 30 * z, 0, S.TAU); g.stroke();
      }
      g.restore();
      this.drawHpBar(g);
    }
  }

  /* --- 岚（切磋） --- */
  class DuelLan extends Enemy {
    constructor(x, y) {
      super(x, y, 220, 16);
      this.aggro = 900;
      this.isLan = true;
      this.actionCd = 0.8;
      this.phase2 = false;
    }
    ai(dt, game) {
      const p = game.player;
      const d = S.dist(this.x, this.y, p.x, p.y);
      this.actionCd -= dt;
      if (this.state === 'idle') { this.faceTo(p.x, p.y); if (d < 320) this.setState('approach'); }
      else if (this.state === 'approach') {
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        if (d > 76) { this.vx += Math.cos(a) * 300 * dt * 2; this.vy += Math.sin(a) * 300 * dt * 2; }
        this.faceTo(p.x, p.y);
        if (d < 100 && this.actionCd <= 0) { this.setState('windup'); }
      } else if (this.state === 'windup') {
        this.stT += dt; this.vx *= 0.85; this.vy *= 0.85;
        if (this.stT > 0.42) {
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          this.vx = Math.cos(a) * 520; this.vy = Math.sin(a) * 520;
          this.setState('dash');
          FX.slash(this.x, this.y - 30, a, 96, '#ffe9b0');
          S.Audio.sfx('slash');
        }
      } else if (this.state === 'dash') {
        this.stT += dt;
        this.vx *= Math.pow(0.04, dt); this.vy *= Math.pow(0.04, dt);
        if (d < 74 && !this.hitDone) {
          p.damage(6, game, this.x, this.y);
          this.hitDone = true;
        }
        if (this.stT > 0.26) { this.hitDone = false; this.setState('recover'); }
      } else if (this.state === 'recover') {
        this.stT += dt;
        if (this.stT > 0.7) { this.actionCd = 1.1; this.setState('approach'); }
      }
    }
    setState(s) { this.state = s; this.stT = 0; }
    onDeath(game) {
      this.dead = true; this.deatht = 0;
      game.onLanYield && game.onLanYield();
    }
    draw(g, game) {
      const x = R.sx(this.x), y = R.sy(this.y);
      g.save();
      R.drawHuman(g, 'lan', x, y, R.Cam.z, {
        t: this.t, walk: this.walk, dir: this.dir, atk: this.state === 'dash' ? 0.9 : this.state === 'windup' ? 0.3 : 0, hurt: this.hurt
      });
      g.restore();
      if (this.state === 'windup') {
        g.save();
        g.globalCompositeOperation = 'lighter';
        const gg = g.createRadialGradient(x, y - 30, 4, x, y - 30, 60);
        gg.addColorStop(0, 'rgba(255,230,160,0.28)');
        gg.addColorStop(1, 'rgba(255,230,160,0)');
        g.fillStyle = gg; g.beginPath(); g.arc(x, y - 30, 60, 0, S.TAU); g.fill();
        g.restore();
      }
      this.drawHpBar(g);
    }
  }

  /* --- Boss 1：蚀名之影 --- */
  class BossShadow extends Enemy {
    constructor(x, y) {
      super(x, y, 1150, 40);
      this.boss = true; this.name = '蚀名之影';
      this.phase = 1;
      this.aggro = 9999;
      this.tele = 0;
      this.state = 'wait';
      this.actionCd = 1.2;
      this.volley = 0;
    }
    ai(dt, game) {
      const p = game.player;
      const d = S.dist(this.x, this.y, p.x, p.y);
      this.actionCd -= dt;
      if (this.hp < this.maxhp * 0.6 && this.phase === 1) { this.phase = 2; game.bossPhase(this, 2); }
      if (this.hp < this.maxhp * 0.28 && this.phase === 2) { this.phase = 3; game.bossPhase(this, 3); }

      if (this.state === 'wait') {
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        this.vx += Math.cos(a) * 150 * dt * 2;
        this.vy += Math.sin(a) * 150 * dt * 2;
        this.faceTo(p.x, p.y);
        if (this.actionCd <= 0) {
          const r = Math.random();
          if (this.phase >= 3 && r < 0.4) this.setState('slam');
          else if (this.phase >= 2 && r < 0.7) this.setState('volley');
          else if (r < 0.8) this.setState('tele');
          else this.setState('sweep');
        }
      } else if (this.state === 'tele') {
        this.stT += dt;
        this.vx *= 0.9; this.vy *= 0.9;
        if (this.stT > 0.55) {
          // 瞬移到玩家附近
          FX.spawn(this.x, this.y - 30, 20, { spd: 160, life: 0.5, size: 3, col: ['#1a2028', '#4a5a6a'] });
          const a = Math.random() * S.TAU;
          const nx = p.x + Math.cos(a) * 110, ny = p.y + Math.sin(a) * 90;
          if (S.free(nx, ny, this.r)) { this.x = nx; this.y = ny; }
          FX.spawn(this.x, this.y - 30, 14, { spd: 90, life: 0.5, size: 3, col: ['#8fd8ff'] });
          this.setState('sweep');
        }
      } else if (this.state === 'sweep') {
        this.stT += dt;
        if (this.stT > 0.22 && !this.hitDone) {
          this.hitDone = true;
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          FX.slash(this.x, this.y - 34, a, 150, '#a8d8ff');
          FX.slash(this.x, this.y - 34, a + 2.2, 150, '#a8d8ff');
          R.Cam.kick(5);
          if (d < 170) p.damage(16, game, this.x, this.y);
          S.Audio.sfx('slash');
        }
        if (this.stT > 0.7) { this.hitDone = false; this.actionCd = 1.1; this.setState('wait'); }
      } else if (this.state === 'volley') {
        this.stT += dt;
        this.vx *= 0.9; this.vy *= 0.9;
        if (this.stT > 0.4 && this.volley < 3) {
          this.volley++;
          const base = Math.atan2(p.y - this.y, p.x - this.x);
          for (let i = -2; i <= 2; i++) {
            game.projectiles.push(new InkBolt(this.x, this.y - 30, base + i * 0.22, 320, 10));
          }
          S.Audio.sfx('skill');
          this.stT = 0.1;
        }
        if (this.volley >= 3 && this.stT > 0.6) { this.volley = 0; this.actionCd = 1.5; this.setState('wait'); }
      } else if (this.state === 'slam') {
        this.stT += dt;
        this.vx *= 0.9; this.vy *= 0.9;
        if (this.stT > 0.9 && !this.hitDone) {
          this.hitDone = true;
          R.Cam.kick(14);
          S.Audio.sfx('burst');
          FX.ring(this.x, this.y, 20, 380, 'rgba(150,200,255,0.8)', 0.7, 8);
          FX.spawn(this.x, this.y, 30, { spd: 300, life: 0.7, size: 3.6, col: ['#2a3440', '#8fd8ff'] });
          if (d < 260) p.damage(22, game, this.x, this.y);
          game.shockwave(this.x, this.y, 300);
        }
        if (this.stT > 1.4) { this.hitDone = false; this.actionCd = 1.3; this.setState('wait'); }
      }
      if (this.state === 'wait' && this.actionCd <= 0) { }
    }
    setState(s) { this.state = s; this.stT = 0; }
    onDeath(game) {
      this.dead = true;
      game.onBoss1Dead();
      FX.burst(this.x, this.y - 20, '#c8e8ff');
      R.flash = 0.6; R.flashColor = 'rgba(200,240,255,1)';
      R.Cam.kick(22);
      S.Audio.sfx('burst');
    }
    draw(g, game) {
      const x = R.sx(this.x), y = R.sy(this.y);
      const z = R.Cam.z;
      const bob = Math.sin(this.t * 1.6) * 6;
      g.save();
      g.translate(x, y - 70 * z + bob);
      // 外晕
      const hg = g.createRadialGradient(0, 0, 24, 0, 0, 150);
      hg.addColorStop(0, 'rgba(74,104,160,0.34)');
      hg.addColorStop(0.6, 'rgba(58,80,130,0.14)');
      hg.addColorStop(1, 'rgba(58,80,130,0)');
      g.fillStyle = hg;
      g.beginPath(); g.arc(0, 0, 150, 0, S.TAU); g.fill();
      // 影身
      const grd = g.createRadialGradient(0, 0, 10, 0, 0, 110);
      grd.addColorStop(0, 'rgba(14,18,26,0.98)');
      grd.addColorStop(0.55, 'rgba(26,34,46,0.85)');
      grd.addColorStop(1, 'rgba(20,28,38,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(0, 0, 108, 0, S.TAU); g.fill();
      // 边缘光
      g.strokeStyle = 'rgba(150,220,255,0.22)'; g.lineWidth = 2.4;
      g.beginPath(); g.arc(0, 0, 100, -2.7, -0.4); g.stroke();
      // 触手
      g.strokeStyle = 'rgba(6,9,14,0.92)'; g.lineCap = 'round';
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * S.TAU + this.t * 0.35;
        const L = 70 + Math.sin(this.t * 1.3 + i) * 26;
        g.lineWidth = 5 - (i % 3);
        g.beginPath();
        g.moveTo(Math.cos(a) * 26, Math.sin(a) * 20);
        g.quadraticCurveTo(Math.cos(a) * L * 0.6, Math.sin(a) * L * 0.5,
          Math.cos(a) * L, Math.sin(a) * L * 0.7 + 40);
        g.stroke();
      }
      // 大面具
      const mg = g.createLinearGradient(-34, -66, 34, 46);
      mg.addColorStop(0, 'rgba(250,248,240,0.98)');
      mg.addColorStop(0.6, 'rgba(226,224,212,0.98)');
      mg.addColorStop(1, 'rgba(170,172,164,0.98)');
      g.fillStyle = mg;
      g.beginPath();
      g.moveTo(-33, -12);
      g.quadraticCurveTo(-30, -56, 0, -66);
      g.quadraticCurveTo(30, -56, 33, -12);
      g.quadraticCurveTo(25, 28, 0, 50);
      g.quadraticCurveTo(-25, 28, -33, -12);
      g.closePath(); g.fill();
      // 裂隙
      g.strokeStyle = 'rgba(48,58,66,0.45)'; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(-8, -62); g.lineTo(-2, -26); g.lineTo(-13, 2); g.lineTo(-3, 30); g.stroke();
      g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(19, -44); g.lineTo(9, -18); g.lineTo(17, 8); g.stroke();
      // 渗墨
      g.fillStyle = 'rgba(14,18,24,0.55)';
      for (let i = 0; i < 5; i++) {
        const dx = -26 + i * 13 + Math.sin(this.t + i) * 2;
        g.beginPath();
        g.ellipse(dx, 46 + (i % 3) * 6, 3.4, 9 + (i % 3) * 5, 0.1, 0, S.TAU);
        g.fill();
      }
      // 眼窝
      g.fillStyle = 'rgba(8,12,18,0.92)';
      g.beginPath(); g.ellipse(-13.5, -14, 6.4, 10.5, 0.12, 0, S.TAU); g.fill();
      g.beginPath(); g.ellipse(13.5, -14, 6.4, 10.5, -0.12, 0, S.TAU); g.fill();
      g.save();
      g.globalCompositeOperation = 'lighter';
      const eg = g.createRadialGradient(0, -14, 1, 0, -14, 40);
      eg.addColorStop(0, `rgba(140,220,255,${0.5 + Math.sin(this.t * 3) * 0.2})`);
      eg.addColorStop(1, 'rgba(140,220,255,0)');
      g.fillStyle = eg; g.beginPath(); g.arc(0, -14, 40, 0, S.TAU); g.fill();
      g.restore();
      g.fillStyle = 'rgba(190,240,255,0.95)';
      g.beginPath(); g.ellipse(-13.5, -14, 3.2, 5, 0.12, 0, S.TAU); g.fill();
      g.beginPath(); g.ellipse(13.5, -14, 3.2, 5, -0.12, 0, S.TAU); g.fill();
      g.restore();

      // 蓄力提示
      if (this.state === 'tele' || this.state === 'slam') {
        const k = S.clamp(this.stT / (this.state === 'tele' ? 0.55 : 0.9), 0, 1);
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = `rgba(150,220,255,${0.25 + k * 0.5})`;
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(x, y, (this.state === 'slam' ? 260 : 90) * k * z, (this.state === 'slam' ? 260 : 90) * k * z * 0.55, 0, 0, S.TAU);
        g.stroke();
        g.restore();
      }
      this.drawHpBar(g);
    }
  }

  /* --- 墨弹 --- */
  class InkBolt {
    constructor(x, y, ang, spd, dmg) {
      this.x = x; this.y = y; this.vx = Math.cos(ang) * spd; this.vy = Math.sin(ang) * spd;
      this.dmg = dmg; this.life = 0; this.max = 3.2; this.r = 12; this.dead = false;
      this.trail = [];
    }
    update(dt, game) {
      this.life += dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.trail.push([this.x, this.y]);
      if (this.trail.length > 8) this.trail.shift();
      if (this.life > this.max) this.dead = true;
      const p = game.player;
      if (S.dist2(this.x, this.y, p.x, p.y) < (this.r + p.r) * (this.r + p.r)) {
        p.damage(this.dmg, game, this.x, this.y);
        this.dead = true;
        FX.spawn(this.x, this.y, 10, { spd: 130, life: 0.4, size: 2.6, col: ['#20303c', '#7fd8ff'] });
      }
      if (S.World.terrainAt(this.x, this.y) !== 0) {
        this.dead = true;
        FX.spawn(this.x, this.y, 8, { spd: 90, life: 0.4, size: 2.4, col: ['#20303c', '#7fd8ff'] });
      }
    }
    draw(g) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.trail.length; i++) {
        const k = i / this.trail.length;
        g.fillStyle = `rgba(110,200,255,${k * 0.4})`;
        g.beginPath();
        g.arc(R.sx(this.trail[i][0]), R.sy(this.trail[i][1]) - 26 * R.Cam.z, 6 * k * R.Cam.z, 0, S.TAU);
        g.fill();
      }
      const x = R.sx(this.x), y = R.sy(this.y) - 26 * R.Cam.z;
      const gg = g.createRadialGradient(x, y, 1, x, y, 18 * R.Cam.z);
      gg.addColorStop(0, 'rgba(230,250,255,0.95)');
      gg.addColorStop(0.5, 'rgba(120,200,255,0.6)');
      gg.addColorStop(1, 'rgba(120,200,255,0)');
      g.fillStyle = gg; g.beginPath(); g.arc(x, y, 18 * R.Cam.z, 0, S.TAU); g.fill();
      g.restore();
    }
  }

  /* --- Boss 2：白露 --- */
  class BossBailu extends Enemy {
    constructor(x, y) {
      super(x, y, 1320, 18);
      this.boss = true; this.name = '白露';
      this.phase = 1; this.aggro = 9999;
      this.state = 'wait'; this.actionCd = 1.4;
      this.ringCount = 0;
    }
    ai(dt, game) {
      const p = game.player;
      const d = S.dist(this.x, this.y, p.x, p.y);
      this.actionCd -= dt;
      if (this.hp < this.maxhp * 0.62 && this.phase === 1) { this.phase = 2; game.bossPhase(this, 2); }
      if (this.hp < this.maxhp * 0.3 && this.phase === 2) { this.phase = 3; game.bossPhase(this, 3); }
      this.faceTo(p.x, p.y);

      if (this.state === 'wait') {
        // 缓慢漂浮
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        if (d > 300) { this.vx += Math.cos(a) * 120 * dt * 2; this.vy += Math.sin(a) * 120 * dt * 2; }
        else if (d < 200) { this.vx -= Math.cos(a) * 100 * dt * 2; this.vy -= Math.sin(a) * 100 * dt * 2; }
        if (this.actionCd <= 0) {
          const r = Math.random();
          if (this.phase >= 3 && r < 0.35) this.setState('rain');
          else if (this.phase >= 2 && r < 0.62) this.setState('pillars');
          else if (r < 0.9) this.setState('bells');
          else this.setState('summon');
        }
      } else if (this.state === 'bells') {
        this.stT += dt;
        if (this.stT > 0.45 && this.ringCount < 3) {
          this.ringCount++;
          game.rings.push({ x: this.x, y: this.y, r: 30, max: 460, spd: 260, dmg: 14, hit: false, col: '255,240,200' });
          S.Audio.sfx('ui');
          S.Audio.sfx('skill');
          this.stT = 0.1;
        }
        if (this.ringCount >= 3 && this.stT > 0.7) { this.ringCount = 0; this.actionCd = 1.6; this.setState('wait'); }
      } else if (this.state === 'pillars') {
        this.stT += dt;
        if (this.stT > 0.5 && this.ringCount < (this.phase >= 3 ? 5 : 3)) {
          this.ringCount++;
          game.pillars.push({ x: p.x + (Math.random() - 0.5) * 120, y: p.y + (Math.random() - 0.5) * 100, t: 0, warn: 0.75, dmg: 20 });
          S.Audio.sfx('ui');
          this.stT = 0.2;
        }
        if (this.ringCount >= (this.phase >= 3 ? 5 : 3) && this.stT > 0.9) { this.ringCount = 0; this.actionCd = 1.7; this.setState('wait'); }
      } else if (this.state === 'rain') {
        this.stT += dt;
        if (this.stT > 0.5 && this.ringCount < 10) {
          this.ringCount++;
          game.pillars.push({ x: p.x + (Math.random() - 0.5) * 400, y: p.y + (Math.random() - 0.5) * 320, t: 0, warn: 0.9, dmg: 16 });
          this.stT = 0.08;
        }
        if (this.ringCount >= 10 && this.stT > 1.0) { this.ringCount = 0; this.actionCd = 1.9; this.setState('wait'); }
      } else if (this.state === 'summon') {
        this.stT += dt;
        if (this.stT > 0.6 && this.ringCount < 2) {
          this.ringCount++;
          const a = Math.random() * S.TAU;
          const x = this.x + Math.cos(a) * 120, y = this.y + Math.sin(a) * 100;
          game.enemies.push(new Shade(x, y));
          FX.spawn(x, y, 16, { spd: 120, life: 0.7, size: 3, col: ['#1a2028', '#c8d8e0'], up: 40 });
          this.stT = 0.3;
        }
        if (this.ringCount >= 2 && this.stT > 0.9) { this.ringCount = 0; this.actionCd = 2.2; this.setState('wait'); }
      }
    }
    setState(s) { this.state = s; this.stT = 0; }
    onDeath(game) {
      this.dead = true;
      game.onBoss2Dead();
      FX.burst(this.x, this.y - 30, '#fff4d8');
      R.flash = 0.7; R.flashColor = 'rgba(255,248,224,1)';
      S.Audio.sfx('burst');
    }
    draw(g, game) {
      const x = R.sx(this.x), y = R.sy(this.y);
      const z = R.Cam.z;
      const bob = Math.sin(this.t * 1.1) * 5;
      g.save();
      g.translate(0, 0);
      // 光环
      g.save();
      g.globalCompositeOperation = 'lighter';
      const hg = g.createRadialGradient(x, y - 90 * z + bob, 8, x, y - 90 * z + bob, 120 * z);
      hg.addColorStop(0, `rgba(255,244,216,${0.28 + Math.sin(this.t * 2) * 0.06})`);
      hg.addColorStop(1, 'rgba(255,244,216,0)');
      g.fillStyle = hg;
      g.beginPath(); g.arc(x, y - 90 * z + bob, 120 * z, 0, S.TAU); g.fill();
      g.restore();
      R.drawHuman(g, 'bailu', x, y, z * 1.06, {
        t: this.t, walk: 0, dir: this.dir, atk: 0, hurt: this.hurt
      });
      // 漂浮的铃
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const a = this.t * 0.6 + i * (S.TAU / 6);
        const rx = x + Math.cos(a) * 58 * z;
        const ry = y - 50 * z + Math.sin(a) * 16 * z + Math.sin(this.t * 2 + i) * 4;
        g.fillStyle = 'rgba(255,240,200,0.85)';
        g.beginPath(); g.arc(rx, ry, 3 * z, 0, S.TAU); g.fill();
      }
      g.restore();
      g.restore();
      if (this.state === 'pillars' || this.state === 'rain') {
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = `rgba(255,240,200,${0.3 + Math.sin(this.t * 12) * 0.15})`;
        g.lineWidth = 2;
        g.beginPath(); g.ellipse(x, y, 70 * z, 32 * z, 0, 0, S.TAU); g.stroke();
        g.restore();
      }
      this.drawHpBar(g);
    }
  }

  /* ==========================================================
     NPC
     ========================================================== */
  class Npc {
    constructor(id, x, y, opt) {
      this.id = id; this.x = x; this.y = y;
      this.t = Math.random() * 10;
      opt = opt || {};
      this.ch = opt.ch || id;
      this.name = (S.CHARS[this.ch] || {}).name || '';
      this.dir = opt.dir || 1;
      this.r = 13;
      this.follow = opt.follow || null;
      this.isNpc = true;
      this.bob = Math.random() * 6;
      this.talkable = opt.talkable !== false;
      this.visible = opt.visible !== false;
      this.hidden = false;
      this.walk = 0;
      this.teleportCd = 0;
    }
    update(dt, game) {
      this.t += dt;
      if (this.follow) {
        const p = game.player;
        const d = S.dist(this.x, this.y, p.x, p.y);
        if (d > 96) {
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          const spd = Math.min(300, 120 + (d - 96) * 2.2);
          const nx = this.x + Math.cos(a) * spd * dt;
          const ny = this.y + Math.sin(a) * spd * dt;
          if (S.free(nx, this.y, this.r)) this.x = nx;
          if (S.free(this.x, ny, this.r)) this.y = ny;
          this.walk = S.approach(this.walk, 1, dt * 4);
          this.dir = Math.cos(a) > 0 ? 1 : -1;
        } else {
          this.walk = S.approach(this.walk, 0, dt * 4);
          this.dir = game.player.x > this.x ? 1 : -1;
        }
        if (d > 900) { this.x = p.x - 50; this.y = p.y + 40; }
      } else {
        this.walk = S.approach(this.walk, 0, dt * 3);
        if (game.player) this.dir = game.player.x > this.x ? 1 : -1;
      }
    }
    drawShadow(g) { R.shadow(g, this.x, this.y, 14, 6, 0.22); }
    draw(g, game) {
      if (this.hidden) return;
      const x = R.sx(this.x), y = R.sy(this.y);
      R.drawHuman(g, this.ch, x, y, R.Cam.z * 0.96, {
        t: this.t, walk: this.walk, dir: this.dir, atk: 0, hurt: 0, seed: this.bob
      });
      // 交互提示
      if (game.nearNpc === this && !game.locked) {
        const yy = y - 92 * R.Cam.z + Math.sin(this.t * 3) * 4;
        g.save();
        g.globalCompositeOperation = 'lighter';
        const gg = g.createRadialGradient(x, yy, 1, x, yy, 16);
        gg.addColorStop(0, 'rgba(255,240,200,0.8)');
        gg.addColorStop(1, 'rgba(255,240,200,0)');
        g.fillStyle = gg; g.beginPath(); g.arc(x, yy, 16, 0, S.TAU); g.fill();
        g.restore();
        g.fillStyle = 'rgba(255,250,230,0.95)';
        g.font = `${11 * R.Cam.z}px "Noto Serif SC", serif`;
        g.textAlign = 'center';
        g.fillText('·', x, yy + 4);
      }
    }
  }

  /* ==========================================================
     星骸（残响）
     ========================================================== */
  class Relic {
    constructor(frag) {
      this.f = frag; this.x = frag.x; this.y = frag.y;
      this.t = Math.random() * 6; this.got = false; this.r = 20;
      this.isRelic = true;
    }
    update(dt, game) {
      this.t += dt;
      if (!this.got && Math.random() < dt * 0.7) {
        FX.spawn(this.x + (Math.random() - 0.5) * 22, this.y + (Math.random() - 0.5) * 16, 1,
          { spd: 14, life: 1.6, size: 1.8, col: ['#bff6ea', '#fff6d8'], up: 16, drag: 0.96 });
      }
    }
    drawShadow(g) { R.shadow(g, this.x, this.y, 8, 3.5, 0.12); }
    draw(g, game) {
      if (this.got) return;
      const x = R.sx(this.x), y = R.sy(this.y);
      const z = R.Cam.z;
      const bob = Math.sin(this.t * 1.6) * 6;
      g.save();
      g.globalCompositeOperation = 'lighter';
      const gg = g.createRadialGradient(x, y - 20 * z + bob, 2, x, y - 20 * z + bob, 46 * z);
      gg.addColorStop(0, 'rgba(190,250,240,0.55)');
      gg.addColorStop(0.5, 'rgba(150,230,220,0.18)');
      gg.addColorStop(1, 'rgba(150,230,220,0)');
      g.fillStyle = gg;
      g.beginPath(); g.arc(x, y - 20 * z + bob, 46 * z, 0, S.TAU); g.fill();
      // 晶体
      g.translate(x, y - 26 * z + bob);
      g.rotate(Math.sin(this.t * 0.8) * 0.25);
      g.fillStyle = 'rgba(220,255,250,0.95)';
      g.beginPath();
      g.moveTo(0, -10 * z); g.lineTo(6 * z, 0); g.lineTo(0, 12 * z); g.lineTo(-6 * z, 0);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1; g.stroke();
      g.restore();
      if (game.nearRelic === this) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = 'rgba(200,255,245,0.6)';
        g.lineWidth = 1.4;
        g.beginPath(); g.ellipse(x, y, 26 * z, 12 * z, 0, 0, S.TAU); g.stroke();
        g.restore();
      }
    }
  }

  S.Ent = { Player, Beast, Shade, DuelLan, BossShadow, BossBailu, Npc, Relic, InkBolt };
})();
