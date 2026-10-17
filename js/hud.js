/* =====================================================================
   拾星纪 · 长庚  —  hud.js
   对话 / 任务 / 小地图 / 图鉴 / 演出
   ===================================================================== */
(function () {
  'use strict';
  const S = window.STAR;
  const $ = S.$;

  const HUD = S.HUD = {
    dlg: null, el: {}, portraitT: 0, minimapFrame: 0,
    boss: null,

    init() {
      this.el = {
        hud: $('hud'), qChapter: $('qChapter'), qTitle: $('qTitle'), qObjs: $('qObjs'), qDist: $('qDist'),
        minimap: $('minimap'), regionName: $('regionName'), regionSub: $('regionSub'),
        hpFill: $('hpFill'), hpText: $('hpText'), stFill: $('stFill'), enFill: $('enFill'),
        dlg: $('dlg'), dlgName: $('dlgName'), dlgText: $('dlgText'), dlgNext: $('dlgNext'),
        portrait: $('portrait'), choices: $('dlgChoices'),
        toasts: $('toasts'), dmgLayer: $('dmgLayer'), interact: $('interact'), interactText: $('interactText'),
        banner: $('banner'), bnCh: $('bnCh'), bnTitle: $('bnTitle'),
        fade: $('fade'), fragCount: $('fragCount'), fragTag: $('fragTag'),
        journal: $('journal'), jList: $('jList'), jDetail: $('jDetail'),
        hint: $('hint'), cdE: $('cdE'), cdQ: $('cdQ'), hudPortrait: $('hudPortrait')
      };
      const mctx = this.el.minimap.getContext('2d');
      this.mctx = mctx;

      // 对话点击推进（全屏任意处，排除面板与选项）
      window.addEventListener('pointerdown', (e) => {
        if (!this.dlg) return;
        const t = e.target;
        if (t && t.closest && (t.closest('.choice') || t.closest('.screen') || t.closest('.tb') ||
            t.closest('#journal') || t.closest('#ending') || t.closest('#help'))) return;
        this.advance();
      });

      // BOSS 血条
      const bb = document.createElement('div');
      bb.id = 'bossBar';
      bb.className = 'hidden';
      bb.innerHTML = '<div class="bb-name"><span></span><i></i></div><div class="bb-track"><b></b><em></em></div>';
      $('hud').appendChild(bb);
      this.el.bossBar = bb;
      this.el.bossName = bb.querySelector('.bb-name span');
      this.el.bossFill = bb.querySelector('.bb-track b');
      this.el.bossGhost = bb.querySelector('.bb-track em');
      this.bossGhost = 1;
      this.drawAvatar('xu');
    },

    /* 圆形头像：从 512×600 立绘裁出头部 */
    drawAvatar(id) {
      try {
        const cv = this.el.hudPortrait;
        if (!cv) return;
        const tmp = document.createElement('canvas');
        tmp.width = 512; tmp.height = 600;
        S.Render.drawPortrait(tmp, id);
        const g = cv.getContext('2d');
        g.clearRect(0, 0, cv.width, cv.height);
        g.drawImage(tmp, 132, 158, 248, 248, 0, 0, cv.width, cv.height);
      } catch (e) { /* 头像失败不影响游戏 */ }
    },

    /* ---------------- 常驻 UI ---------------- */
    show(on) {
      this.el.hud.classList.toggle('hidden', !on);
      requestAnimationFrame(() => this.el.hud.classList.toggle('on', on));
    },
    toggleHud(on) { this.el.hud.style.opacity = on ? '1' : '0'; },

    setQuest(q) {
      if (!q) { this.el.qChapter.textContent = ''; this.el.qTitle.textContent = ''; this.el.qObjs.innerHTML = ''; return; }
      this.el.qChapter.textContent = q.chapter || '';
      this.el.qTitle.textContent = q.title || '';
      this.el.qObjs.innerHTML = '';
      (q.objs || []).forEach((o) => {
        const li = document.createElement('li');
        li.textContent = typeof o === 'string' ? o : o.text;
        if (typeof o === 'object' && o.done) li.classList.add('done');
        this.el.qObjs.appendChild(li);
      });
      this.el.qDist.textContent = q.dist || '';
    },

    setRegion(r) {
      if (!r) return;
      this.el.regionName.textContent = r.name;
      this.el.regionSub.textContent = r.sub;
    },

    setVitals(p) {
      const hp = S.clamp(p.hp / p.maxhp, 0, 1);
      this.el.hpFill.style.width = (hp * 100) + '%';
      this.el.hpText.textContent = Math.max(0, Math.ceil(p.hp)) + ' / ' + p.maxhp;
      this.el.stFill.style.width = S.clamp(p.st / p.maxst, 0, 1) * 100 + '%';
      this.el.enFill.style.width = S.clamp(p.en / p.maxen, 0, 1) * 100 + '%';
      document.body.classList.toggle('lowhp', hp < 0.28);
      // 技能冷却
      const er = S.clamp(p.skillCd / 6.5, 0, 1);
      this.el.cdE.style.setProperty('--p', (er * 100) + '%');
      const qr = S.clamp(1 - p.en / p.maxen, 0, 1);
      this.el.cdQ.style.setProperty('--p', (qr * 100) + '%');
      const skillEls = document.querySelectorAll('.skill');
      if (skillEls[0]) skillEls[0].classList.toggle('ready', p.skillCd <= 0);
      if (skillEls[1]) skillEls[1].classList.toggle('ready', p.en >= 100);
      // 触屏技能键的冷却环
      const te = document.getElementById('tbSkill');
      if (te) te.style.setProperty('--p', (er * 100) + '%');
      const tq = document.getElementById('tbBurst');
      if (tq) tq.style.setProperty('--p', (qr * 100) + '%');
    },

    setFrag(n, total) {
      this.el.fragCount.textContent = n;
      this.el.fragTag.classList.remove('hidden');
      this.el.fragTag.querySelector('b').textContent = '/ ' + total;
    },

    setInteract(text) {
      if (!text) { this.el.interact.classList.add('hidden'); return; }
      this.el.interact.classList.remove('hidden');
      this.el.interactText.textContent = text;
    },

    hint(text, dur) {
      this.el.hint.textContent = text;
      this.el.hint.classList.remove('hidden');
      clearTimeout(this._hintT);
      this._hintT = setTimeout(() => this.el.hint.classList.add('hidden'), (dur || 3.4) * 1000);
    },

    toast(text, cls) {
      const d = document.createElement('div');
      d.className = 'toast ' + (cls || '');
      d.textContent = text;
      this.el.toasts.appendChild(d);
      setTimeout(() => d.remove(), 3800);
    },

    dmg(wx, wy, val, crit) {
      const R = S.Render;
      const d = document.createElement('div');
      d.className = 'dmgnum' + (crit ? ' crit' : '');
      d.textContent = Math.round(val);
      d.style.left = R.sx(wx) + 'px';
      d.style.top = R.sy(wy) + 'px';
      this.el.dmgLayer.appendChild(d);
      setTimeout(() => d.remove(), 1000);
    },

    banner(ch, title) {
      const b = this.el.banner;
      b.classList.add('hidden');
      this.el.bnCh.textContent = ch;
      this.el.bnTitle.textContent = title;
      void b.offsetWidth;
      b.classList.remove('hidden');
      S.Audio.sfx('quest');
      clearTimeout(this._bnT);
      this._bnT = setTimeout(() => b.classList.add('hidden'), 4700);
    },

    fade(on, white) {
      const f = this.el.fade;
      f.classList.toggle('white', !!white);
      f.classList.toggle('on', !!on);
    },

    bossShow(name) {
      this.el.bossName.textContent = name;
      this.el.bossBar.classList.remove('hidden');
      this.bossGhost = 1;
    },
    bossHide() { this.el.bossBar.classList.add('hidden'); },
    bossHp(k, dt) {
      this.el.bossFill.style.width = (k * 100) + '%';
      this.bossGhost = S.approach(this.bossGhost, k, (dt || 0.016) * 0.35);
      this.el.bossGhost.style.width = (this.bossGhost * 100) + '%';
    },

    /* ---------------- 对话 ---------------- */
    startScript(steps, onEnd) {
      document.body.classList.add('dialog');
      this.dlg = { steps, i: -1, onEnd, typed: 0, full: '', done: false, char: null, timer: 0, speaker: null };
      this.el.dlg.classList.remove('hidden');
      this.el.choices.classList.add('hidden');
      this.el.choices.innerHTML = '';
      this.next();
    },

    next() {
      const d = this.dlg;
      if (!d) return;
      d.i++;
      if (d.i >= d.steps.length) { this.endScript(); return; }
      let st = d.steps[d.i];
      // 动作型步骤直接执行
      if (st.a) {
        const res = S.Game.act(st.a, st.v);
        if (res === 'wait') return;
      }
      if (st.banner) { this.banner(st.banner[0], st.banner[1]); this.next(); return; }
      if (st.fade) {
        this.fade(st.fade === true || st.fade === 'on', st.fade === 'white');
        this.next(); return;
      }
      if (st.wait) {
        setTimeout(() => this.next(), st.wait * 1000);
        return;
      }
      if (st.choice) { this.showChoices(st.choice); return; }
      if (st.n !== undefined || st.s !== undefined) {
        const who = st.w || st.n !== undefined ? (st.w || 'narr') : d.speaker;
        this.say(who, st.s !== undefined ? st.s : st.n);
        return;
      }
      this.next();
    },

    say(who, text) {
      const d = this.dlg;
      d.speaker = who;
      const def = S.CHARS[who] || S.CHARS.narr;
      const isNarr = !!(who === 'narr' || def.narr);
      this.el.dlg.classList.toggle('narr', isNarr);
      this.el.dlgName.textContent = def.name || '';
      this.el.dlgName.style.color = isNarr ? 'rgba(200,220,215,.6)' : '';
      this.el.dlgText.innerHTML = '';
      d.full = text;
      d.typed = 0;
      d.done = false;
      d.timer = 0;
      d.textEl = this.el.dlgText;
      this.el.dlgNext.style.opacity = '0';
      // 立绘
      const pc = this.el.portrait.parentElement.parentElement;
      if (isNarr) {
        this.el.portrait.parentElement.style.opacity = '0';
      } else {
        this.el.portrait.parentElement.style.opacity = '1';
        if (d.char !== who) {
          d.char = who;
          S.Render.drawPortrait(this.el.portrait, who, S.Render.t, S.Render.moodC);
        }
      }
      S.Audio.sfx('blip');
    },

    showChoices(opts) {
      const d = this.dlg;
      this.el.choices.classList.remove('hidden');
      this.el.choices.innerHTML = '';
      opts.forEach((o, i) => {
        const b = document.createElement('button');
        b.className = 'choice';
        b.textContent = o.s;
        const locked = o.need && S.Game.checkNeed(o.need) === false;
        if (locked) {
          b.classList.add('locked');
          b.textContent = o.s + '　（' + (o.lockHint || '条件未达成') + '）';
        } else {
          b.addEventListener('click', () => {
            S.Audio.sfx('ui');
            this.el.choices.classList.add('hidden');
            if (o.a) {
              this.el.choices.innerHTML = '';
              S.Game.act(o.a, o.v);
            }
            if (o.reply) {
              d.steps.splice(d.i + 1, 0, { w: d.speaker, s: o.reply });
            }
            if (o.then) { S.Game.act(o.then, o.thenV); }
            this.next();
          });
        }
        this.el.choices.appendChild(b);
      });
    },

    endScript() {
      document.body.classList.remove('dialog');
      const d = this.dlg;
      this.dlg = null;
      this.el.dlg.classList.add('hidden');
      this.el.choices.classList.add('hidden');
      if (d && d.endLines) d.endLines();
      if (d && d.onEnd) d.onEnd();
    },

    advance() {
      const d = this.dlg;
      if (!d) return;
      if (this.el.choices && !this.el.choices.classList.contains('hidden')) return;
      if (!d.done) {
        d.typed = d.full.length;
        d.done = true;
        this.el.dlgNext.style.opacity = '1';
        this.el.dlgText.innerHTML = this.fmt(d.full);
        return;
      }
      this.next();
    },

    fmt(text) {
      // 支持的标记：<g>金</g> <e>青</e> <r>红</r> \n
      return text.replace(/\n/g, '<br>')
        .replace(/<g>/g, '<span class="gold">').replace(/<\/g>/g, '</span>')
        .replace(/<e>/g, '<span class="em">').replace(/<\/e>/g, '</span>')
        .replace(/<r>/g, '<span class="red">').replace(/<\/r>/g, '</span>');
    },

    update(dt, game) {
      const d = this.dlg;
      if (d && !d.done) {
        d.timer += dt;
        const speed = 0.028;
        while (d.timer > speed && d.typed < d.full.length) {
          d.timer -= speed;
          d.typed++;
          if (d.typed % 3 === 0) S.Audio.sfx('blip');
        }
        // 逐字显示（避免破坏标签）
        const raw = d.full;
        const n = Math.min(d.typed, raw.length);
        let cut = raw.slice(0, n);
        // 若截断在标签内，补上闭合
        const opens = (cut.match(/<[ger]>/g) || []).length;
        const closes = (cut.match(/<\/[ger]>/g) || []).length;
        cut = cut.replace(/<[^>]*$/, '');
        let html = this.fmt(cut);
        for (let i = 0; i < opens - closes; i++) html += '</span>';
        this.el.dlgText.innerHTML = html;
        if (d.typed >= raw.length) {
          d.done = true;
          this.el.dlgNext.style.opacity = '1';
          this.el.dlgText.innerHTML = this.fmt(raw);
        }

      }
      if (game && game.player) this.setVitals(game.player);
    },

    /* ---------------- 小地图 ---------------- */
    drawMinimap(game) {
      const c = this.mctx;
      const W = this.el.minimap.width, H = this.el.minimap.height;
      const p = game.player;
      c.clearRect(0, 0, W, H);
      c.save();
      c.beginPath(); c.arc(W / 2, H / 2, W / 2 - 2, 0, S.TAU); c.clip();
      // 底图
      const world = S.World;
      const zx = 0.145;
      const R2 = 1500;
      c.fillStyle = '#0a1418';
      c.fillRect(0, 0, W, H);
      if (world.base) {
        const bw = world.base.width, bh = world.base.height;
        const sx = (p.x - R2) * world.BS, sy = (p.y - R2) * world.BS;
        const sw = R2 * 2 * world.BS, sh = R2 * 2 * world.BS;
        c.globalAlpha = 0.92;
        c.drawImage(world.base, sx, sy, sw, sh, 0, 0, W, H);
        c.globalAlpha = 1;
      }
      // 云海外的暗
      c.globalCompositeOperation = 'source-over';
      const vg = c.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.55);
      vg.addColorStop(0, 'rgba(4,10,14,0)');
      vg.addColorStop(1, 'rgba(4,10,14,0.75)');
      c.fillStyle = vg; c.fillRect(0, 0, W, H);

      const toMap = (wx, wy) => [W / 2 + (wx - p.x) / R2 * (W / 2), H / 2 + (wy - p.y) / R2 * (H / 2)];
      // 残响
      for (const r of game.relics) {
        if (r.got) continue;
        const d = S.dist(r.x, r.y, p.x, p.y);
        if (d > R2) continue;
        const [mx, my] = toMap(r.x, r.y);
        c.fillStyle = 'rgba(170,245,235,0.85)';
        c.beginPath(); c.moveTo(mx, my - 3); c.lineTo(mx + 2.4, my); c.lineTo(mx, my + 3); c.lineTo(mx - 2.4, my);
        c.closePath(); c.fill();
      }
      // NPC
      for (const n of game.npcs) {
        if (n.hidden || n.follow) continue;
        const d = S.dist(n.x, n.y, p.x, p.y);
        if (d > R2) continue;
        const [mx, my] = toMap(n.x, n.y);
        c.fillStyle = 'rgba(240,230,200,0.7)';
        c.beginPath(); c.arc(mx, my, 2.2, 0, S.TAU); c.fill();
      }
      // 敌人
      for (const e of game.enemies) {
        if (e.dead) continue;
        const d = S.dist(e.x, e.y, p.x, p.y);
        if (d > R2) continue;
        const [mx, my] = toMap(e.x, e.y);
        c.fillStyle = e.boss ? 'rgba(255,120,140,0.95)' : 'rgba(230,120,130,0.6)';
        c.beginPath(); c.arc(mx, my, e.boss ? 3.6 : 1.8, 0, S.TAU); c.fill();
      }
      // 任务目标
      if (game.marker) {
        const [mx, my] = toMap(game.marker.x, game.marker.y);
        const inView = mx > 6 && mx < W - 6 && my > 6 && my < H - 6;
        const cx = S.clamp(mx, 8, W - 8), cy = S.clamp(my, 8, H - 8);
        const pulse = 0.6 + Math.sin(S.Render.t * 4) * 0.4;
        c.save();
        c.globalCompositeOperation = 'lighter';
        const gg = c.createRadialGradient(cx, cy, 0, cx, cy, 12);
        gg.addColorStop(0, `rgba(255,236,180,${0.5 * pulse})`);
        gg.addColorStop(1, 'rgba(255,236,180,0)');
        c.fillStyle = gg; c.beginPath(); c.arc(cx, cy, 12, 0, S.TAU); c.fill();
        c.restore();
        c.fillStyle = 'rgba(255,244,214,0.95)';
        c.beginPath();
        c.moveTo(cx, cy - 5); c.lineTo(cx + 4.4, cy); c.lineTo(cx, cy + 5); c.lineTo(cx - 4.4, cy);
        c.closePath(); c.fill();
      }
      // 玩家
      c.fillStyle = '#eafff8';
      c.beginPath(); c.arc(W / 2, H / 2, 3, 0, S.TAU); c.fill();
      c.strokeStyle = 'rgba(140,240,220,0.9)'; c.lineWidth = 1.2;
      c.beginPath(); c.arc(W / 2, H / 2, 6.5, 0, S.TAU); c.stroke();
      c.restore();
    },

    /* ---------------- 图鉴 ---------------- */
    openJournal(game) {
      const j = this.el;
      j.journal.classList.remove('hidden');
      this.buildJournalList(game);
      const found = game.fragsFound;
      if (found.length) this.showFrag(S.FRAGMENTS[found[0]], game);
      S.Audio.sfx('ui');
    },
    closeJournal() { this.el.journal.classList.add('hidden'); },
    isJournalOpen() { return !this.el.journal.classList.contains('hidden'); },

    buildJournalList(game) {
      const list = this.el.jList;
      list.innerHTML = '';
      const regionName = { A: '拾星原', B: '浮云渡', C: '星陨之庭' };
      S.FRAGMENTS.forEach((f) => {
        const li = document.createElement('li');
        const has = game.fragsFound.includes(f.id);
        if (!has) li.classList.add('lock');
        li.innerHTML = '<b>' + (has ? '残响 · ' + f.title : '残 响 · ？ ？ ？') + '</b>' +
          '<span>' + (has ? f.meta : '散落于「' + regionName[f.region] + '」') + '</span>';
        li.addEventListener('click', () => {
          if (!has) return;
          document.querySelectorAll('.j-list li').forEach((e) => e.classList.remove('sel'));
          li.classList.add('sel');
          this.showFrag(f, game);
          S.Audio.sfx('ui');
        });
        if (has && game.fragsFound[0] === f.id) li.classList.add('sel');
        list.appendChild(li);
      });
      // 底部统计
      let foot = list.querySelector('.j-foot');
      if (!foot) {
        foot = document.createElement('li');
        foot.className = 'j-foot';
        foot.style.cssText = 'border:0;padding-left:16px;margin-top:10px;opacity:.55;pointer-events:none';
        foot.innerHTML = '<span style="letter-spacing:.2em;font-size:10px">已寻得 ' + game.fragsFound.length + ' / 12　·　集齐 8 片，可窥第三种结局</span>';
        list.appendChild(foot);
      }
    },

    showFrag(f, game) {
      if (!f) return;
      const d = this.el.jDetail;
      d.innerHTML = '<h3>' + f.title + '</h3>' +
        '<div class="j-meta">残 响 · 第 ' + (f.id + 1) + ' 片 · ' + f.meta + '</div>' +
        '<div class="j-text">' + f.text.replace(/\n/g, '<br>') + '</div>' +
        (f.quote ? '<div class="j-quote">' + f.quote + '</div>' : '');
      d.scrollTop = 0;
    },

    /* ---------------- 结局 ---------------- */
    showEnding(key) {
      const e = S.ENDINGS[key];
      $('eCh').textContent = e.ch;
      $('eTitle').textContent = e.title;
      $('eBody').innerHTML = e.body.replace(/\n/g, '<br>');
      $('eFoot').textContent = e.foot;
      $('ending').classList.remove('hidden');
      S.Audio.sfx('quest');
    }
  };
})();
