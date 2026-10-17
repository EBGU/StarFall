/* =====================================================================
   拾星纪 · 长庚  —  game.js
   主循环 / 剧情状态机 / 战斗 / 结局
   ===================================================================== */
(function () {
  'use strict';
  const S = window.STAR;
  const R = S.Render;
  const FX = S.FX;
  const $ = S.$;

  /* 阶段表 */
  const STAGES = {
    wake: { ch: '序 章', title: '陨星落在无名之地', obj: '拾起断裂的星盘', marker: 'crater' },
    toVillage: { ch: '序 章', title: '陨星落在无名之地', obj: '循着星盘的指向，走向东南方的村落', marker: 'gate' },
    elder: { ch: '序 章', title: '陨星落在无名之地', obj: '去见守夜人隼', marker: 'sunSpot' },
    toStele: { ch: '第 一 章', title: '风 的 碑 文', obj: '前往东边的风蚀碑林，寻回第一枚回声', marker: 'stele' },
    backVillage: { ch: '第 一 章', title: '风 的 碑 文', obj: '回云栖村找青芜', marker: 'qingwuSpot' },
    raid: { ch: '第 一 章', title: '风 的 碑 文', obj: '击退袭击村庄的失名兽', marker: 'village' },
    toBridge: { ch: '第 一 章', title: '风 的 碑 文', obj: '渡过河，前往浮云渡', marker: 'bridge1' },
    lanFight: { ch: '第 二 章', title: '云 间 旧 誓', obj: '接下岚的一剑', marker: 'bridge1' },
    toRuins: { ch: '第 二 章', title: '云 间 旧 誓', obj: '深入浮云渡，寻找白露庭的遗迹', marker: 'ruins' },
    boss1: { ch: '第 二 章', title: '云 间 旧 誓', obj: '击败蚀名之影', marker: 'ruins' },
    toCourt: { ch: '第 二 章', title: '云 间 旧 誓', obj: '跨越断崖，前往星陨之庭', marker: 'chasmBridge' },
    toObs: { ch: '第 三 章', title: '无 声 之 潮', obj: '登临观星台', marker: 'observatory' },
    boss2: { ch: '第 三 章', title: '无 声 之 潮', obj: '击败白露', marker: 'observatory' },
    choice: { ch: '终 章', title: '记 名', obj: '做出选择', marker: 'observatory' }
  };

  const G = S.Game = {
    stage: 'boot',
    player: null,
    enemies: [], npcs: [], relics: [], projectiles: [], rings: [], pillars: [], delayedStars: [],
    fragsFound: [],
    locked: true,
    hitstop: 0, slowT: 0, slowK: 1,
    marker: null,
    nearNpc: null, nearRelic: null, nearSpecial: null,
    started: false,
    playerName: '衔星',
    titleMode: true,
    stageCleared: {},
    obj: '',
    encounterActive: false,
    lastRegion: null,

    /* ================= 启动 ================= */
    boot() {
      if (this.booted) return;
      this.booted = true;
      try { this.qs = new URLSearchParams(location.search || ''); } catch (e) { this.qs = null; }
      // 触屏检测 + 画质分级
      const forceTouch = !!(this.qs && this.qs.get('touch'));
      S.QUALITY.forced = forceTouch;
      S.QUALITY.dpr = Math.min(window.devicePixelRatio || 1, 2);
      S.Input.init();
      this.isTouch = S.Touch.init(forceTouch);
      if (this.isTouch) {
        document.body.classList.add('touch');
        S.QUALITY.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
        S.QUALITY.grassCell = 24;
        S.QUALITY.bloomCheap = true;
        S.QUALITY.particles = 0.6;
      }
      R.init($('game'));
      this.buildWorld();
      S.HUD.init();
      this.bindUI();
      this.createEntities();
      this.loopBound = this.loop.bind(this);
      this.last = performance.now();
      requestAnimationFrame(this.loopBound);
      setTimeout(() => {
        const bo = $('boot'); if (bo) bo.classList.add('gone');
        setTimeout(() => { const b2 = $('boot'); if (b2) b2.remove(); }, 900);
      }, 260);
      if (this.isTouch) {
        const tf = $('tFoot');
        if (tf) tf.textContent = '左半屏拖动移动 · 「攻」普攻 ·「风」听风 ·「星」星陨 ·「疾」冲刺 ·「触」交互';
      }
      this.titleMode = true;
      S.Cam.x = 1620; S.Cam.y = 2860; S.Cam.z = 1.16;
      S.Cam.tx = S.Cam.x; S.Cam.ty = S.Cam.y;
      if (this.qs && this.qs.get('intro')) {
        setTimeout(() => {
          const tt = S.$('title'); if (tt) tt.classList.add('hidden');
          this.beginNew();
          let k = parseInt(this.qs.get('adv') || '0', 10);
          const tick = () => {
            if (k-- > 0 && S.HUD.dlg) {
              S.HUD.dlg.typed = S.HUD.dlg.full.length;
              S.HUD.dlg.done = true;
              S.HUD.advance();
              setTimeout(tick, 220);
            }
          };
          if (k > 0) setTimeout(tick, 900);
        }, 400);
      }
      if (this.qs && this.qs.get('shot')) this.debugStart();
      if (this.qs && this.qs.get('rects')) {
        setTimeout(() => {
          const ids = ['tbAttack', 'tbSkill', 'tbBurst', 'tbDash', 'tbInteract', 'touch', 'stickZone'];
          let out = '';
          ids.forEach((id) => {
            const e = document.getElementById(id);
            if (!e) { out += id + ' MISSING\n'; return; }
            const r = e.getBoundingClientRect();
            const cs = getComputedStyle(e);
            out += id + ' x=' + Math.round(r.x) + ' y=' + Math.round(r.y) + ' w=' + Math.round(r.width) + ' h=' + Math.round(r.height) + ' disp=' + cs.display + ' op=' + cs.opacity + ' vis=' + cs.visibility + '\n';
          });
          document.body.innerHTML = '<pre id=rectout>' + out + '</pre>';
        }, 1200);
      }      if (this.qs && this.qs.get('dump')) {
        setTimeout(() => {
          const u = S.World.base.toDataURL('image/png');
          document.body.innerHTML = '<img id=dumpimg src=' + String.fromCharCode(34) + u + String.fromCharCode(34) + '>';
        }, 300);
      }
    },

    /* 开发用：?shot=1&stage=toStele&x=2050&y=2230 */
    debugStart() {
      const q = this.qs;
      setTimeout(() => {
        this.titleMode = false;
        this.started = true;
        this.booted = true;
        S.HUD.fade(false);
        const bt = S.$('boot'); if (bt) bt.remove();
        const t = S.$('title'); if (t) t.classList.add('hidden');
        S.HUD.show(true);
        if (this.isTouch) S.Touch.show(true);
        const st = q.get('stage') || 'toVillage';
        this.stage = st;
        this.applyStageState(st);
        this.refreshQuest();
        if (q.get('x')) this.player.x = parseFloat(q.get('x'));
        if (q.get('y')) this.player.y = parseFloat(q.get('y'));
        S.Cam.x = this.player.x; S.Cam.y = this.player.y;
        if (q.get('frag')) this.giveFrag(parseInt(q.get('frag'), 10));
        if (q.get('frags')) q.get('frags').split(',').forEach((v) => this.giveFrag(parseInt(v, 10)));
        if (q.get('dlg')) {
          const sc = S.SCENES[q.get('dlg')];
          if (sc) S.HUD.startScript(sc);
        }
        if (q.get('end')) setTimeout(() => S.HUD.showEnding(q.get('end')), 300);
        if (q.get('journal')) setTimeout(() => S.HUD.openJournal(this), 300);
        if (q.get('final')) setTimeout(() => this.startFinalChoice(), 400);
        if (q.get('adv')) {
          let k = parseInt(q.get('adv'), 10);
          const tick = () => {
            if (k-- > 0 && S.HUD.dlg) {
              S.HUD.dlg.typed = S.HUD.dlg.full.length;
              S.HUD.dlg.done = true;
              S.HUD.advance();
              setTimeout(tick, 140);
            }
          };
          setTimeout(tick, 500);
        }
        if (['boss1', 'boss2', 'lanFight', 'raid'].indexOf(st) >= 0) {
          setTimeout(() => {
            this.startBattle(st === 'lanFight' ? 'lan' : st);
          }, 500);
        }
      }, 200);
    },

    buildWorld() {
      S.World.build();
      // 角色发型
      const H = { xu: 'long', qingwu: 'braid', lan: 'pony', sun: 'short', bailu: 'long', cen: 'long', ache: 'short', villager: 'short' };
      for (const k in H) if (S.CHARS[k]) S.CHARS[k].hair = H[k];
    },

    createEntities() {
      this.player = new S.Ent.Player(S.LM.start.x, S.LM.start.y);
      this.relics = S.FRAGMENTS.map((f) => new S.Ent.Relic(f));
      const P = S.LM;
      this.npcQingwu = new S.Ent.Npc('qingwu', P.qingwuSpot.x, P.qingwuSpot.y, { ch: 'qingwu', dir: -1 });
      this.npcSun = new S.Ent.Npc('sun', P.sunSpot.x, P.sunSpot.y, { ch: 'sun', dir: 1 });
      this.npcLan = new S.Ent.Npc('lan', 2806, 3006, { ch: 'lan', dir: -1 });
      this.npcBailu = new S.Ent.Npc('bailu', P.ruins.x + 120, P.ruins.y + 60, { ch: 'bailu', dir: -1 });
      this.npcAche = new S.Ent.Npc('ache', P.ruins.x - 40, P.ruins.y - 90, { ch: 'ache', dir: 1 });
      this.npcs = [
        this.npcQingwu, this.npcSun, this.npcLan, this.npcBailu, this.npcAche
      ];
      // 村民
      const V = P.village;
      this.barkNpcs = [
        { x: V.x - 148, y: V.y + 54, key: 'oldwoman', ch: 'villager' },
        { x: V.x + 216, y: V.y + 216, key: 'child', ch: 'villager' },
        { x: V.x + 102, y: V.y - 234, key: 'smith', ch: 'villager' },
        { x: V.x + 330, y: V.y + 190, key: 'poet', ch: 'villager' }
      ].map((v) => {
        const n = new S.Ent.Npc('villager', v.x, v.y, { ch: v.ch, dir: 1 });
        n.bark = v.key;
        n.barkIdx = 0;
        return n;
      });
      this.npcs.push.apply(this.npcs, this.barkNpcs);
      this.npcBailu.hidden = true;
      this.npcAche.hidden = true;
      this.npcLan.hidden = true;
      this.npcQingwu.hidden = true;
      this.npcSun.hidden = true;
      S.HUD.setFrag(0, 12);
      this.spawnAmbient();
    },

    /* 野外游荡的失名兽 */
    spawnAmbient() {
      const pts = [
        ['beast', 900, 2450], ['beast', 1780, 2520], ['shade', 2180, 1720],
        ['beast', 880, 2620], ['beast', 2320, 3320], ['beast', 1620, 2350],
        ['shade', 3180, 2180], ['beast', 3600, 2820], ['shade', 4220, 2620],
        ['beast', 4600, 1900], ['beast', 3260, 1620],
        ['beast', 5600, 2820], ['shade', 5900, 2020], ['beast', 6520, 2900],
        ['beast', 6820, 1880], ['shade', 5350, 2180]
      ];
      pts.forEach((p) => {
        if (!S.free(p[1], p[2], 18)) return;
        if (S.dist(p[1], p[2], S.LM.village.x, S.LM.village.y) < 520) return;
        if (S.dist(p[1], p[2], S.LM.start.x, S.LM.start.y) < 680) return;
        if (S.dist(p[1], p[2], S.LM.crater.x, S.LM.crater.y) < 680) return;
        const e = p[0] === 'beast' ? new S.Ent.Beast(p[1], p[2]) : new S.Ent.Shade(p[1], p[2]);
        e.ambient = true;
        e.aggro = 300;
        this.enemies.push(e);
      });
    },

    bindUI() {
      $('btnStart').addEventListener('click', () => this.beginNew());
      $('btnContinue').addEventListener('click', () => this.continueGame());
      $('btnHelp').addEventListener('click', () => $('help').classList.remove('hidden'));
      $('btnHelpClose').addEventListener('click', () => $('help').classList.add('hidden'));
      $('btnRestart').addEventListener('click', () => { S.Save.clear(); location.reload(); });
      if (!S.Save.exists()) $('btnContinue').classList.add('hide');

      window.addEventListener('keydown', (e) => {
        const k = e.key;
        if (k === 'Tab') {
          e.preventDefault();
          if (this.titleMode) return;
          if (S.HUD.isJournalOpen()) S.HUD.closeJournal();
          else S.HUD.openJournal(this);
        }
        if (k === 'Escape') {
          S.HUD.closeJournal();
          $('help').classList.add('hidden');
        }
        if (k === 'm' || k === 'M') {
          S.Audio.init();
          const m = S.Audio.toggleMute();
          S.HUD.toast(m ? '已静音' : '已恢复声音');
        }
      });
    },

    /* ================= 开始 / 继续 ================= */
    beginNew() {
      if (this.started) return;
      try { S.Audio.init(); } catch (e) { console.warn('audio', e); }
      S.Audio.setTheme('plain');
      this.started = true;
      this.titleMode = false;
      S.HUD.fade(false);
      $('title').classList.add('gone');
      setTimeout(() => $('title').classList.add('hidden'), 1100);
      document.body.classList.add('cine');
      S.HUD.show(true);
      if (this.isTouch) { S.Touch.show(true); S.Touch.hint(); }
      clearTimeout(this._introHint);
      this._introHint = setTimeout(() => {
        if (S.HUD.dlg) S.HUD.hint(this.isTouch ? '轻触画面任意处　继续' : '点击画面任意处 / 空格　继续', 6);
      }, 4200);
      S.HUD.startScript(S.SCENES.intro, () => {
        document.body.classList.remove('cine');
      });
    },

    continueGame() {
      const s = S.Save.read();
      if (!s) return;
      try { S.Audio.init(); } catch (e) { console.warn('audio', e); }
      this.started = true;
      this.titleMode = false;
      $('title').classList.add('gone');
      setTimeout(() => $('title').classList.add('hidden'), 1100);
      S.HUD.show(true);
      if (this.isTouch) { S.Touch.show(true); S.Touch.hint(); }
      this.playerName = s.name || '衔星';
      this.fragsFound = s.frags || [];
      this.fragsFound.forEach((id) => { if (this.relics[id]) this.relics[id].got = true; });
      S.HUD.setFrag(this.fragsFound.length, 12);
      this.player.x = s.x || S.LM.start.x;
      this.player.y = s.y || S.LM.start.y;
      this.setStage(s.stage || 'wake', true);
      S.HUD.fade(false);
      S.HUD.toast('风记得你走到了哪里。');
    },

    /* ================= 阶段 ================= */
    setStage(s, silent) {
      this.stage = s;
      this.applyStageState(s);
      this.refreshQuest();
      if (!silent) this.save();
    },

    refreshQuest() {
      const info = STAGES[this.stage];
      if (!info) return;
      this.obj = info.obj;
      const m = S.LM[info.marker];
      this.marker = m ? { x: m.x, y: m.y } : null;
      S.HUD.setQuest({ chapter: info.ch, title: info.title, objs: [{ text: info.obj }] });
    },

    applyStageState(s) {
      const P = this.player;
      // 默认隐藏特殊 NPC
      this.npcBailu.hidden = true;
      this.npcAche.hidden = true;
      this.npcLan.hidden = true;
      this.npcQingwu.hidden = s === 'wake' || s === 'toVillage';
      this.npcSun.hidden = s === 'wake' || s === 'toVillage';
      this.npcQingwu.x = S.LM.qingwuSpot.x; this.npcQingwu.y = S.LM.qingwuSpot.y;
      this.npcSun.x = S.LM.sunSpot.x; this.npcSun.y = S.LM.sunSpot.y;
      this.npcLan.x = 2806; this.npcLan.y = 3006;
      this.npcQingwu.follow = false;

      switch (s) {
        case 'wake':
          this.npcQingwu.hidden = true; this.npcSun.hidden = true;
          break;
        case 'toVillage':
          this.npcQingwu.hidden = true; this.npcSun.hidden = true;
          break;
        case 'elder':
          this.npcSun.hidden = false;
          break;
        case 'toStele':
          this.npcSun.hidden = false;
          break;
        case 'backVillage':
          this.npcQingwu.hidden = false;
          this.npcSun.hidden = false;
          break;
        case 'raid':
          this.npcQingwu.hidden = false;
          this.npcSun.hidden = false;
          break;
        case 'toBridge':
          this.npcQingwu.hidden = false;
          this.npcQingwu.follow = true;
          this.npcSun.hidden = false;
          break;
        case 'lanFight':
          this.npcQingwu.hidden = false;
          this.npcQingwu.follow = true;
          this.npcLan.hidden = false;
          break;
        case 'toRuins':
          this.npcQingwu.follow = true;
          this.npcLan.hidden = true;
          break;
        case 'boss1':
          this.npcQingwu.hidden = false;
          this.npcQingwu.follow = false;
          this.npcQingwu.x = S.LM.ruins.x + 210; this.npcQingwu.y = S.LM.ruins.y + 210;
          break;
        case 'toCourt':
          this.npcLan.hidden = false;
          this.npcLan.x = 4980; this.npcLan.y = 2480;
          this.npcQingwu.hidden = false;
          this.npcQingwu.x = 5010; this.npcQingwu.y = 2604;
          break;
        case 'toObs':
          this.npcLan.hidden = false;
          this.npcLan.x = S.LM.observatory.x - 70;
          this.npcLan.y = S.LM.observatory.y + 160;
          this.npcQingwu.x = S.LM.observatory.x - 120;
          this.npcQingwu.y = S.LM.observatory.y + 220;
          break;
        case 'boss2':
          this.npcBailu.hidden = false;
          this.npcBailu.x = S.LM.observatory.x + 60;
          this.npcBailu.y = S.LM.observatory.y - 180;
          break;
      }
    },

    save() {
      S.Save.write({
        stage: this.stage,
        frags: this.fragsFound,
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        name: this.playerName,
        t: Date.now()
      });
    },

    /* ================= 动作（剧情脚本调用） ================= */
    act(a, v) {
      switch (a) {
        case 'startGame':
          this.setStage('wake');
          S.HUD.setFrag(0, 12);
          S.HUD.toast('醒来。');
          this.locked = false;
          setTimeout(() => S.HUD.hint('WASD 移动 · F 交互'), 1200);
          return;
        case 'objective':
          this.obj = v;
          const info = STAGES[this.stage];
          S.HUD.setQuest({ chapter: info ? info.ch : '', title: info ? info.title : '', objs: [{ text: v }] });
          return;
        case 'hint':
          S.HUD.hint(v, 4);
          return;
        case 'stage':
          this.setStage(v);
          return;
        case 'frag':
          this.giveFrag(parseInt(v, 10));
          return;
        case 'setName':
          this.playerName = v || '衔星';
          S.HUD.toast('你记住了这个名字：' + this.playerName);
          return;
        case 'echo':
          this.echoFx(parseInt(v, 10));
          return;
        case 'battle':
          this.startBattle(v);
          S.HUD.endScript();
          return 'wait';
        case 'ending':
          this.finish(v);
          return 'wait';
        case 'finalChoice':
          this.startFinalChoice();
          return 'wait';
      }
    },

    checkNeed(need) {
      if (!need) return true;
      if (need === 'frags>=8') return this.fragsFound.length >= 8;
      if (need.indexOf('frags>=') === 0) return this.fragsFound.length >= parseInt(need.split('>=')[1], 10);
      return true;
    },

    /* ================= 交互 ================= */
    interact() {
      if (S.HUD.dlg) return;
      if (this.nearSpecial) { this.nearSpecial(); return; }
      if (this.nearRelic) { this.pickRelic(this.nearRelic); return; }
      if (this.nearNpc) { this.talkTo(this.nearNpc); return; }
    },

    pickRelic(r) {
      r.got = true;
      this.giveFrag(r.f.id, true);
      R.flash = 0.28; R.flashColor = 'rgba(200,255,245,1)';
      S.Audio.sfx('echo');
      FX.burst(r.x, r.y, '#bff6ea');
      this.save();
    },

    giveFrag(id, quiet) {
      if (typeof id !== 'number' || isNaN(id)) return;
      if (this.fragsFound.indexOf(id) >= 0) return;
      this.fragsFound.push(id);
      this.relics.forEach((r) => { if (r.f.id === id) r.got = true; });
      S.HUD.setFrag(this.fragsFound.length, 12);
      const f = S.FRAGMENTS[id];
      S.HUD.toast('残响 · ' + f.title, 'echo');
      const p = this.player;
      if (p) {
        p.hp = Math.min(p.maxhp, p.hp + p.maxhp * 0.22);
        p.en = Math.min(p.maxen, p.en + 24);
      }
      if (quiet) S.HUD.toast('已收录于残响录（Tab 查看）');
      if (this.fragsFound.length === 12) {
        setTimeout(() => S.HUD.toast('十二片残响齐了。你能听见整件事了。'), 900);
      }
    },

    echoFx(n) {
      R.flash = 0.42; R.flashColor = 'rgba(210,255,248,1)';
      S.Audio.sfx('echo');
      R.Cam.kick(10);
      const p = this.player;
      FX.ring(p.x, p.y, 10, 320, '#cffff4', 0.9, 6);
      FX.ring(p.x, p.y, 10, 200, '#ffffff', 0.6, 3);
      FX.spawn(p.x, p.y, 40, { spd: 150, life: 1.6, size: 2.4, col: ['#bff6ea', '#fff6d8'], up: 70, grav: -12, drag: 0.97 });
      this.obj = n === 3 ? '星盘已完整。回望来路。' : this.obj;
    },

    talkTo(n) {
      if (n.bark) {
        const lines = S.BARKS[n.bark];
        const t = lines[n.barkIdx % lines.length];
        n.barkIdx++;
        S.HUD.startScript([{ w: 'villager', s: t }]);
        return;
      }
      const id = n.id;
      if (id === 'qingwu') {
        if (this.stage === 'elder' || this.stage === 'toStele') {
          S.HUD.startScript([
            { w: 'qingwu', s: '你还愣着做什么？隼爷爷在望星台等你呢。' },
            { w: 'qingwu', s: '……喂，你说，人要是被所有人忘了，还算活着吗？' },
            { w: 'qingwu', s: '算了。别回答。我怕听见答案。' }
          ]);
        } else if (this.stage === 'backVillage') {
          this.startScene('acheTalk');
        } else if (this.stage === 'toBridge' || this.stage === 'lanFight' || this.stage === 'toRuins') {
          S.HUD.startScript([
            { w: 'qingwu', s: '我跟着你。' },
            { w: 'qingwu', s: '不是我信你，是我一个人待着会更怕。' }
          ]);
        } else {
          S.HUD.startScript([{ w: 'qingwu', s: '嗯？走吧，我跟着。' }]);
        }
        return;
      }
      if (id === 'sun') {
        if (this.stage === 'elder') this.startScene('meetSun');
        else S.HUD.startScript([{ w: 'sun', s: '别看我。看路。' }]);
        return;
      }
      if (id === 'lan') {
        S.HUD.startScript([{ w: 'lan', s: '……走你的。' }]);
        return;
      }
      if (id === 'bailu') {
        S.HUD.startScript([{ w: 'bailu', s: '请大人登塔。名册在等您。' }]);
        return;
      }
    },

    startScene(name, onEnd) {
      const steps = S.SCENES[name];
      if (!steps) return;
      S.HUD.startScript(steps, onEnd);
    },

    /* ================= 战斗 ================= */
    startBattle(kind) {
      this.encounterActive = true;
      const P = this.player;
      if (kind === 'raid') {
        const V = S.LM.village;
        const spawns = [
          ['beast', V.x - 380, V.y - 200], ['beast', V.x + 400, V.y - 260],
          ['beast', V.x - 320, V.y + 320], ['beast', V.x + 360, V.y + 300],
          ['shade', V.x + 120, V.y - 430], ['shade', V.x - 460, V.y + 60],
          ['shade', V.x + 520, V.y + 80]
        ];
        spawns.forEach((s) => {
          const e = s[0] === 'beast' ? new S.Ent.Beast(s[1], s[2]) : new S.Ent.Shade(s[1], s[2]);
          e.aggro = 900;
          this.enemies.push(e);
        });
        this.stage = 'raid';
        this.refreshQuest();
        S.Audio.setTheme('court');
        S.HUD.toast('失名兽袭来了', 'warn');
        R.Cam.kick(10);
      } else if (kind === 'lan') {
        const lan = new S.Ent.DuelLan(2806, 2940);
        this.enemies.push(lan);
        this.duel = lan;
        this.npcLan.hidden = true;
        this.stage = 'lanFight';
        this.refreshQuest();
        S.HUD.bossShow('岚 · 试剑');
        S.HUD.toast('「先接我一剑。」');
      } else if (kind === 'boss1') {
        this.npcAche.hidden = true;
        this.npcQingwu.follow = false;
        const b = new S.Ent.BossShadow(S.LM.ruins.x + 40, S.LM.ruins.y - 130);
        this.enemies.push(b);
        this.boss = b;
        this.stage = 'boss1';
        this.refreshQuest();
        S.HUD.bossShow('蚀名之影');
        S.Audio.setTheme('sad');
        R.Cam.kick(14);
        S.HUD.toast('面具之下，空无一物', 'warn');
      } else if (kind === 'boss2') {
        this.npcBailu.hidden = true;
        const b = new S.Ent.BossBailu(S.LM.observatory.x + 40, S.LM.observatory.y - 210);
        this.enemies.push(b);
        this.boss = b;
        this.stage = 'boss2';
        this.refreshQuest();
        S.HUD.bossShow('白露 · 末席司祭');
        S.Audio.setTheme('court');
        R.Cam.kick(14);
        S.HUD.toast('她把名册抱在怀里，像抱一个孩子', 'warn');
      }
    },

    hitEnemies(src, x, y, range, dmg, ang, arc, force) {
      let hits = 0;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = S.dist(x, y, e.x, e.y);
        if (d > range + e.r) continue;
        if (arc < S.TAU && d > 34) {
          let da = Math.atan2(e.y - y, e.x - x) - ang;
          while (da > Math.PI) da -= S.TAU;
          while (da < -Math.PI) da += S.TAU;
          if (Math.abs(da) > arc / 2) continue;
        }
        const crit = Math.random() < 0.16;
        const a = Math.atan2(e.y - y, e.x - x);
        e.hurtBy(dmg * (crit ? 1.8 : 1), a, this, crit);
        if (force) e.knock(a, force);
        hits++;
      }
      if (hits > 0) {
        this.player.en = Math.min(this.player.maxen, this.player.en + 7 * hits);
        this.hitstop = 0.045;
      }
      return hits;
    },

    shockwave(x, y, r) {
      FX.ring(x, y, 10, r * 1.6, 'rgba(255,240,200,0.45)', 0.65, 4);
      const p = this.player;
      const d = S.dist(p.x, p.y, x, y);
      if (d < r * 1.9 && d > r * 0.7) {
        // 击退自己以外的单位（纯视觉）
      }
    },

    bossPhase(b, n) {
      S.HUD.toast(b.name + ' · 形态 ' + (n === 2 ? '二' : '三'), 'warn');
      R.Cam.kick(12);
      R.flash = 0.25; R.flashColor = n === 3 ? 'rgba(255,120,140,1)' : 'rgba(180,220,255,1)';
      FX.burst(b.x, b.y - 30, '#a8d8ff');
      S.Audio.sfx('burst');
    },

    /* ================= 关底回调 ================= */
    onEnemyDeath(e) {
      if (e.boss) return;
      // 能量球
      if (Math.random() < 0.5) {
        FX.spawn(e.x, e.y - 20, 1, { spd: 20, life: 1.4, size: 3, col: ['#9fe6d8'], up: 30, drag: 0.94 });
      }
    },

    onLanYield() {
      if (this.stage !== 'lanFight') return;
      S.HUD.bossHide();
      this.duel = null;
      this.enemies = this.enemies.filter((x) => !(x instanceof S.Ent.DuelLan));
      this.npcLan.hidden = false;
      this.npcLan.x = 2810; this.npcLan.y = 3010;
      this.stage = 'toRuins';
      this.refreshQuest();
      this.startScene('afterLan');
    },
    onBoss1Dead() {
      if (this.stage !== 'boss1') return;
      S.HUD.bossHide();
      this.boss = null;
      this.enemies = this.enemies.filter((x) => x.dead);
      this.npcAche.hidden = true;
      this.npcBailu.hidden = false;
      this.npcBailu.x = S.LM.ruins.x + 150; this.npcBailu.y = S.LM.ruins.y + 40;
      this.stage = 'toCourt';
      this.refreshQuest();
      this.startScene('afterBoss1', () => {
        setTimeout(() => this.startScene('bailu'), 380);
      });
    },
    onBoss2Dead() {
      if (this.stage !== 'boss2') return;
      S.HUD.bossHide();
      this.boss = null;
      this.enemies = this.enemies.filter((x) => x.dead);
      this.stage = 'choice';
      this.refreshQuest();
      S.Audio.setTheme('sad');
      this.startScene('afterBoss2', () => {
        setTimeout(() => this.startFinalChoice(), 700);
      });
    },

    onPlayerDown() {
      S.HUD.toast('你倒下了……', 'warn');
      this.slowmo(1.0, 0.35);
      setTimeout(() => {
        const p = this.player;
        p.hp = p.maxhp * 0.62;
        p.dead = false;
        p.inv = 2.2;
        p.x = S.clamp(p.x, 100, S.World.W - 100);
        p.y = S.clamp(p.y, 100, S.World.H - 100);
        if (!S.free(p.x, p.y, p.r)) { p.x = S.LM.village.x; p.y = S.LM.village.y; }
        FX.burst(p.x, p.y, '#bff6ea');
        R.flash = 0.5; R.flashColor = 'rgba(180,240,230,1)';
        S.HUD.toast('风又把你扶了起来。');
      }, 1100);
    },

    slowmo(t, k) { this.slowT = t; this.slowK = k; },

    startFinalChoice() {
      const n = this.fragsFound.length;
      S.HUD.startScript([{
        n: '风从塔心灌下来。你听见有千万个声音，在同一个地方微微地响。'
      }, {
        choice: [
          { s: '续约 —— 取走云栖村的名字，换长庚百年安宁', a: 'ending', v: 'renew' },
          { s: '断环 —— 击碎星环，把所有名字还给所有人', a: 'ending', v: 'break' },
          {
            s: '记名 —— 把所有人的名字刻进自己，成为新的星环', a: 'ending', v: 'remember',
            need: 'frags>=8', lockHint: '残响不足（' + n + ' / 12，需 8 片）'
          }
        ]
      }]);
    },

    finish(key) {
      this.ended = true;
      this.endingKey = key;
      this.locked = true;
      S.HUD.endScript();
      S.HUD.fade(true);
      document.body.classList.remove('cine');
      setTimeout(() => {
        S.HUD.fade(false);
        S.HUD.showEnding(key);
        S.Audio.setTheme(key === 'break' ? 'sad' : 'star');
        S.HUD.toggleHud(false);
      if (S.Touch.on) S.Touch.show(false);
      }, 1500);
    },

    /* ================= 触发 ================= */
    updateTriggers() {
      const p = this.player;
      const s = this.stage;
      if (S.HUD.dlg) return;
      const near = (x, y, r) => S.dist(p.x, p.y, x, y) < r;
      const P = S.LM;
      switch (s) {
        case 'toVillage':
          if (near(P.qingwuSpot.x, P.qingwuSpot.y - 30, 270)) {
            this.npcQingwu.hidden = false;
            this.startScene('meetQingwu');
          }
          break;
        case 'toStele':
          if (near(P.stele.x, P.stele.y, 300)) this.startScene('echo1');
          break;
        case 'toBridge':
          if (near(P.bridge1.x, P.bridge1.y, 290)) {
            this.npcLan.hidden = false;
            this.npcLan.x = 2806; this.npcLan.y = 3006;
            this.startScene('meetLan');
          }
          break;
        case 'toRuins':
          if (near(P.ruins.x, P.ruins.y, 340)) {
            this.npcAche.hidden = false;
            this.npcAche.x = P.ruins.x - 20; this.npcAche.y = P.ruins.y - 120;
            this.npcQingwu.follow = false;
            this.npcQingwu.x = P.ruins.x + 190; this.npcQingwu.y = P.ruins.y + 170;
            this.startScene('ruins');
          }
          break;
        case 'toCourt':
          if (near(P.chasmBridge.x, P.chasmBridge.y, 240)) {
            this.npcLan.hidden = false;
            this.startScene('court');
          }
          break;
        case 'toObs':
          if (near(P.observatory.x, P.observatory.y, 320)) {
            this.startScene('truth', () => {
              setTimeout(() => this.startScene('bailu2', () => this.startBattle('boss2')), 400);
            });
          }
          break;
      }
    },

    /* 地标独白 */
    checkSpots() {
      if (!this.spotsSeen) this.spotsSeen = {};
      const SPOTS = [
        ['crater', S.LM.crater.x, S.LM.crater.y, 320], ['villageGate', 1330, 3560, 320], ['stele', 2040, 2230, 330],
        ['bridge', 2760, 3060, 260], ['ruins', 4060, 1540, 340], ['chasm', 5030, 2440, 280],
        ['court', 5700, 2500, 420], ['observatory', 6250, 2400, 420]
      ];
      const p = this.player;
      for (const s of SPOTS) {
        if (this.spotsSeen[s[0]]) continue;
        if (S.dist(p.x, p.y, s[1], s[2]) < s[3]) {
          this.spotsSeen[s[0]] = 1;
          const line = S.SOLILOQUY[s[0]];
          if (line) S.HUD.hint(line, 5.2);
        }
      }
    },

    /* ================= 主循环 ================= */
    loop(now) {
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.06) dt = 0.06;
      if (dt < 0) dt = 0;
      this.watchdog(dt);
      try { this.update(dt); } catch (err) { this.onFrameError(err); }
      try { this.render(); } catch (err) { this.onFrameError(err); }
      S.Input.endFrame();
      requestAnimationFrame(this.loopBound);
    },

    /* 自适应画质：连续掉帧就降一档 */
    watchdog(dt) {
      if (!this.started || this.titleMode) return;
      const inst = 1 / Math.max(dt, 0.0001);
      this._fpsAcc = this._fpsAcc === undefined ? inst : (this._fpsAcc * 0.9 + inst * 0.1);
      if (R.t < 5) return;
      this._qTick = (this._qTick || 0) + 1;
      if (this._qTick < 150) return;
      this._qTick = 0;
      if (this._fpsAcc < 44 && (this._qLevel || 0) < 2) this.degrade();
    },

    degrade() {
      this._qLevel = (this._qLevel || 0) + 1;
      if (this._qLevel === 1) {
        S.Render.noBloom = true;
        S.QUALITY.particles = 0.4;
        S.QUALITY.grassCell = (S.QUALITY.grassCell || 17) + 7;
      } else {
        S.QUALITY.dpr = 1;
        S.Render.resize();
        S.QUALITY.particles = 0.25;
      }
      console.log('[quality] -> level ' + this._qLevel, Math.round(this._fpsAcc) + 'fps');
    },

    onFrameError(err) {
      if (!this._errCount) this._errCount = 0;
      this._errCount++;
      if (this._errCount <= 3) console.error('[frame]', err);
      if (this._errCount === 1) S.HUD.toast('检测到一处运行异常，已跳过', 'warn');
    },

    update(dt) {
      R.t += dt;
      S.Audio.tick();
      // 时间缩放
      let sdt = dt;
      if (this.slowT > 0) { this.slowT -= dt; sdt *= this.slowK; }
      if (this.hitstop > 0) { this.hitstop -= dt; sdt *= 0.18; }

      if (this.titleMode) {
        // 标题页：镜头缓慢漂移
        R.Cam.x = 1620 + Math.sin(R.t * 0.06) * 260;
        R.Cam.y = 2860 + Math.cos(R.t * 0.05) * 140;
        R.Cam.z = 1.22;
        this.player.t += dt;
        FX.update(dt);
        this.ambient(dt * 0.5);
        this.updateMood();
        return;
      }

      this.locked = !!S.HUD.dlg;
      const p = this.player;

      // 输入：交互
      if (!this.locked && (S.Input.hit('f') || S.Input.hit('space'))) {
        this.interact();
      }
      if (this.locked && (S.Input.hit('f') || S.Input.hit('e'))) S.HUD.advance();
      if (this.locked && S.Input.hit('space')) S.HUD.advance();

      p.update(sdt, this);

      // 实体
      const focused = this.locked ? 0.25 : 1;
      for (const e of this.enemies) e.update(sdt * focused, this);
      this.enemies = this.enemies.filter((e) => !(e.dead && e.deatht <= 0));
      for (const n of this.npcs) n.update(sdt, this);
      for (const r of this.relics) r.update(sdt, this);

      // 弹幕
      for (const b of this.projectiles) b.update(sdt, this);
      this.projectiles = this.projectiles.filter((b) => !b.dead);

      // 环
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.r += r.spd * sdt;
        if (!r.hit) {
          const d = S.dist(p.x, p.y, r.x, r.y);
          if (Math.abs(d - r.r) < 34) { p.damage(r.dmg, this, r.x, r.y); r.hit = true; }
        }
        if (r.r > r.max) this.rings.splice(i, 1);
      }
      // 光柱
      for (let i = this.pillars.length - 1; i >= 0; i--) {
        const pl = this.pillars[i];
        pl.t += sdt;
        if (pl.t > pl.warn && !pl.fired) {
          pl.fired = true;
          FX.beam(pl.x, pl.y, 'rgba(255,244,216,0.85)', 0.55);
          FX.ring(pl.x, pl.y, 10, 90, 'rgba(255,240,200,0.7)', 0.5, 4);
          R.Cam.kick(4);
          S.Audio.sfx('hit');
          if (S.dist(p.x, p.y, pl.x, pl.y) < 70) p.damage(pl.dmg, this, pl.x, pl.y);
        }
        if (pl.t > pl.warn + 0.8) this.pillars.splice(i, 1);
      }
      // 星落
      for (let i = this.delayedStars.length - 1; i >= 0; i--) {
        const s2 = this.delayedStars[i];
        s2.t -= sdt;
        if (s2.t <= 0) {
          FX.beam(s2.x, s2.y, 'rgba(255,244,200,0.9)', 0.5);
          FX.burst(s2.x, s2.y, '#ffe9b0');
          R.Cam.kick(5);
          this.hitEnemies(this, s2.x, s2.y, 110, 40, 0, S.TAU, 200);
          this.delayedStars.splice(i, 1);
        }
      }

      FX.update(sdt);
      this.ambient(sdt);

      // 相机
      R.Cam.z = S.lerp(R.Cam.z, this.locked ? 1.34 : 1.25, 1 - Math.pow(0.004, dt));
      const lead = 0.18;
      let tx = p.x + p.vx * lead, ty = p.y + p.vy * lead - 30;
      // 边界约束
      const hw = (R.W / 2) / R.Cam.z - 150;
      const hh1 = R.colShift / (R.Cam.z * 0.9) - 120;
      const hh2 = (R.H - R.colShift) / (R.Cam.z * 0.9) - 120;
      tx = S.clamp(tx, hw, S.World.W - hw);
      ty = S.clamp(ty, hh1, S.World.H - hh2);
      if (this.locked && this.camLock) {
        R.Cam.follow(this.camLock.x, this.camLock.y, dt, 1.4);
      } else {
        R.Cam.follow(tx, ty, dt, 1.2);
      }

      // 交互检测
      this.scanInteract();

      // BOSS 血条
      if (this.boss && !this.boss.dead) S.HUD.bossHp(S.clamp(this.boss.hp / this.boss.maxhp, 0, 1), dt);
      if (this.duel && !this.duel.dead) S.HUD.bossHp(S.clamp(this.duel.hp / this.duel.maxhp, 0, 1), dt);

      // 触发
      if (!this.locked) this.updateTriggers();
      if (!this.locked) this.checkSpots();

      // 区域
      this.updateMood();

      // 战斗结束检测
      if (this.stage === 'raid') {
        if (this.enemies.filter((e) => !e.dead && !e.ambient).length === 0) {
          this.stage = 'toBridge';
          this.refreshQuest();
          S.Audio.setTheme('plain');
          this.startScene('afterRaid', () => {});
        }
      }

      // 任务距离
      if (this.marker) {
        const d = S.dist(p.x, p.y, this.marker.x, this.marker.y);
        const el = S.$('qDist');
        if (el) el.textContent = d > 100 ? '距目标 ' + Math.round(d / 10) * 10 + ' 步' : '就在附近';
      }

      S.HUD.update(dt, this);
      if (++S.HUD.minimapFrame % 2 === 0) S.HUD.drawMinimap(this);
    },

    updateMood() {
      const x = R.Cam.x;
      R.moodB = S.smoothstep(2350, 3100, x) * (1 - S.smoothstep(4650, 5250, x));
      R.moodC = S.smoothstep(4700, 5450, x);
      if (R.moodB > 0.5 && R.moodC < 0.5) R.mood = 1;
      else if (R.moodC > 0.5) R.mood = 2;
      else R.mood = 0;
      const reg = S.World.regionAt(this.player.x);
      if (this.lastRegion !== reg) {
        this.lastRegion = reg;
        const R2 = S.REGIONS[reg];
        S.HUD.setRegion(R2);
        if (this.started && !this.titleMode) {
          S.Audio.setTheme(R2.theme);
          S.HUD.fade(true);
          setTimeout(() => S.HUD.fade(false), 220);
          S.HUD.toast('—— ' + R2.name + ' ——');
        }
      }
    },

    scanInteract() {
      const p = this.player;
      this.nearNpc = null; this.nearRelic = null; this.nearSpecial = null;
      let best = 999;
      if (!this.locked) {
        for (const n of this.npcs) {
          if (n.hidden || n.follow) continue;
          const d = S.dist(p.x, p.y, n.x, n.y);
          if (d < 86 && d < best) { best = d; this.nearNpc = n; }
        }
        for (const r of this.relics) {
          if (r.got) continue;
          const d = S.dist(p.x, p.y, r.x, r.y);
          if (d < 74 && d < best) { best = d; this.nearRelic = r; this.nearNpc = null; }
        }
        // 星盘
        if (this.stage === 'wake') {
          const d = S.dist(p.x, p.y, S.LM.crater.x, S.LM.crater.y);
          if (d < 140) {
            this.nearSpecial = () => {
              this.nearSpecial = null;
              this.startScene('getCompass', () => {
                this.setStage('toVillage');
              });
            };
            this.interactLabel = '拾起星盘';
          }
        }
      }
      let label = '';
      if (this.nearSpecial) label = this.interactLabel || '查看';
      else if (this.nearRelic) label = '触碰星骸';
      else if (this.nearNpc) label = '交谈 · ' + (this.nearNpc.name || '村民');
      S.HUD.setInteract(this.locked ? '' : label);
      if (S.Touch.on) S.Touch.setInteract(!!label && !this.locked);
    },

    /* ================= 环境粒子 ================= */
    ambient(dt) {
      const reg = S.World.regionAt(S.Cam.x);
      const p = Math.random();
      const vr = R.visibleRect(120);
      const x = vr.x0 + Math.random() * (vr.x1 - vr.x0);
      const y = vr.y0 + Math.random() * (vr.y1 - vr.y0);
      if (reg === 'A') {
        if (p < dt * 8) FX.spawn(x, y, 1, { spd: 8, life: 5, size: 2.6, col: ['#f7e3ea', '#f3d6c8', '#ffffff'], type: 'petal', drag: 0.995, grav: 6, up: 0 });
        if (p > 0.98) FX.spawn(x, y, 1, { spd: 4, life: 4, size: 1.6, col: ['#fff8d0'], drag: 0.99, grav: -4 });
      } else if (reg === 'B') {
        if (p < dt * 10) FX.spawn(x, y, 1, { spd: 6, life: 6, size: 1.8, col: ['#dff0e8', '#bfe0d8'], drag: 0.99, grav: -3 });
      } else {
        if (p < dt * 12) FX.spawn(x, y, 1, { spd: 10, life: 4, size: 1.6, col: ['#8fd8ff', '#c8f0ff'], drag: 0.98, grav: -8, up: 10 });
        if (p > 0.985) FX.spawn(x, y, 1, { spd: 30, life: 3.4, size: 2.4, col: ['#c2667a', '#e8a3b4'], drag: 0.99, grav: -2, up: 20 });
      }
    },

    /* ================= 渲染 ================= */
    render() {
      const g = R.ctx;
      const W = R.W, H = R.H;
      g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      R.drawSky(g);

      if (!S.World.base) return;
      const dbg = this.qs && this.qs.get('dbg');
      if (dbg === 'nobloom' || (this.qs && this.qs.get('nobloom'))) S.Render.noBloom = true;
      if (dbg === 'base') { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); R.drawGround(g, this); return; }
      R.drawGround(g, this);

      const vr = R.visibleRect(300);
      const vis = S.World.propsInRect(vr.x0, vr.y0, vr.x1, vr.y1, this._propCache || (this._propCache = []));
      R.drawFlatProps(g, vis);
      R.drawWaterFX(g);

      // 阴影
      const items = [];
      const FLAT = { ruinFloor: 1, obsFloor: 1, field: 1, bridgeWood: 1, bridgeStone: 1, brokenBridge: 1 };
      for (const p of vis) {
        if (FLAT[p.t]) continue;
        items.push({ y: p.y, kind: 'prop', o: p });
      }
      for (const e of this.enemies) if (e.x > vr.x0 && e.x < vr.x1 && e.y > vr.y0 && e.y < vr.y1) items.push({ y: e.y, kind: 'ent', o: e });
      for (const n of this.npcs) if (!n.hidden && n.x > vr.x0 && n.x < vr.x1 && n.y > vr.y0 && n.y < vr.y1) items.push({ y: n.y, kind: 'ent', o: n });
      for (const r of this.relics) if (!r.got && r.x > vr.x0 && r.x < vr.x1 && r.y > vr.y0 && r.y < vr.y1) items.push({ y: r.y, kind: 'ent', o: r });
      if (!this.titleMode) items.push({ y: this.player.y, kind: 'ent', o: this.player });
      items.sort((a, b) => a.y - b.y);

      // 阴影层
      for (const it of items) {
        if (it.kind === 'ent') it.o.drawShadow(g);
        else this.propShadow(g, it.o);
      }

      R.drawGrass(g, this);
      R.drawWindStreaks(g);

      // 精灵层
      for (const it of items) {
        if (it.kind === 'prop') R.drawProp(g, it.o, this);
        else it.o.draw(g, this);
      }

      // 场景特效
      FX.draw(g, 'over');
      for (const b of this.projectiles) b.draw(g);
      for (const r of this.rings) this.drawRing(g, r);
      for (const pl of this.pillars) this.drawPillar(g, pl);

      // 任务光柱
      if (this.marker && !this.locked) this.drawMarker(g);

      R.post(g, this);
    },

    propShadow(g, p) {
      const s = p.s || 1;
      const map = {
        tree: [26, 11, 0.20], sakura: [24, 10, 0.18], pine: [20, 9, 0.20], dead: [14, 7, 0.16],
        rock: [20, 9, 0.22], house: [70, 30, 0.24], pharmacy: [70, 30, 0.24], tower: [26, 12, 0.22],
        gate: [40, 14, 0.20], stele: [16, 7, 0.22], steleBig: [34, 14, 0.26],
        column: [16, 7, 0.20], ruinWall: [90, 26, 0.22], arch: [34, 14, 0.16], archBig: [80, 26, 0.18],
        altar: [40, 16, 0.2], obsPillar: [18, 8, 0.24], crystal: [30, 12, 0.16],
        shard: [26, 10, 0.14], shardSmall: [10, 4, 0.12], lamp: [6, 3, 0.2],
        campfire: [18, 8, 0.2], well: [20, 9, 0.2], fence: [30, 10, 0.14], field: [0, 0, 0],
        stall: [46, 16, 0.22], board: [26, 8, 0.18], hay: [26, 11, 0.2], cart: [36, 14, 0.22], barrel: [10, 4, 0.2]
      };
      const m = map[p.t];
      if (!m || m[0] === 0) return;
      R.shadow(g, p.x, p.y, m[0] * s, m[1] * s, m[2]);
    },

    drawRing(g, r) {
      const x = R.sx(r.x), y = R.sy(r.y);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(${r.col},${0.35 + Math.sin(R.t * 20) * 0.12})`;
      g.lineWidth = 4 * R.Cam.z;
      g.beginPath(); g.ellipse(x, y, r.r * R.Cam.z, r.r * R.Cam.z * 0.55, 0, 0, S.TAU); g.stroke();
      g.strokeStyle = `rgba(${r.col},0.15)`;
      g.lineWidth = 12 * R.Cam.z;
      g.beginPath(); g.ellipse(x, y, r.r * R.Cam.z, r.r * R.Cam.z * 0.55, 0, 0, S.TAU); g.stroke();
      g.restore();
    },

    drawPillar(g, pl) {
      const x = R.sx(pl.x), y = R.sy(pl.y);
      const k = S.clamp(pl.t / pl.warn, 0, 1);
      g.save();
      g.globalCompositeOperation = 'lighter';
      if (!pl.fired) {
        g.strokeStyle = `rgba(255,240,200,${0.25 + k * 0.5})`;
        g.lineWidth = 2;
        g.beginPath(); g.ellipse(x, y, 60 * R.Cam.z, 26 * R.Cam.z, 0, 0, S.TAU); g.stroke();
        g.strokeStyle = `rgba(255,240,200,${0.12 + k * 0.3})`;
        g.beginPath(); g.ellipse(x, y, 60 * R.Cam.z * k, 26 * R.Cam.z * k, 0, 0, S.TAU); g.stroke();
      }
      g.restore();
    },

    drawMarker(g) {
      const m = this.marker;
      const x = R.sx(m.x), y = R.sy(m.y);
      const pulse = 0.55 + Math.sin(R.t * 2.4) * 0.2;
      g.save();
      g.globalCompositeOperation = 'lighter';
      const lg = g.createLinearGradient(x, y - 300 * R.Cam.z, x, y);
      lg.addColorStop(0, 'rgba(255,238,190,0)');
      lg.addColorStop(0.6, `rgba(255,238,190,${0.10 * pulse})`);
      lg.addColorStop(1, `rgba(255,246,214,${0.22 * pulse})`);
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(x - 16 * R.Cam.z, y);
      g.lineTo(x - 5 * R.Cam.z, y - 300 * R.Cam.z);
      g.lineTo(x + 5 * R.Cam.z, y - 300 * R.Cam.z);
      g.lineTo(x + 16 * R.Cam.z, y);
      g.closePath(); g.fill();
      g.strokeStyle = `rgba(255,240,200,${0.5 * pulse})`;
      g.lineWidth = 1.4;
      g.beginPath(); g.ellipse(x, y, 26 * R.Cam.z, 11 * R.Cam.z, 0, 0, S.TAU); g.stroke();
      g.restore();
      // 星形
      g.save();
      g.translate(x, y - 8 * R.Cam.z + Math.sin(R.t * 2) * 5);
      g.fillStyle = 'rgba(255,246,214,0.9)';
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * S.TAU - Math.PI / 2;
        const r = i % 2 ? 3 : 8;
        const xx = Math.cos(a) * r * R.Cam.z, yy = Math.sin(a) * r * R.Cam.z;
        i ? g.lineTo(xx, yy) : g.moveTo(xx, yy);
      }
      g.closePath(); g.fill();
      g.globalCompositeOperation = 'lighter';
      const gg = g.createRadialGradient(0, 0, 0, 0, 0, 26 * R.Cam.z);
      gg.addColorStop(0, `rgba(255,244,200,${0.4 * pulse})`);
      gg.addColorStop(1, 'rgba(255,244,200,0)');
      g.fillStyle = gg; g.beginPath(); g.arc(0, 0, 26 * R.Cam.z, 0, S.TAU); g.fill();
      g.restore();
    }
  };

  /* 加速：让玩家初始视野里有草 */
  window.addEventListener('DOMContentLoaded', () => {
    try {
      G.boot();
    } catch (err) {
      console.error(err);
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;inset:0;z-index:999;background:#100;color:#fcc;font:13px monospace;padding:24px;white-space:pre-wrap';
      d.textContent = '启动失败：\n' + (err && err.stack ? err.stack : err);
      document.body.appendChild(d);
    }
  });
  // 已加载完成时立即启动
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => { if (!G.started && G.stage === 'boot') { try { G.boot(); } catch (e) { console.error(e); } } }, 0);
  }
})();
