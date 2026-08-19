/* Game entities: sisters, monsters, projectiles, butterflies, pickups and particles. */
(function (global) {
  'use strict';
  const { TAU, clamp, lerp, rand, randInt, pick, dist, angleTo, angleDiff, inArc, approach } = global.U;

  /* ------------------------------------------------------------------ heroes */
  const HEROES = {
    sofija: {
      key: 'sofija', name: 'Sofija', style: 'Twin Daggers',
      maxHp: 90, speed: 205, maxEp: 100, epRegen: 5,
      // fast four hit chain, the last swing is a spin
      combo: [
        { dmg: 8, range: 52, arc: 1.5, dur: 0.20, kb: 110, lunge: 60, sfx: false },
        { dmg: 8, range: 52, arc: 1.5, dur: 0.18, kb: 110, lunge: 70, sfx: false },
        { dmg: 10, range: 56, arc: 1.7, dur: 0.20, kb: 140, lunge: 80, sfx: false },
        { dmg: 16, range: 64, arc: TAU, dur: 0.30, kb: 220, lunge: 40, sfx: true }
      ],
      dodge: { dur: 0.26, speed: 620, cd: 0.42, invuln: 0.24 },
      special: { cost: 45, name: 'Petal Storm' }
    },
    emilija: {
      key: 'emilija', name: 'Emilija', style: 'Moon Scythe',
      maxHp: 130, speed: 155, maxEp: 100, epRegen: 4,
      // slow, wide, heavy - every hit staggers
      combo: [
        { dmg: 20, range: 70, arc: 2.1, dur: 0.42, kb: 260, lunge: 40, stagger: 0.5 },
        { dmg: 24, range: 74, arc: 2.4, dur: 0.46, kb: 300, lunge: 50, stagger: 0.6 },
        { dmg: 34, range: 82, arc: 2.8, dur: 0.58, kb: 420, lunge: 60, stagger: 0.9, sfx: true }
      ],
      dodge: { dur: 0.3, speed: 420, cd: 0.55, invuln: 0.3, armor: true },
      special: { cost: 45, name: 'Lunar Slam' }
    }
  };

  class Player {
    constructor(key) {
      const c = HEROES[key];
      this.cfg = c;
      this.key = key;
      this.name = c.name;
      this.x = 0; this.y = 0;
      this.r = 13;
      this.hp = c.maxHp; this.maxHp = c.maxHp;
      this.ep = 40; this.maxEp = c.maxEp;
      this.facing = 0;
      this.state = 'idle';
      this.stateT = 0;
      this.comboIndex = 0;
      this.comboWindow = 0;
      this.buffer = 0;
      this.dodgeCd = 0;
      this.invuln = 0;
      this.hurtT = 0;
      this.walk = 0;
      this.moving = false;
      this.vx = 0; this.vy = 0;
      this.attackDone = false;
      this.specialT = 0;
      this.specialTick = 0;
      this.rageT = 0;      // nectar buff
      this.attackAnim = 0;
      this.slashFx = null;
    }

    get alive() { return this.hp > 0; }

    heal(v) { this.hp = clamp(this.hp + v, 0, this.maxHp); }
    addEp(v) { this.ep = clamp(this.ep + v, 0, this.maxEp); }

    damage(amount, srcX, srcY, game) {
      if (this.invuln > 0 || !this.alive) return false;
      const armor = this.state === 'dodge' && this.cfg.dodge.armor;
      const dealt = Math.max(1, Math.round(amount * (armor ? 0.4 : 1) * (game.playerDmgMod || 1)));
      this.hp = clamp(this.hp - dealt, 0, this.maxHp);
      this.invuln = 0.7;
      this.hurtT = 0.3;
      this.state = 'hurt';
      this.stateT = 0.22;
      const a = angleTo(srcX, srcY, this.x, this.y);
      this.vx += Math.cos(a) * 180;
      this.vy += Math.sin(a) * 180;
      game.shake(8);
      game.hitstop(0.06);
      game.particles.burst(this.x, this.y - 14, 10, '#ff6e8f');
      global.Sound.hurt();
      if (this.hp <= 0) {
        this.state = 'down';
        game.onSisterDown(this);
      }
      return true;
    }

    startAttack(game) {
      const chain = this.cfg.combo;
      const step = chain[this.comboIndex];
      this.state = 'attack';
      this.stateT = step.dur;
      this.attackDone = false;
      this.attackAnim = 0;
      const speed = step.lunge / Math.max(step.dur, 0.01);
      this.vx += Math.cos(this.facing) * speed * 0.5;
      this.vy += Math.sin(this.facing) * speed * 0.5;
      global.Sound.slash(this.key === 'emilija');
      game.particles.slash(this.x, this.y - 16, this.facing, step.range, step.arc,
        this.key === 'sofija' ? '#9ff7e8' : '#dcefff');
    }

    applyHit(game) {
      const step = this.cfg.combo[this.comboIndex];
      const mult = this.rageT > 0 ? 1.6 : 1;
      let hits = 0;
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (inArc(this, e, this.facing, step.range + this.r, step.arc)) {
          e.damage(step.dmg * mult, this.x, this.y, step.kb, step.stagger || 0.18, game);
          hits++;
        }
      }
      if (hits) {
        this.addEp(5 + hits * 2);
        game.hitstop(step.sfx ? 0.08 : 0.04);
        game.shake(step.sfx ? 9 : 4);
      }
    }

    useSpecial(game) {
      const sp = this.cfg.special;
      const cost = Math.round(sp.cost * (game.specialDiscount || 1));
      if (this.ep < cost) { game.toast('Not enough Flutter!'); return; }
      this.ep -= cost;
      global.Sound.special();
      if (this.key === 'sofija') {
        this.state = 'special';
        this.stateT = 1.15;
        this.specialTick = 0;
        this.invuln = 0.35;
      } else {
        this.state = 'special';
        this.stateT = 0.75;
        this.specialTick = 0;
        this.invuln = 0.5;
      }
      game.toast(sp.name + '!');
    }

    updateSpecial(dt, game) {
      const mult = this.rageT > 0 ? 1.6 : 1;
      if (this.key === 'sofija') {
        // whirling blade storm - continuous damage in a wide radius
        this.specialTick -= dt;
        this.facing += dt * 18;
        if (this.specialTick <= 0) {
          this.specialTick = 0.1;
          for (const e of game.enemies) {
            if (!e.dead && dist(this.x, this.y, e.x, e.y) < 84 + e.r) {
              e.damage(7 * mult, this.x, this.y, 120, 0.1, game);
            }
          }
          game.particles.ring(this.x, this.y - 14, 74, '#ffa8d6', 10);
          game.shake(3);
        }
      } else {
        // wind up then slam: one huge shockwave
        if (this.stateT < 0.45 && this.specialTick === 0) {
          this.specialTick = 1;
          game.shockwaves.push({ x: this.x, y: this.y, r: 10, max: 165, dmg: 46 * mult, hits: new Set(), color: '#9fd8ff' });
          game.shake(18);
          game.hitstop(0.1);
          game.particles.burst(this.x, this.y, 26, '#bfe6ff');
        }
      }
    }

    update(dt, game, control) {
      this.hurtT = Math.max(0, this.hurtT - dt);
      this.invuln = Math.max(0, this.invuln - dt);
      this.dodgeCd = Math.max(0, this.dodgeCd - dt);
      this.rageT = Math.max(0, this.rageT - dt);
      this.comboWindow = Math.max(0, this.comboWindow - dt);
      this.buffer = Math.max(0, this.buffer - dt);
      if (this.comboWindow === 0 && this.state !== 'attack') this.comboIndex = 0;

      if (!this.alive) { this.vx *= 0.85; this.vy *= 0.85; this.x += this.vx * dt; this.y += this.vy * dt; return; }

      if (control) {
        this.ep = clamp(this.ep + this.cfg.epRegen * dt, 0, this.maxEp);
        const mv = global.Input.move();
        const canMove = this.state === 'idle' || this.state === 'special' && this.key === 'sofija';
        const speedScale = this.state === 'special' ? 0.6 : 1;

        if (global.Input.pressed('attack')) this.buffer = 0.24;
        if (global.Input.pressed('dodge') && this.dodgeCd === 0 && this.state !== 'dodge' && this.state !== 'special') {
          this.state = 'dodge';
          this.stateT = this.cfg.dodge.dur;
          this.dodgeCd = this.cfg.dodge.cd + this.cfg.dodge.dur;
          this.invuln = this.cfg.dodge.invuln;
          const a = (mv.len > 0.2) ? Math.atan2(mv.y, mv.x) : this.facing;
          this.facing = a;
          this.vx = Math.cos(a) * this.cfg.dodge.speed;
          this.vy = Math.sin(a) * this.cfg.dodge.speed;
          global.Sound.dodge();
          game.particles.trail(this.x, this.y, this.key === 'sofija' ? '#ff9ecb' : '#9fd8ff');
        }
        if (global.Input.pressed('special') && (this.state === 'idle' || this.state === 'attack' && this.attackDone)) {
          this.useSpecial(game);
        }

        if (canMove) {
          if (mv.len > 0.1) {
            this.facing = Math.atan2(mv.y, mv.x);
            this.moving = true;
            const sp = this.cfg.speed * speedScale * (this.rageT > 0 ? 1.12 : 1);
            this.vx = approach(this.vx, mv.x * sp, 2600 * dt);
            this.vy = approach(this.vy, mv.y * sp, 2600 * dt);
          } else {
            this.moving = false;
          }
        } else {
          this.moving = false;
        }

        if (this.state === 'idle' && this.buffer > 0) {
          this.buffer = 0;
          this.startAttack(game);
        }
      }

      // state machine
      this.stateT = Math.max(0, this.stateT - dt);
      if (this.state === 'attack') {
        const step = this.cfg.combo[this.comboIndex];
        this.attackAnim = 1 - this.stateT / step.dur;
        if (!this.attackDone && this.attackAnim > 0.35) {
          this.attackDone = true;
          this.applyHit(game);
        }
        if (this.stateT === 0) {
          this.comboIndex = (this.comboIndex + 1) % this.cfg.combo.length;
          this.comboWindow = 0.55;
          this.state = 'idle';
          if (this.buffer > 0) { this.buffer = 0; this.startAttack(game); }
        }
      } else if (this.state === 'special') {
        this.updateSpecial(dt, game);
        if (this.stateT === 0) { this.state = 'idle'; this.specialTick = 0; }
      } else if (this.state === 'dodge') {
        game.particles.trail(this.x, this.y - 12, this.key === 'sofija' ? '#ff9ecb' : '#9fd8ff');
        if (this.stateT === 0) this.state = 'idle';
      } else if (this.state === 'hurt') {
        if (this.stateT === 0) this.state = 'idle';
      }

      // physics
      const drag = this.state === 'dodge' ? 1.5 : 12;
      this.vx = lerp(this.vx, 0, clamp(drag * dt, 0, 1));
      this.vy = lerp(this.vy, 0, clamp(drag * dt, 0, 1));
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      game.clampToWorld(this);
      if (this.moving || this.state === 'dodge') this.walk += dt * (this.state === 'dodge' ? 3 : 2.2);
    }

    draw(ctx, t, game) {
      if (this.invuln > 0 && Math.floor(t * 24) % 2 === 0 && this.hurtT > 0) return;
      if (this.state === 'special' && this.key === 'sofija') {
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = '#ffb3dc';
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(this.x, this.y - 14, 74, t * 12 % TAU, t * 12 % TAU + 4); ctx.stroke();
        ctx.restore();
      }
      global.Art.drawHero(ctx, this.key, this.x, this.y, {
        facing: this.facing,
        walk: this.walk,
        moving: this.moving,
        attack: this.state === 'attack' ? this.attackAnim : 0,
        dodging: this.state === 'dodge',
        hurt: this.hurtT > 0
      });
      if (this.rageT > 0) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#ffd479';
        ctx.beginPath(); ctx.arc(this.x, this.y - 18, 22 + Math.sin(t * 8) * 2, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    }
  }

  /* ----------------------------------------------------------------- enemies */
  const ENEMY_TYPES = {
    wraith: {
      kind: 'wraith', name: 'Moth Wraith', hp: 26, speed: 92, r: 12, dmg: 9,
      range: 34, windup: 0.42, recover: 0.5, ep: 6,
      palette: { body: '#4b2a6e', trim: '#7a4bb0', glow: '#ff9ad2' }
    },
    beetle: {
      kind: 'beetle', name: 'Cage Beetle', hp: 70, speed: 58, r: 16, dmg: 14,
      range: 36, windup: 0.6, recover: 0.7, ep: 10, weight: 2.4,
      palette: { body: '#2f6b52', trim: '#57c48e', glow: '#c8ffdd' }
    },
    wisp: {
      kind: 'wisp', name: 'Ash Wisp', hp: 20, speed: 70, r: 11, dmg: 8, ep: 8,
      ranged: true, shootRange: 300, keepAway: 170, windup: 0.7, recover: 1.1,
      palette: { body: '#7a3f8f', trim: '#c47bff', glow: '#ffd479' }
    },
    shade: {
      kind: 'shade', name: 'Thorn Shade', hp: 30, speed: 120, r: 12, dmg: 12, ep: 8,
      charger: true, range: 40, windup: 0.5, recover: 0.75,
      palette: { body: '#7a1f3d', trim: '#ff5f8a', glow: '#ffd0e0' }
    },
    knight: {
      kind: 'knight', name: 'Thistle Knight', hp: 260, speed: 78, r: 20, dmg: 20, ep: 24,
      charger: true, range: 56, windup: 0.55, recover: 0.7, weight: 4, miniBoss: true,
      palette: { body: '#3d4a86', trim: '#93a6ff', glow: '#ffb547' }
    },
    vespera: {
      kind: 'vespera', name: 'Vespera, the Widow', hp: 620, speed: 84, r: 24, dmg: 18, ep: 40,
      range: 60, windup: 0.6, recover: 0.8, weight: 8, isBoss: true,
      palette: { body: '#5a1b47', trim: '#ff8fd0', glow: '#a24bd8' }
    },
    nyx: {
      kind: 'nyx', name: 'Nyx, Keeper of Wings', hp: 1000, speed: 96, r: 26, dmg: 22, ep: 50,
      range: 66, windup: 0.5, recover: 0.7, weight: 10, isBoss: true,
      palette: { body: '#1f1440', trim: '#c9b6ff', glow: '#ffd479' }
    }
  };

  const BUTTERFLY_COLORS = ['#ffd479', '#8ff7e5', '#ff9ecb', '#a8b6ff', '#b6ff8f'];

  class Enemy {
    constructor(type, x, y, tier) {
      const t = ENEMY_TYPES[type];
      this.type = t;
      this.kind = t.kind;
      this.name = t.name;
      this.x = x; this.y = y;
      this.r = t.r;
      this.tierMult = tier || 1;
      this.maxHp = Math.round(t.hp * this.tierMult);
      this.hp = this.maxHp;
      this.speed = t.speed;
      this.palette = t.palette;
      this.facing = rand(TAU);
      this.state = 'idle';
      this.stateT = rand(0.2, 0.8);
      this.hurtT = 0;
      this.vx = 0; this.vy = 0;
      this.seed = rand(TAU);
      this.dead = false;
      this.carries = false;
      this.butterflyColor = pick(BUTTERFLY_COLORS);
      this.isBoss = !!t.isBoss;
      this.miniBoss = !!t.miniBoss;
      this.weight = t.weight || 1;
      this.phase = 1;
      this.patternT = 1.2;
      this.pattern = null;
      this.chargeDir = 0;
      this.summons = 0;
    }

    damage(amount, sx, sy, kb, stagger, game) {
      if (this.dead) return;
      const dealt = Math.max(1, Math.round(amount));
      this.hp -= dealt;
      this.hurtT = 0.12;
      const a = angleTo(sx, sy, this.x, this.y);
      const push = (kb || 100) / this.weight;
      this.vx += Math.cos(a) * push;
      this.vy += Math.sin(a) * push;
      game.particles.burst(this.x, this.y - this.r, 6, this.palette.glow);
      game.floatText(this.x, this.y - this.r * 2.4, dealt, this.isBoss ? '#ffd479' : '#fff');
      global.Sound.hit();
      if (stagger && !this.isBoss && this.state !== 'charge') {
        this.state = 'stagger';
        this.stateT = stagger;
      }
      if (this.hp <= 0) this.die(game);
    }

    die(game) {
      this.dead = true;
      global.Sound.kill();
      game.particles.burst(this.x, this.y - this.r, 22, this.palette.glow);
      game.onEnemyDeath(this);
    }

    /* --- behaviours ------------------------------------------------------- */
    update(dt, game) {
      const p = game.player;
      this.hurtT = Math.max(0, this.hurtT - dt);
      this.stateT = Math.max(0, this.stateT - dt);
      const d = dist(this.x, this.y, p.x, p.y);
      const toPlayer = angleTo(this.x, this.y, p.x, p.y);

      if (this.isBoss) this.bossAI(dt, game, d, toPlayer);
      else this.mobAI(dt, game, d, toPlayer);

      const drag = this.state === 'charge' ? 1.2 : 9;
      this.vx = lerp(this.vx, 0, clamp(drag * dt, 0, 1));
      this.vy = lerp(this.vy, 0, clamp(drag * dt, 0, 1));
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      game.clampToWorld(this);
    }

    moveToward(angle, speed, dt) {
      this.facing = angle;
      this.vx = approach(this.vx, Math.cos(angle) * speed, 1400 * dt);
      this.vy = approach(this.vy, Math.sin(angle) * speed, 1400 * dt);
    }

    mobAI(dt, game, d, toPlayer) {
      const t = this.type;
      const p = game.player;
      switch (this.state) {
        case 'stagger':
          if (this.stateT === 0) this.state = 'idle';
          break;
        case 'windup':
          this.facing = lerp(this.facing, this.facing + angleDiff(this.facing, toPlayer), 0.15);
          if (this.stateT === 0) {
            if (t.ranged) {
              game.shoot(this.x, this.y - this.r, toPlayer, 210, t.dmg * this.tierMult, this.palette.glow);
            } else if (t.charger) {
              this.state = 'charge';
              this.stateT = 0.55;
              this.chargeDir = toPlayer;
              this.vx = Math.cos(toPlayer) * (this.miniBoss ? 560 : 460);
              this.vy = Math.sin(toPlayer) * (this.miniBoss ? 560 : 460);
              break;
            } else if (d < t.range + p.r + 12) {
              p.damage(t.dmg * this.tierMult, this.x, this.y, game);
              game.particles.slash(this.x, this.y - this.r, toPlayer, t.range, 1.6, this.palette.glow);
            }
            this.state = 'recover';
            this.stateT = t.recover;
          }
          break;
        case 'charge': {
          const hit = d < this.r + p.r + 6;
          if (hit) {
            p.damage(t.dmg * this.tierMult, this.x, this.y, game);
            this.state = 'recover';
            this.stateT = t.recover;
          } else if (this.stateT === 0) {
            this.state = 'recover';
            this.stateT = t.recover * 0.8;
          }
          game.particles.trail(this.x, this.y - this.r, this.palette.glow);
          break;
        }
        case 'recover':
          if (this.stateT === 0) this.state = 'idle';
          break;
        default: {
          if (t.ranged) {
            if (d < t.keepAway) this.moveToward(toPlayer + Math.PI, this.speed * game.speedMod, dt);
            else if (d > t.shootRange) this.moveToward(toPlayer, this.speed * game.speedMod, dt);
            else {
              this.moveToward(toPlayer + Math.sin(game.time * 1.5 + this.seed) * 1.4, this.speed * 0.5 * game.speedMod, dt);
              if (this.stateT === 0) { this.state = 'windup'; this.stateT = t.windup; }
            }
          } else {
            const attackDist = t.charger ? 230 : t.range + 8;
            if (d > attackDist) {
              const wobble = Math.sin(game.time * 1.1 + this.seed) * 0.35;
              this.moveToward(toPlayer + wobble, this.speed * game.speedMod, dt);
            } else {
              this.state = 'windup';
              this.stateT = t.windup;
              this.facing = toPlayer;
            }
          }
        }
      }
    }

    bossAI(dt, game, d, toPlayer) {
      const hpFrac = this.hp / this.maxHp;
      const newPhase = hpFrac < 0.33 ? 3 : hpFrac < 0.66 ? 2 : 1;
      if (newPhase !== this.phase) {
        this.phase = newPhase;
        game.toast(this.name + '\nPhase ' + this.phase + '!');
        game.shake(16);
        global.Sound.bossRoar();
        game.particles.ring(this.x, this.y - this.r, 40, this.palette.glow, 28);
        this.state = 'idle';
        this.patternT = 0.6;
      }

      if (this.state === 'stagger') { if (this.stateT === 0) this.state = 'idle'; return; }

      if (this.state === 'idle') {
        this.patternT -= dt;
        if (d > 90) this.moveToward(toPlayer, this.speed * game.speedMod, dt);
        else this.moveToward(toPlayer + Math.PI / 2, this.speed * 0.6 * game.speedMod, dt);
        if (this.patternT <= 0) this.choosePattern(game, d, toPlayer);
        return;
      }

      if (this.kind === 'vespera') this.vesperaPattern(dt, game, d, toPlayer);
      else this.nyxPattern(dt, game, d, toPlayer);
    }

    choosePattern(game, d, toPlayer) {
      const pool = this.kind === 'vespera'
        ? ['fan', 'dash', 'summon', 'spiral']
        : ['spiral', 'slam', 'summon', 'beam', 'dash'];
      const choice = pick(this.phase >= 2 ? pool : pool.slice(0, 3));
      this.pattern = choice;
      this.state = 'pattern';
      this.stateT = 0.55;
      this.patternStep = 0;
      this.facing = toPlayer;
      game.particles.ring(this.x, this.y - this.r, 26, this.palette.glow, 12);
    }

    endPattern(rest) {
      this.state = 'idle';
      this.patternT = rest;
      this.pattern = null;
    }

    vesperaPattern(dt, game, d, toPlayer) {
      const speedUp = this.phase === 3 ? 0.7 : 1;
      if (this.pattern === 'fan') {
        if (this.stateT === 0 && this.patternStep < (this.phase >= 2 ? 3 : 2)) {
          this.patternStep++;
          const n = 5 + this.phase;
          for (let i = 0; i < n; i++) {
            const a = toPlayer + (i - (n - 1) / 2) * 0.24;
            game.shoot(this.x, this.y - this.r, a, 240, 12, this.palette.trim);
          }
          this.stateT = 0.45 * speedUp;
        } else if (this.stateT === 0) this.endPattern(1.1 * speedUp);
      } else if (this.pattern === 'spiral') {
        this.spiralT = (this.spiralT || 0) - dt;
        if (this.spiralT <= 0) {
          this.spiralT = 0.09;
          this.spiralA = (this.spiralA || 0) + 0.55;
          for (let k = 0; k < 2; k++) {
            game.shoot(this.x, this.y - this.r, this.spiralA + k * Math.PI, 200, 10, this.palette.glow);
          }
          this.patternStep++;
        }
        if (this.patternStep > 20) this.endPattern(1.2 * speedUp);
      } else if (this.pattern === 'dash') {
        if (this.patternStep === 0) {
          this.patternStep = 1;
          this.stateT = 0.5;
          this.vx = Math.cos(toPlayer) * 640;
          this.vy = Math.sin(toPlayer) * 640;
          game.shake(6);
        }
        game.particles.trail(this.x, this.y - this.r, this.palette.glow);
        if (d < this.r + game.player.r + 8) game.player.damage(this.type.dmg, this.x, this.y, game);
        if (this.stateT === 0) this.endPattern(0.9 * speedUp);
      } else if (this.pattern === 'summon') {
        if (this.patternStep === 0) {
          this.patternStep = 1;
          this.stateT = 0.7;
          const n = this.phase + 1;
          for (let i = 0; i < n; i++) {
            const a = rand(TAU);
            game.spawnEnemy('shade', this.x + Math.cos(a) * 90, this.y + Math.sin(a) * 90, 0.8, false);
          }
          game.toast('Vespera calls her brood!');
        }
        if (this.stateT === 0) this.endPattern(1.2);
      } else this.endPattern(1);
    }

    nyxPattern(dt, game, d, toPlayer) {
      if (this.pattern === 'spiral') {
        this.spiralT = (this.spiralT || 0) - dt;
        if (this.spiralT <= 0) {
          this.spiralT = 0.08;
          this.spiralA = (this.spiralA || 0) + 0.42;
          const arms = this.phase + 2;
          for (let k = 0; k < arms; k++) {
            game.shoot(this.x, this.y - this.r, this.spiralA + (k / arms) * TAU, 190, 12, this.palette.glow);
          }
          this.patternStep++;
        }
        if (this.patternStep > 22) this.endPattern(1.1);
      } else if (this.pattern === 'slam') {
        if (this.patternStep === 0) {
          this.patternStep = 1;
          this.stateT = 0.6;
          this.tx = game.player.x; this.ty = game.player.y;
          game.telegraph(this.tx, this.ty, 120, 0.6, this.palette.glow);
        } else if (this.stateT === 0) {
          game.shockwaves.push({ x: this.tx, y: this.ty, r: 12, max: 130, dmg: 22, hits: new Set(), color: this.palette.trim, hostile: true });
          game.shake(16);
          this.x = this.tx; this.y = this.ty - 4;
          global.Sound.bossRoar();
          this.endPattern(0.9);
        }
      } else if (this.pattern === 'beam') {
        if (this.patternStep === 0) {
          this.patternStep = 1;
          this.beamA = toPlayer;
          this.stateT = 0.8;
          game.telegraphBeam(this, () => this.beamA, 0.8);
        } else if (this.stateT === 0) {
          for (let i = 1; i <= 14; i++) {
            game.shoot(this.x, this.y - this.r, this.beamA, 150 + i * 18, 14, '#fff3b0');
          }
          game.shake(10);
          this.endPattern(1.1);
        } else {
          this.beamA += angleDiff(this.beamA, toPlayer) * dt * 1.4;
        }
      } else if (this.pattern === 'dash') {
        if (this.patternStep === 0) {
          this.patternStep = 1;
          this.stateT = 0.45;
          const a = toPlayer;
          this.vx = Math.cos(a) * 700; this.vy = Math.sin(a) * 700;
        }
        game.particles.trail(this.x, this.y - this.r, this.palette.glow);
        if (d < this.r + game.player.r + 8) game.player.damage(this.type.dmg, this.x, this.y, game);
        if (this.stateT === 0) this.endPattern(0.8);
      } else if (this.pattern === 'summon') {
        if (this.patternStep === 0) {
          this.patternStep = 1;
          this.stateT = 0.8;
          for (let i = 0; i < this.phase + 1; i++) {
            const a = rand(TAU);
            game.spawnEnemy(pick(['wisp', 'wraith']), this.x + Math.cos(a) * 120, this.y + Math.sin(a) * 120, 0.9, false);
          }
          game.toast('Nyx unshelves her collection!');
        }
        if (this.stateT === 0) this.endPattern(1);
      } else this.endPattern(1);
    }

    draw(ctx, t) {
      if (this.state === 'windup' || this.state === 'pattern') {
        ctx.save();
        ctx.globalAlpha = 0.4 + Math.sin(t * 24) * 0.2;
        ctx.strokeStyle = '#ffd479';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(this.x, this.y - this.r, this.r * 1.9, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      global.Art.drawEnemy(ctx, this, t);
    }
  }

  /* ------------------------------------------------------------- projectiles */
  class Projectile {
    constructor(x, y, angle, speed, dmg, color) {
      this.x = x; this.y = y;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.r = 6;
      this.dmg = dmg;
      this.color = color;
      this.life = 3.2;
      this.dead = false;
    }
    update(dt, game) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
      if (this.x < -20 || this.y < -20 || this.x > game.world.w + 20 || this.y > game.world.h + 20) this.dead = true;
      const p = game.player;
      if (!this.dead && p.alive && dist(this.x, this.y, p.x, p.y) < this.r + p.r) {
        if (p.damage(this.dmg, this.x, this.y, game)) this.dead = true;
        else if (p.invuln > 0 && p.state === 'dodge') this.dead = true;
      }
    }
    draw(ctx, t) {
      ctx.save();
      ctx.shadowColor = this.color; ctx.shadowBlur = 12;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.r * 1.3, this.r, Math.atan2(this.vy, this.vx), 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  /* -------------------------------------------------------------- butterflies */
  class Butterfly {
    constructor(x, y, color) {
      this.x = x; this.y = y - 20;
      this.color = color;
      this.t = rand(TAU);
      this.state = 'free';
      this.vx = rand(-40, 40); this.vy = rand(-70, -20);
      this.dead = false;
      this.delay = 0.5;
    }
    update(dt, game) {
      this.t += dt;
      this.delay -= dt;
      const p = game.player;
      if (this.delay > 0) {
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.vy += 40 * dt;
      } else {
        const a = angleTo(this.x, this.y, p.x, p.y - 30);
        const sp = 260;
        this.x += Math.cos(a) * sp * dt + Math.sin(this.t * 6) * 18 * dt;
        this.y += Math.sin(a) * sp * dt;
        if (dist(this.x, this.y, p.x, p.y - 30) < 26) {
          this.dead = true;
          game.onButterflyRescued(this);
        }
      }
    }
    draw(ctx) {
      global.Art.drawButterfly(ctx, this.x, this.y, this.t, 1.1, this.color, true);
    }
  }

  /* ------------------------------------------------------------------ pickups */
  const PICKUPS = {
    heart: { color: '#ff6e8f', label: '+HP' },
    flutter: { color: '#5fd8ff', label: '+Flutter' },
    nectar: { color: '#ffd479', label: 'Nectar!' }
  };

  class Pickup {
    constructor(x, y, type) {
      this.x = x; this.y = y;
      this.type = type;
      this.r = 12;
      this.t = rand(TAU);
      this.life = 16;
      this.dead = false;
    }
    update(dt, game) {
      this.t += dt;
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
      const p = game.player;
      const d = dist(this.x, this.y, p.x, p.y);
      if (d < 70) {
        const a = angleTo(this.x, this.y, p.x, p.y);
        this.x += Math.cos(a) * 150 * dt;
        this.y += Math.sin(a) * 150 * dt;
      }
      if (d < this.r + p.r) {
        this.dead = true;
        game.onPickup(this);
      }
    }
    draw(ctx) {
      const c = PICKUPS[this.type].color;
      const bob = Math.sin(this.t * 3) * 3;
      ctx.save();
      ctx.globalAlpha = this.life < 3 ? (Math.sin(this.t * 18) * 0.4 + 0.6) : 1;
      ctx.shadowColor = c; ctx.shadowBlur = 14;
      ctx.fillStyle = c;
      ctx.translate(this.x, this.y + bob);
      if (this.type === 'heart') {
        ctx.beginPath();
        ctx.moveTo(0, 6);
        ctx.bezierCurveTo(-10, -2, -5, -10, 0, -4);
        ctx.bezierCurveTo(5, -10, 10, -2, 0, 6);
        ctx.fill();
      } else if (this.type === 'flutter') {
        ctx.beginPath();
        ctx.moveTo(-3, -8); ctx.lineTo(4, -1); ctx.lineTo(0, -1); ctx.lineTo(3, 8);
        ctx.lineTo(-4, 1); ctx.lineTo(0, 1); ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + this.t;
          ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 8, Math.sin(a) * 8);
        }
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }

  /* ---------------------------------------------------------------- particles */
  class Particles {
    constructor() { this.list = []; }
    add(p) { if (this.list.length < 620) this.list.push(p); }
    burst(x, y, n, color) {
      for (let i = 0; i < n; i++) {
        const a = rand(TAU), s = rand(60, 260);
        this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.6), max: 0.6, r: rand(1.5, 4), color });
      }
    }
    ring(x, y, radius, color, n) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        this.add({ x: x + Math.cos(a) * radius, y: y + Math.sin(a) * radius, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, life: 0.35, max: 0.35, r: 3, color });
      }
    }
    trail(x, y, color) {
      this.add({ x: x + rand(-4, 4), y: y + rand(-4, 4), vx: 0, vy: -10, life: 0.3, max: 0.3, r: rand(2, 5), color });
    }
    slash(x, y, facing, range, arc, color) {
      const n = arc >= 6 ? 24 : 12;
      for (let i = 0; i < n; i++) {
        const a = facing + (i / (n - 1) - 0.5) * arc;
        this.add({
          x: x + Math.cos(a) * range * 0.75, y: y + Math.sin(a) * range * 0.75,
          vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 0.22, max: 0.22, r: 4, color
        });
      }
    }
    update(dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        p.life -= dt;
        if (p.life <= 0) { this.list.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 0.94; p.vy *= 0.94;
      }
    }
    draw(ctx) {
      for (const p of this.list) {
        ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (p.life / p.max) + 0.5, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  global.Ent = { HEROES, ENEMY_TYPES, BUTTERFLY_COLORS, Player, Enemy, Projectile, Butterfly, Pickup, PICKUPS, Particles };
})(window);
