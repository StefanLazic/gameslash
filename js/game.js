/* Game shell: screens, camera, the main loop and every rule that ties it together. */
(function (global) {
  'use strict';
  const { TAU, clamp, lerp, rand, randInt, pick, dist, angleTo } = global.U;
  const { LEVELS, MUTATORS } = global.Levels;
  const { Player, Enemy, Projectile, Butterfly, Pickup, Particles } = global.Ent;

  const $ = (id) => document.getElementById(id);
  const SAVE_KEY = 'butterfly-blades-save';

  const Game = {
    canvas: null, ctx: null,
    time: 0, running: false, paused: false,
    world: { w: 1200, h: 800 },
    cam: { x: 0, y: 0, w: 640, h: 400, zoom: 1, tx: 0, ty: 0 },
    enemies: [], projectiles: [], butterflies: [], pickups: [], shockwaves: [], telegraphs: [], texts: [],
    particles: new Particles(),
    sisters: {}, player: null,
    level: null, levelIndex: 0, mutator: null, props: [],
    waveIndex: 0, waveDelay: 0, spawnsLeft: 0, carriersLeft: 0,
    rescued: 0, target: 0, portal: null, tookDamage: false,
    shakeAmount: 0, hitstopT: 0, swapCd: 0,
    speedMod: 1, enemyHpMod: 1, playerDmgMod: 1, countMod: 1, dropMod: 1, epBonus: 0,
    specialDiscount: 1, dark: false,
    best: 1,

    /* ------------------------------------------------------------- lifecycle */
    boot() {
      this.canvas = $('game');
      this.ctx = this.canvas.getContext('2d');
      global.Input.init();
      this.bindUI();
      this.resize();
      global.addEventListener('resize', () => this.resize());
      global.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.running) this.pause(true); });
      try { this.best = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}').best || 1; } catch (e) { this.best = 1; }
      ['sofija', 'emilija'].forEach((k) => {
        document.querySelectorAll('[data-portrait="' + k + '"]').forEach((c) => global.Art.drawPortrait(c, k));
      });
      this.titleFx();
      requestAnimationFrame((t) => this.frame(t));
    },

    bindUI() {
      const show = (id) => {
        document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
      };
      this.show = show;
      $('btn-start').addEventListener('click', () => { global.Sound.init(); show('screen-select'); });
      $('btn-howto').addEventListener('click', () => show('screen-howto'));
      document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => show('screen-title')));
      document.querySelectorAll('.hero').forEach((b) => {
        b.addEventListener('click', () => this.startRun(b.dataset.hero));
      });
      $('btn-pause').addEventListener('click', () => this.pause(!this.paused));
      $('btn-resume').addEventListener('click', () => this.pause(false));
      $('btn-quit').addEventListener('click', () => this.toMenu());
      $('btn-menu').addEventListener('click', () => this.toMenu());
      $('btn-retry').addEventListener('click', () => { show(''); this.startLevel(this.levelIndex, true); });
      $('btn-again').addEventListener('click', () => this.toMenu());
      $('hud-portrait').addEventListener('click', () => this.swapSister());
    },

    resize() {
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      const w = global.innerWidth, h = global.innerHeight;
      this.canvas.width = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
      this.dpr = dpr;
      const zoom = clamp(Math.sqrt((w * h) / (660 * 440)), 0.75, 2.6);
      this.cam.zoom = zoom;
      this.cam.w = w / zoom;
      this.cam.h = h / zoom;
      const bg = $('bg');
      bg.width = Math.floor(w * dpr); bg.height = Math.floor(h * dpr);
    },

    /* ------------------------------------------------------------ title mood */
    titleFx() {
      const c = $('bg'), ctx = c.getContext('2d');
      const flock = [];
      for (let i = 0; i < 26; i++) {
        flock.push({ x: rand(1), y: rand(1), s: rand(0.6, 1.6), sp: rand(0.02, 0.08), ph: rand(TAU), col: pick(global.Ent.BUTTERFLY_COLORS) });
      }
      const draw = (t) => {
        if (!document.body.classList.contains('playing')) {
          const w = c.width, h = c.height, dpr = this.dpr || 1;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#2b1445'); g.addColorStop(0.55, '#4a1f5e'); g.addColorStop(1, '#0d0718');
          ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const W = w / dpr, H = h / dpr;
          ctx.globalAlpha = 0.5;
          for (let i = 0; i < 60; i++) {
            const x = ((i * 97) % 100) / 100 * W;
            const y = ((i * 173) % 100) / 100 * H;
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = 0.1 + 0.25 * Math.abs(Math.sin(t * 0.001 + i));
            ctx.fillRect(x, y, 2, 2);
          }
          ctx.globalAlpha = 1;
          for (const f of flock) {
            f.x += Math.cos(t * 0.0004 + f.ph) * f.sp * 0.004;
            f.y += Math.sin(t * 0.0006 + f.ph) * f.sp * 0.003;
            if (f.x < -0.1) f.x = 1.1; if (f.x > 1.1) f.x = -0.1;
            if (f.y < -0.1) f.y = 1.1; if (f.y > 1.1) f.y = -0.1;
            global.Art.drawButterfly(ctx, f.x * W, f.y * H, t * 0.001 + f.ph, f.s * 1.5, f.col, true);
          }
        }
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
    },

    /* ---------------------------------------------------------------- run/UI */
    startRun(heroKey) {
      global.Sound.init();
      this.sisters = { sofija: new Player('sofija'), emilija: new Player('emilija') };
      this.player = this.sisters[heroKey];
      this.other = this.sisters[heroKey === 'sofija' ? 'emilija' : 'sofija'];
      this.show('');
      document.body.classList.add('playing');
      $('hud').hidden = false;
      $('touch').hidden = !this.isTouch();
      this.startLevel(0, true);
    },

    isTouch() {
      return global.matchMedia('(hover: none), (pointer: coarse)').matches || 'ontouchstart' in global;
    },

    toMenu() {
      this.running = false;
      this.paused = false;
      global.Sound.stopMusic();
      document.body.classList.remove('playing');
      $('hud').hidden = true;
      $('touch').hidden = true;
      $('boss-bar').hidden = true;
      global.Input.clear();
      this.show('screen-title');
    },

    pause(on) {
      if (!this.running) return;
      this.paused = on;
      this.show(on ? 'screen-pause' : '');
      global.Input.clear();
    },

    /* ---------------------------------------------------------------- levels */
    startLevel(index, resetHp) {
      this.levelIndex = clamp(index, 0, LEVELS.length - 1);
      const L = LEVELS[this.levelIndex];
      this.level = L;
      this.world = { w: L.world.w, h: L.world.h };
      this.props = global.Art.buildProps(L, this.world.w, this.world.h);
      this.enemies = []; this.projectiles = []; this.butterflies = [];
      this.pickups = []; this.shockwaves = []; this.telegraphs = []; this.texts = [];
      this.particles = new Particles();
      this.portal = null;
      this.waveIndex = -1;
      this.waveDelay = 1.4;
      this.rescued = 0;
      this.tookDamage = false;
      this.boss = null;

      // reset modifiers, then roll a mutator (level 1 is always calm)
      this.speedMod = 1; this.enemyHpMod = 1; this.playerDmgMod = 1;
      this.countMod = 1; this.dropMod = 1; this.epBonus = 0; this.specialDiscount = 1; this.dark = false;
      this.mutator = this.levelIndex === 0 ? MUTATORS[0] : pick(MUTATORS);
      this.mutator.apply(this);

      this.target = Math.round(L.butterflies * this.countMod);
      this.carriersLeft = this.target;
      this.spawnsLeft = this.plannedSpawns(L);

      for (const k in this.sisters) {
        const s = this.sisters[k];
        if (resetHp) { s.hp = s.maxHp; s.ep = 40; }
        else { s.hp = clamp(s.hp + s.maxHp * 0.3, 1, s.maxHp); s.ep = clamp(s.ep + 30, 0, s.maxEp); }
        s.state = s.hp > 0 ? 'idle' : 'down';
        s.vx = s.vy = 0;
        s.x = this.world.w / 2; s.y = this.world.h / 2;
      }
      if (!this.player.alive) this.swapSister(true);
      this.player.x = this.world.w / 2;
      this.player.y = this.world.h / 2;
      this.cam.x = this.player.x - this.cam.w / 2;
      this.cam.y = this.player.y - this.cam.h / 2;

      this.running = true;
      this.paused = false;
      this.show('');
      this.updateHud();
      this.levelCard(L);
      global.Sound.startMusic(L.waves.some((w) => w.boss) ? 'boss' : 'fight');
      this.saveBest();
    },

    plannedSpawns(L) {
      let n = 0;
      for (const w of L.waves) {
        n += Math.round((w.count || 0) * this.countMod);
        if (w.boss || w.miniBoss) n += 1;
      }
      return n;
    },

    levelCard(L) {
      const card = $('level-card');
      $('card-title').textContent = 'Level ' + L.id + ' — ' + L.name;
      const sub = $('card-sub');
      sub.textContent = '';
      sub.appendChild(document.createTextNode(L.sub));
      sub.appendChild(document.createElement('br'));
      const b = document.createElement('b');
      b.style.color = '#ffd479';
      b.textContent = this.mutator.name;
      sub.appendChild(b);
      sub.appendChild(document.createTextNode(' — ' + this.mutator.desc));
      card.hidden = false;
      clearTimeout(this._cardT);
      this._cardT = setTimeout(() => { card.hidden = true; }, 2600);
    },

    saveBest() {
      this.best = Math.max(this.best, this.level.id);
      try { localStorage.setItem(SAVE_KEY, JSON.stringify({ best: this.best })); } catch (e) { /* ignore */ }
    },

    nextWave() {
      this.waveIndex++;
      const L = this.level;
      if (this.waveIndex >= L.waves.length) return;
      const w = L.waves[this.waveIndex];
      const count = Math.round((w.count || 0) * this.countMod);
      for (let i = 0; i < count; i++) {
        const t = pick(w.types || ['wraith']);
        const pos = this.edgeSpawn();
        this.spawnEnemy(t, pos.x, pos.y, w.tier || 1, true);
      }
      if (w.miniBoss || w.boss) {
        const pos = this.edgeSpawn(240);
        const e = this.spawnEnemy(w.miniBoss || w.boss, pos.x, pos.y, w.tier || 1, true, w.boss ? 3 : 2);
        this.boss = e;
        $('boss-bar').hidden = false;
        $('boss-name').textContent = e.name;
        this.toast(e.name + '\nappears!');
        global.Sound.bossRoar();
        global.Sound.startMusic('boss');
        this.shake(20);
      } else if (this.waveIndex > 0) {
        this.toast('Wave ' + (this.waveIndex + 1));
      }
    },

    edgeSpawn(minDist) {
      const md = minDist || 180;
      for (let i = 0; i < 40; i++) {
        const x = rand(60, this.world.w - 60);
        const y = rand(60, this.world.h - 60);
        if (dist(x, y, this.player.x, this.player.y) > md) return { x, y };
      }
      return { x: rand(60, this.world.w - 60), y: 60 };
    },

    spawnEnemy(type, x, y, tier, allowCarrier, forceCarriers) {
      const e = new Enemy(type, clamp(x, 40, this.world.w - 40), clamp(y, 40, this.world.h - 40), tier);
      e.maxHp = Math.max(1, Math.round(e.maxHp * this.enemyHpMod));
      e.hp = e.maxHp;
      if (forceCarriers) {
        e.carries = true;
        e.carryCount = Math.min(forceCarriers, this.carriersLeft);
        this.carriersLeft -= e.carryCount;
        if (e.carryCount <= 0) e.carries = false;
      } else if (allowCarrier && this.carriersLeft > 0) {
        const chance = this.carriersLeft / Math.max(1, this.spawnsLeft);
        if (Math.random() < chance) {
          e.carries = true;
          e.carryCount = 1;
          this.carriersLeft--;
        }
      }
      if (allowCarrier) this.spawnsLeft = Math.max(0, this.spawnsLeft - 1);
      // spawn puff
      this.particles.ring(e.x, e.y - e.r, 18, e.palette.glow, 12);
      this.enemies.push(e);
      return e;
    },

    /* ------------------------------------------------------------- callbacks */
    onEnemyDeath(e) {
      this.player.addEp(e.type.ep + this.epBonus);
      if (e.carries) {
        for (let i = 0; i < (e.carryCount || 1); i++) {
          const b = new Butterfly(e.x + rand(-14, 14), e.y, e.butterflyColor);
          b.delay = 0.4 + i * 0.12;
          this.butterflies.push(b);
        }
      }
      const roll = Math.random() * (1 / Math.max(0.2, this.dropMod));
      if (roll < 0.1) this.pickups.push(new Pickup(e.x, e.y, 'heart'));
      else if (roll < 0.22) this.pickups.push(new Pickup(e.x, e.y, 'flutter'));
      else if (roll < 0.27) this.pickups.push(new Pickup(e.x, e.y, 'nectar'));

      if (e === this.boss) {
        this.boss = null;
        $('boss-bar').hidden = true;
        this.shake(24);
        this.hitstop(0.25);
        this.toast('The keeper falls!');
        global.Sound.levelUp();
        global.Sound.startMusic('fight');
        for (let i = 0; i < 5; i++) {
          setTimeout(() => this.particles.burst(e.x + rand(-40, 40), e.y + rand(-40, 10), 20, e.palette.glow), i * 120);
        }
      }
      this.updateHud();
    },

    onButterflyRescued() {
      this.rescued++;
      global.Sound.rescue();
      this.particles.burst(this.player.x, this.player.y - 26, 12, '#ffe9a8');
      this.player.heal(3);
      this.player.addEp(6);
      this.updateHud();
      if (this.rescued >= this.target && this.waveIndex >= this.level.waves.length - 1 && this.enemies.length === 0) {
        this.openPortal();
      }
    },

    onPickup(p) {
      global.Sound.pickup();
      if (p.type === 'heart') { this.player.heal(28); this.floatText(p.x, p.y - 10, '+28 HP', '#ff9ec4'); }
      else if (p.type === 'flutter') { this.player.addEp(40); this.floatText(p.x, p.y - 10, '+40 Flutter', '#9fe6ff'); }
      else {
        this.player.rageT = 9;
        this.floatText(p.x, p.y - 10, 'NECTAR RUSH!', '#ffd479');
        this.toast('Nectar Rush! Damage up.');
      }
      this.updateHud();
    },

    onSisterDown(sister) {
      const other = sister === this.sisters.sofija ? this.sisters.emilija : this.sisters.sofija;
      this.shake(20);
      this.particles.burst(sister.x, sister.y - 20, 30, '#ff5f88');
      if (other.alive) {
        this.toast(sister.name + ' falls!\n' + other.name + ' takes over!');
        setTimeout(() => this.swapSister(true), 400);
      } else {
        this.gameOver();
      }
    },

    swapSister(force) {
      if (!this.running) return;
      const other = this.player === this.sisters.sofija ? this.sisters.emilija : this.sisters.sofija;
      if (!other.alive) { if (!force) this.toast(other.name + ' cannot fight!'); return; }
      if (!force && (this.swapCd > 0 || !this.player.alive && false)) return;
      other.x = this.player.x; other.y = this.player.y;
      other.facing = this.player.facing;
      other.state = 'idle'; other.stateT = 0;
      other.invuln = Math.max(other.invuln, 0.6);
      other.vx = other.vy = 0;
      this.player = other;
      this.swapCd = force ? 0.6 : 1.2;
      this.particles.ring(other.x, other.y - 16, 34, other.key === 'sofija' ? '#ff9ecb' : '#9fd8ff', 22);
      this.shake(6);
      global.Sound.dodge();
      // a swap shoves nearby foes back - rewards tagging in under pressure
      for (const e of this.enemies) {
        if (dist(e.x, e.y, other.x, other.y) < 90) e.damage(6, other.x, other.y, 180, 0.2, this);
      }
      this.updateHud();
    },

    openPortal() {
      if (this.portal) return;
      this.portal = { x: this.world.w / 2, y: this.world.h / 2, t: 0 };
      global.Sound.levelUp();
      this.toast('Every wing is free!\nStep into the light.');
      if (!this.tookDamage) {
        this.player.heal(40);
        this.floatText(this.player.x, this.player.y - 40, 'FLAWLESS +40 HP', '#ffd479');
      }
    },

    completeLevel() {
      this.running = false;
      global.Sound.levelUp();
      if (this.levelIndex >= LEVELS.length - 1) {
        this.win();
      } else {
        const next = this.levelIndex + 1;
        setTimeout(() => this.startLevel(next, false), 500);
      }
    },

    win() {
      global.Sound.stopMusic();
      this.running = false;
      $('win-text').textContent =
        'Sofija and Emilija carried every stolen wing back into the sky. ' +
        'The night hums, and the butterflies remember their names.';
      this.show('screen-win');
    },

    gameOver() {
      this.running = false;
      global.Sound.stopMusic();
      $('over-title').textContent = 'Both sisters have fallen…';
      $('over-text').textContent = 'Level ' + this.level.id + ' — ' + this.level.name +
        ' · butterflies saved: ' + this.rescued + '/' + this.target;
      setTimeout(() => this.show('screen-over'), 700);
    },

    /* ------------------------------------------------------------- utilities */
    shake(v) { this.shakeAmount = Math.min(28, this.shakeAmount + v); },
    hitstop(v) { this.hitstopT = Math.max(this.hitstopT, v); },
    floatText(x, y, text, color) { this.texts.push({ x, y, text: String(text), color, life: 0.8 }); },
    toast(msg) {
      const el = $('toast');
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => el.classList.remove('show'), 1500);
    },
    shoot(x, y, angle, speed, dmg, color) {
      this.projectiles.push(new Projectile(x, y, angle, speed, dmg, color));
    },
    telegraph(x, y, r, life, color) { this.telegraphs.push({ x, y, r, life, max: life, color }); },
    telegraphBeam(src, angleFn, life) { this.telegraphs.push({ src, angleFn, life, max: life, beam: true, color: '#fff3b0' }); },
    clampToWorld(o) {
      o.x = clamp(o.x, o.r, this.world.w - o.r);
      o.y = clamp(o.y, o.r + 6, this.world.h - o.r);
    },

    updateHud() {
      const p = this.player;
      $('hud-name').textContent = p.name + (p.rageT > 0 ? ' ⚡' : '');
      $('bar-hp').style.width = clamp((p.hp / p.maxHp) * 100, 0, 100) + '%';
      $('bar-ep').style.width = clamp((p.ep / p.maxEp) * 100, 0, 100) + '%';
      $('hud-level').textContent = 'Level ' + this.level.id + ' · ' + this.level.name;
      $('hud-butterflies').textContent = '🦋 ' + this.rescued + ' / ' + this.target;
      if (this._hudFace !== p.key) {
        global.Art.drawPortrait($('hud-face'), p.key);
        this._hudFace = p.key;
      }
      if (this.boss) {
        $('bar-boss').style.width = clamp((this.boss.hp / this.boss.maxHp) * 100, 0, 100) + '%';
      }
    },

    /* ------------------------------------------------------------------ loop */
    frame(now) {
      requestAnimationFrame((t) => this.frame(t));
      const last = this._last || now;
      this._last = now;
      let dt = Math.min((now - last) / 1000, 0.05);
      if (!this.running || this.paused) return;
      this.update(dt);
      this.render();
    },

    update(dt) {
      if (this.hitstopT > 0) {
        this.hitstopT -= dt;
        dt *= 0.15;
      }
      this.time += dt;
      this.swapCd = Math.max(0, this.swapCd - dt);

      if (global.Input.pressed('pause')) { this.pause(true); global.Input.endFrame(); return; }
      if (global.Input.pressed('swap') && this.swapCd === 0) this.swapSister();

      const hpBefore = this.player.hp;
      this.player.update(dt, this, true);
      if (this.player.hp < hpBefore) this.tookDamage = true;
      this.other = this.player === this.sisters.sofija ? this.sisters.emilija : this.sisters.sofija;

      for (const e of this.enemies) e.update(dt, this);
      this.separate();
      for (const p of this.projectiles) p.update(dt, this);
      for (const b of this.butterflies) b.update(dt, this);
      for (const p of this.pickups) p.update(dt, this);
      this.particles.update(dt);

      // shockwaves
      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        const s = this.shockwaves[i];
        s.r += (s.max * 2.6) * dt;
        if (s.hostile) {
          const p = this.player;
          if (!s.hitPlayer && Math.abs(dist(s.x, s.y, p.x, p.y) - s.r) < 24) {
            s.hitPlayer = true;
            p.damage(s.dmg, s.x, s.y, this);
          }
        } else {
          for (const e of this.enemies) {
            if (e.dead || s.hits.has(e)) continue;
            if (Math.abs(dist(s.x, s.y, e.x, e.y) - s.r) < 30 + e.r) {
              s.hits.add(e);
              e.damage(s.dmg, s.x, s.y, 320, 0.8, this);
            }
          }
        }
        if (s.r >= s.max) this.shockwaves.splice(i, 1);
      }

      for (let i = this.telegraphs.length - 1; i >= 0; i--) {
        this.telegraphs[i].life -= dt;
        if (this.telegraphs[i].life <= 0) this.telegraphs.splice(i, 1);
      }
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.life -= dt; t.y -= 26 * dt;
        if (t.life <= 0) this.texts.splice(i, 1);
      }

      this.enemies = this.enemies.filter((e) => !e.dead);
      this.projectiles = this.projectiles.filter((p) => !p.dead);
      this.butterflies = this.butterflies.filter((b) => !b.dead);
      this.pickups = this.pickups.filter((p) => !p.dead);

      // waves
      if (this.waveDelay > 0) {
        this.waveDelay -= dt;
        if (this.waveDelay <= 0) this.nextWave();
      } else if (this.enemies.length === 0 && this.waveIndex < this.level.waves.length - 1) {
        this.waveDelay = 1.6;
      } else if (this.enemies.length === 0 && this.waveIndex >= this.level.waves.length - 1 &&
                 this.butterflies.length === 0 && this.rescued >= this.target) {
        this.openPortal();
      } else if (this.enemies.length === 0 && this.carriersLeft > 0 &&
                 this.waveIndex >= this.level.waves.length - 1) {
        // safety net: never soft-lock if carriers never spawned
        const pos = this.edgeSpawn();
        this.spawnEnemy('beetle', pos.x, pos.y, 1.2, false, this.carriersLeft);
      }

      // portal
      if (this.portal) {
        this.portal.t += dt;
        if (dist(this.player.x, this.player.y, this.portal.x, this.portal.y) < 42) {
          this.portal = null;
          this.completeLevel();
        }
      }

      // camera
      const cam = this.cam;
      const lookX = this.player.x + Math.cos(this.player.facing) * 26;
      const lookY = this.player.y + Math.sin(this.player.facing) * 26;
      cam.tx = lookX - cam.w / 2;
      cam.ty = lookY - cam.h / 2;
      cam.x = lerp(cam.x, cam.tx, clamp(dt * 6, 0, 1));
      cam.y = lerp(cam.y, cam.ty, clamp(dt * 6, 0, 1));
      cam.x = this.world.w > cam.w ? clamp(cam.x, -20, this.world.w - cam.w + 20) : (this.world.w - cam.w) / 2;
      cam.y = this.world.h > cam.h ? clamp(cam.y, -30, this.world.h - cam.h + 30) : (this.world.h - cam.h) / 2;

      this.shakeAmount = Math.max(0, this.shakeAmount - dt * 60);
      this.updateHud();
      global.Input.endFrame();
    },

    /** Cheap separation so monsters do not stack into one blob. */
    separate() {
      const list = this.enemies;
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.01;
          const min = a.r + b.r;
          if (d < min) {
            const push = (min - d) / d * 0.5;
            const wa = 1 / a.weight, wb = 1 / b.weight;
            const tot = wa + wb;
            a.x -= dx * push * (wa / tot); a.y -= dy * push * (wa / tot);
            b.x += dx * push * (wb / tot); b.y += dy * push * (wb / tot);
          }
        }
      }
    },

    /* ---------------------------------------------------------------- render */
    render() {
      const ctx = this.ctx, cam = this.cam;
      const shake = this.shakeAmount;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.save();
      ctx.scale(this.dpr * cam.zoom, this.dpr * cam.zoom);
      ctx.translate(-cam.x + rand(-shake, shake) * 0.35, -cam.y + rand(-shake, shake) * 0.35);

      global.Art.drawArena(ctx, this.level, this.world, cam, this.time, this.props);

      // portal
      if (this.portal) {
        const p = this.portal;
        ctx.save();
        ctx.globalAlpha = 0.85;
        for (let i = 0; i < 3; i++) {
          const r = 34 + i * 10 + Math.sin(this.time * 3 + i) * 5;
          ctx.strokeStyle = i % 2 ? '#ffd479' : '#9ff7e8';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, this.time * (i + 1) * 0.6, this.time * (i + 1) * 0.6 + 4.6); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,240,190,.28)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, TAU); ctx.fill();
        ctx.restore();
        global.Art.drawButterfly(ctx, p.x, p.y - 4, this.time, 1.6, '#fff3c0', true);
      }

      // telegraphs
      for (const t of this.telegraphs) {
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.35 * (1 - t.life / t.max);
        ctx.strokeStyle = t.color; ctx.fillStyle = t.color;
        if (t.beam) {
          const a = t.angleFn();
          ctx.globalAlpha = 0.2;
          ctx.translate(t.src.x, t.src.y - t.src.r);
          ctx.rotate(a);
          ctx.fillRect(0, -14, 520, 28);
        } else {
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, TAU); ctx.stroke();
          ctx.globalAlpha *= 0.35;
          ctx.beginPath(); ctx.arc(t.x, t.y, t.r * (1 - t.life / t.max), 0, TAU); ctx.fill();
        }
        ctx.restore();
      }

      // depth-sorted actors
      const actors = [];
      for (const e of this.enemies) actors.push(e);
      actors.push(this.player);
      actors.sort((a, b) => a.y - b.y);
      for (const a of actors) {
        if (a === this.player) a.draw(ctx, this.time, this);
        else a.draw(ctx, this.time);
      }

      for (const p of this.pickups) p.draw(ctx);
      for (const p of this.projectiles) p.draw(ctx, this.time);
      for (const b of this.butterflies) b.draw(ctx);
      this.particles.draw(ctx);

      // shockwaves
      for (const s of this.shockwaves) {
        ctx.save();
        ctx.globalAlpha = clamp(1 - s.r / s.max, 0, 1);
        ctx.strokeStyle = s.color; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke();
        ctx.restore();
      }

      // floating damage numbers
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px Verdana, sans-serif';
      for (const t of this.texts) {
        ctx.globalAlpha = clamp(t.life / 0.8, 0, 1);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;

      if (this.dark) {
        const p = this.player;
        const g = ctx.createRadialGradient(p.x, p.y - 16, 40, p.x, p.y - 16, 320);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(2,0,8,.82)');
        ctx.fillStyle = g;
        ctx.fillRect(cam.x - 40, cam.y - 40, cam.w + 80, cam.h + 80);
      }

      // off-screen markers for remaining foes
      this.drawMarkers(ctx, cam);
      ctx.restore();
    },

    drawMarkers(ctx, cam) {
      const p = this.player;
      const pad = 26;
      const targets = this.portal ? [this.portal] : this.enemies;
      for (const e of targets) {
        if (e.x > cam.x + pad && e.x < cam.x + cam.w - pad && e.y > cam.y + pad && e.y < cam.y + cam.h - pad) continue;
        const a = angleTo(p.x, p.y, e.x, e.y);
        const mx = clamp(e.x, cam.x + pad, cam.x + cam.w - pad);
        const my = clamp(e.y, cam.y + pad, cam.y + cam.h - pad);
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(a);
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = this.portal ? '#ffd479' : (e.isBoss || e.miniBoss ? '#ff7a2f' : (e.carries ? '#8ff7e5' : '#ff8fb0'));
        ctx.beginPath();
        ctx.moveTo(8, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  };

  global.Game = Game;
  document.addEventListener('DOMContentLoaded', () => Game.boot());
})(window);
