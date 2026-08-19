/* All visuals are drawn procedurally: heroes, monsters, butterflies and arenas. */
(function (global) {
  'use strict';
  const { TAU, clamp, lerp, rand } = global.U;

  const HERO_LOOK = {
    sofija: {
      name: 'Sofija',
      hair: '#5c2f8f', hair2: '#8a4fd0',
      skin: '#f7cfae', dress: '#ff6ea9', dress2: '#c93b78',
      trim: '#ffd479', blade: '#8ff7e5', aura: '#ff8fc4'
    },
    emilija: {
      name: 'Emilija',
      hair: '#e9e6ff', hair2: '#b9b3ea',
      skin: '#f2c39b', dress: '#4a74d8', dress2: '#2b4796',
      trim: '#cfe4ff', blade: '#dcefff', aura: '#7ecbff'
    }
  };

  function shadow(ctx, x, y, w, a) {
    ctx.save();
    ctx.globalAlpha = a == null ? 0.32 : a;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.38, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Draw a sister.
   * o = { facing, walk (0..1 phase), attack (0..1 progress or 0), dodging, hurt, scale }
   */
  function drawHero(ctx, kind, x, y, o) {
    const L = HERO_LOOK[kind] || HERO_LOOK.sofija;
    const s = (o.scale || 1) * 1.0;
    const flip = Math.cos(o.facing) < 0 ? -1 : 1;
    const bob = Math.sin(o.walk * TAU) * 1.6 * (o.moving ? 1 : 0.35);
    const lean = o.dodging ? 0.35 * flip : (o.attack ? 0.2 * flip : 0);

    shadow(ctx, x, y + 2, 12 * s, o.dodging ? 0.18 : 0.32);

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(flip * s, s);
    ctx.rotate(lean * 0.3);
    if (o.hurt) { ctx.globalAlpha = 0.85; }

    // legs
    ctx.strokeStyle = L.skin;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    const swing = Math.sin(o.walk * TAU) * (o.moving ? 5 : 1);
    ctx.beginPath(); ctx.moveTo(-2, -10); ctx.lineTo(-2 - swing, 0);
    ctx.moveTo(2, -10); ctx.lineTo(2 + swing, 0); ctx.stroke();

    // skirt / coat
    ctx.fillStyle = L.dress2;
    ctx.beginPath();
    ctx.moveTo(-7, -8); ctx.lineTo(7, -8); ctx.lineTo(5, -20); ctx.lineTo(-5, -20); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = L.dress;
    ctx.beginPath();
    ctx.moveTo(-6.5, -10); ctx.lineTo(6.5, -10); ctx.lineTo(4.5, -26); ctx.lineTo(-4.5, -26); ctx.closePath();
    ctx.fill();

    // belt
    ctx.fillStyle = L.trim;
    ctx.fillRect(-5, -21, 10, 2);

    // arms
    ctx.strokeStyle = L.skin;
    ctx.lineWidth = 2.8;
    const armSwing = o.attack ? lerp(-1.6, 1.1, o.attack) : Math.sin(o.walk * TAU + Math.PI) * 0.5;
    ctx.save();
    ctx.translate(3, -25);
    ctx.rotate(armSwing);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(9, 2); ctx.stroke();

    // weapon in the leading hand
    ctx.translate(9, 2);
    if (kind === 'sofija') {
      ctx.fillStyle = L.blade;
      ctx.shadowColor = L.blade; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(0, -1.5); ctx.lineTo(15, -3); ctx.lineTo(0, 1.5); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = '#c8b6e8'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(-4, 6); ctx.lineTo(10, -14); ctx.stroke();
      ctx.strokeStyle = L.blade; ctx.lineWidth = 3;
      ctx.shadowColor = L.blade; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(6, -12, 11, -0.5, 1.7); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    ctx.strokeStyle = L.skin; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(-3, -25); ctx.lineTo(-9, -20); ctx.stroke();

    // torso
    ctx.fillStyle = L.dress;
    ctx.beginPath();
    ctx.moveTo(-5, -26); ctx.lineTo(5, -26); ctx.lineTo(4, -34); ctx.lineTo(-4, -34); ctx.closePath();
    ctx.fill();

    // head
    ctx.fillStyle = L.skin;
    ctx.beginPath(); ctx.arc(0, -38, 5.2, 0, TAU); ctx.fill();

    // hair
    ctx.fillStyle = L.hair;
    ctx.beginPath();
    if (kind === 'sofija') {
      ctx.arc(0, -39.5, 6, Math.PI, TAU);
      ctx.lineTo(6, -34); ctx.lineTo(3, -33); ctx.lineTo(-3, -33); ctx.lineTo(-6, -34);
    } else {
      ctx.arc(0, -39.5, 6.2, Math.PI, TAU);
      ctx.lineTo(6.2, -26); ctx.lineTo(2, -30); ctx.lineTo(-2, -30); ctx.lineTo(-6.2, -26);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = L.hair2;
    ctx.beginPath(); ctx.arc(-2, -41, 3.4, Math.PI, TAU); ctx.fill();

    // eyes
    ctx.fillStyle = '#2a1636';
    ctx.fillRect(1.4, -38.6, 1.4, 1.8);
    ctx.fillRect(-2.8, -38.6, 1.2, 1.8);

    ctx.restore();
  }

  function drawPortrait(canvas, kind) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const L = HERO_LOOK[kind];
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h * 0.4, 4, w / 2, h / 2, w * 0.7);
    g.addColorStop(0, kind === 'sofija' ? '#5b2b74' : '#243a72');
    g.addColorStop(1, '#150b28');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.save();
    const s = w / 96;
    ctx.translate(w / 2, h * 0.97);
    ctx.scale(s * 1.5, s * 1.5);
    drawHero(ctx, kind, 0, 0, { facing: 0.4, walk: 0.25, attack: 0, moving: false, scale: 1 });
    ctx.restore();
    ctx.strokeStyle = L.aura; ctx.globalAlpha = 0.5;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.globalAlpha = 1;
  }

  /* ---------------- butterflies ---------------- */
  function drawButterfly(ctx, x, y, t, size, color, glow) {
    const flap = Math.sin(t * 12) * 0.6 + 0.6;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 14; }
    ctx.fillStyle = color;
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.scale(dir, 1);
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.ellipse(3 + flap * 2, -2, 4.4 * (0.4 + flap * 0.6), 3.4, -0.5, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(2.6 + flap * 1.6, 2, 3.2 * (0.4 + flap * 0.6), 2.6, 0.4, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#2b1740';
    ctx.beginPath(); ctx.ellipse(0, 0, 1, 4, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ---------------- enemies ---------------- */
  function drawEnemy(ctx, e, t) {
    const p = e.palette;
    shadow(ctx, e.x, e.y + 2, e.r * 0.9, 0.3);
    const hurtFlash = e.hurtT > 0;
    ctx.save();
    ctx.translate(e.x, e.y);
    const face = Math.cos(e.facing) < 0 ? -1 : 1;
    ctx.scale(face, 1);
    const bob = Math.sin(t * 4 + e.seed) * 2;

    if (hurtFlash) ctx.globalAlpha = 0.9;

    switch (e.kind) {
      case 'wisp': {
        ctx.translate(0, bob - e.r);
        ctx.fillStyle = hurtFlash ? '#fff' : p.body;
        ctx.shadowColor = p.glow; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(0, 0, e.r * 0.8, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = p.glow; ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const a = t * 2 + (i / 4) * TAU;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * e.r * 0.6, Math.sin(a) * e.r * 0.6);
          ctx.lineTo(Math.cos(a) * e.r * 1.35, Math.sin(a) * e.r * 1.35 + 3);
          ctx.stroke();
        }
        ctx.fillStyle = '#1a0d2a';
        ctx.beginPath(); ctx.arc(2, -1, 1.6, 0, TAU); ctx.fill();
        break;
      }
      case 'beetle': {
        ctx.translate(0, -e.r * 0.8);
        ctx.fillStyle = hurtFlash ? '#fff' : p.body;
        ctx.beginPath(); ctx.ellipse(0, 0, e.r, e.r * 0.85, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = p.trim;
        ctx.beginPath(); ctx.ellipse(-e.r * 0.15, -e.r * 0.15, e.r * 0.7, e.r * 0.5, -0.3, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#20122f'; ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i += 2) {
          ctx.beginPath();
          ctx.moveTo(i * e.r * 0.6, e.r * 0.5);
          ctx.lineTo(i * (e.r * 1.1 + Math.sin(t * 8 + e.seed) * 2), e.r * 0.9);
          ctx.stroke();
        }
        ctx.fillStyle = '#ffe08a';
        ctx.beginPath(); ctx.arc(e.r * 0.5, -e.r * 0.2, 2, 0, TAU); ctx.fill();
        break;
      }
      case 'shade': {
        ctx.translate(0, -e.r);
        ctx.fillStyle = hurtFlash ? '#fff' : p.body;
        ctx.beginPath();
        ctx.moveTo(0, -e.r * 1.1);
        ctx.lineTo(e.r * 0.75, e.r * 0.9);
        ctx.lineTo(0, e.r * 0.5);
        ctx.lineTo(-e.r * 0.75, e.r * 0.9);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = p.glow; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-e.r * 0.5, -e.r * 0.3); ctx.lineTo(e.r * 0.9, -e.r * 0.55); ctx.stroke();
        ctx.fillStyle = '#ff5f7a';
        ctx.fillRect(1, -e.r * 0.55, 3, 2);
        break;
      }
      case 'knight': {
        ctx.translate(0, -e.r * 1.1);
        ctx.fillStyle = hurtFlash ? '#fff' : p.body;
        ctx.beginPath();
        ctx.moveTo(-e.r * 0.7, e.r); ctx.lineTo(e.r * 0.7, e.r);
        ctx.lineTo(e.r * 0.55, -e.r * 0.8); ctx.lineTo(-e.r * 0.55, -e.r * 0.8);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = p.trim;
        ctx.beginPath(); ctx.arc(0, -e.r * 1.05, e.r * 0.45, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff8a4a';
        ctx.fillRect(0, -e.r * 1.15, e.r * 0.4, 3);
        // shield
        ctx.fillStyle = p.glow;
        ctx.save();
        ctx.translate(e.r * 0.9, 0);
        ctx.rotate(Math.sin(t * 2 + e.seed) * 0.15);
        ctx.beginPath();
        ctx.moveTo(0, -e.r * 0.9); ctx.lineTo(e.r * 0.5, -e.r * 0.6);
        ctx.lineTo(e.r * 0.5, e.r * 0.5); ctx.lineTo(0, e.r * 0.95);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      }
      case 'vespera': {
        ctx.translate(0, -e.r * 1.2 + bob * 0.4);
        // wings
        ctx.fillStyle = p.glow;
        ctx.globalAlpha = 0.55;
        const wf = Math.sin(t * 3) * 0.25 + 1;
        for (const d of [-1, 1]) {
          ctx.save(); ctx.scale(d, 1);
          ctx.beginPath();
          ctx.ellipse(e.r * 0.9 * wf, -e.r * 0.3, e.r * 0.95, e.r * 0.65, -0.5, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = hurtFlash ? '#fff' : p.body;
        ctx.beginPath(); ctx.ellipse(0, 0, e.r * 0.55, e.r * 1.15, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = p.trim;
        ctx.beginPath(); ctx.arc(0, -e.r * 1.1, e.r * 0.42, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#2a1030'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const a = 0.4 + i * 0.4 + Math.sin(t * 3 + i) * 0.12;
          for (const d of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(0, e.r * 0.2);
            ctx.quadraticCurveTo(d * e.r * 1.1, e.r * (0.1 + i * 0.2), d * e.r * (1.4 + Math.sin(a) * 0.2), e.r * 1.1);
            ctx.stroke();
          }
        }
        ctx.fillStyle = '#ff4f7a';
        ctx.fillRect(-4, -e.r * 1.2, 3, 2.5); ctx.fillRect(2, -e.r * 1.2, 3, 2.5);
        break;
      }
      case 'nyx': {
        ctx.translate(0, -e.r * 1.3 + bob * 0.5);
        const wf = Math.sin(t * 2.4) * 0.3 + 1;
        for (const d of [-1, 1]) {
          ctx.save(); ctx.scale(d, 1);
          const grad = ctx.createLinearGradient(0, 0, e.r * 2, -e.r);
          grad.addColorStop(0, p.glow); grad.addColorStop(1, 'rgba(255,255,255,0.05)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(e.r * 1.6 * wf, -e.r * 1.9, e.r * 2.1 * wf, -e.r * 0.1);
          ctx.quadraticCurveTo(e.r * 1.2, e.r * 0.7, 0, e.r * 0.4);
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = hurtFlash ? '#fff' : p.body;
        ctx.beginPath();
        ctx.moveTo(-e.r * 0.6, e.r * 1.2); ctx.lineTo(e.r * 0.6, e.r * 1.2);
        ctx.lineTo(e.r * 0.42, -e.r * 0.9); ctx.lineTo(-e.r * 0.42, -e.r * 0.9);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = p.trim;
        ctx.beginPath(); ctx.arc(0, -e.r * 1.2, e.r * 0.4, 0, TAU); ctx.fill();
        // crown
        ctx.strokeStyle = '#ffd479'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = -2; i <= 2; i++) {
          ctx.moveTo(i * 4, -e.r * 1.5);
          ctx.lineTo(i * 4, -e.r * 1.5 - 6 + Math.abs(i) * 2);
        }
        ctx.stroke();
        ctx.fillStyle = '#ff3f6f';
        ctx.fillRect(-4, -e.r * 1.28, 3, 2.5); ctx.fillRect(2, -e.r * 1.28, 3, 2.5);
        break;
      }
      default: { // wraith
        ctx.translate(0, -e.r + bob * 0.5);
        ctx.fillStyle = hurtFlash ? '#fff' : p.body;
        ctx.beginPath();
        ctx.moveTo(0, -e.r);
        ctx.quadraticCurveTo(e.r, -e.r * 0.4, e.r * 0.8, e.r * 0.9);
        for (let i = 3; i >= -3; i--) {
          ctx.lineTo(i * (e.r / 3.4), e.r * (i % 2 ? 0.55 : 1.05) + Math.sin(t * 6 + i + e.seed) * 2);
        }
        ctx.quadraticCurveTo(-e.r, -e.r * 0.4, 0, -e.r);
        ctx.fill();
        ctx.fillStyle = p.trim;
        ctx.beginPath(); ctx.ellipse(0, -e.r * 0.35, e.r * 0.55, e.r * 0.5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = p.glow;
        ctx.fillRect(1, -e.r * 0.5, 3, 2.4);
        ctx.fillRect(-4, -e.r * 0.5, 3, 2.4);
      }
    }
    ctx.restore();

    if (e.carries) {
      // caged butterfly floating above the enemy
      const cy = e.y - e.r * 2.6 - 6 + Math.sin(t * 3 + e.seed) * 2;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#b9a4d6';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(e.x, cy, 8, 0, TAU); ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + 0.4;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(a) * 8, cy + Math.sin(a) * 8);
        ctx.lineTo(e.x - Math.cos(a) * 8, cy - Math.sin(a) * 8);
        ctx.stroke();
      }
      ctx.restore();
      drawButterfly(ctx, e.x, cy, t + e.seed, 0.7, e.butterflyColor || '#ffd479', true);
    }

    if (e.maxHp > 24 && !e.isBoss) {
      const w = e.r * 2.2;
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillRect(e.x - w / 2, e.y - e.r * 3.1, w, 3);
      ctx.fillStyle = '#ff7f9f';
      ctx.fillRect(e.x - w / 2, e.y - e.r * 3.1, w * clamp(e.hp / e.maxHp, 0, 1), 3);
    }
  }

  /* ---------------- arenas ---------------- */

  /** Deterministic scatter of props for a level. */
  function buildProps(level, w, h) {
    const props = [];
    let seed = level.id * 9301 + 49297;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 90; i++) {
      props.push({
        x: rnd() * w, y: rnd() * h,
        t: rnd(), s: 0.6 + rnd() * 1.1, a: rnd() * TAU
      });
    }
    return props;
  }

  function drawArena(ctx, level, world, cam, t, props) {
    const p = level.palette;
    const g = ctx.createLinearGradient(0, cam.y, 0, cam.y + cam.h);
    g.addColorStop(0, p.sky1);
    g.addColorStop(1, p.sky2);
    ctx.fillStyle = g;
    ctx.fillRect(cam.x, cam.y, cam.w, cam.h);

    // ground plate
    ctx.save();
    ctx.fillStyle = p.ground;
    global.U.roundRect(ctx, 0, 0, world.w, world.h, 60);
    ctx.fill();
    ctx.clip();

    // subtle grid glow
    ctx.strokeStyle = p.grid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    const step = 80;
    for (let x = 0; x <= world.w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, world.h); ctx.stroke();
    }
    for (let y = 0; y <= world.h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(world.w, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // props
    for (const pr of props) {
      if (pr.x < cam.x - 60 || pr.x > cam.x + cam.w + 60 || pr.y < cam.y - 80 || pr.y > cam.y + cam.h + 60) continue;
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.scale(pr.s, pr.s);
      if (level.prop === 'flower') {
        ctx.strokeStyle = p.prop2; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -12); ctx.stroke();
        ctx.fillStyle = pr.t > 0.5 ? p.prop : p.prop2;
        for (let i = 0; i < 5; i++) {
          const a = pr.a + (i / 5) * TAU;
          ctx.beginPath(); ctx.ellipse(Math.cos(a) * 4, -12 + Math.sin(a) * 4, 3, 2, a, 0, TAU); ctx.fill();
        }
      } else if (level.prop === 'crystal') {
        ctx.fillStyle = p.prop;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(0, -18 - pr.t * 10); ctx.lineTo(6, 0); ctx.lineTo(-6, 0); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = p.prop2;
        ctx.fillRect(-2, -6, 2, 6);
      } else if (level.prop === 'bone') {
        ctx.strokeStyle = p.prop; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, -4); ctx.stroke();
        ctx.fillStyle = p.prop2;
        ctx.beginPath(); ctx.arc(-6, 0, 2.6, 0, TAU); ctx.arc(6, -4, 2.6, 0, TAU); ctx.fill();
      } else if (level.prop === 'rune') {
        ctx.globalAlpha = 0.35 + Math.sin(t * 2 + pr.a) * 0.2;
        ctx.strokeStyle = p.prop; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-7, -7); ctx.lineTo(7, 7); ctx.moveTo(7, -7); ctx.lineTo(-7, 7);
        ctx.stroke();
      } else { // grass
        ctx.strokeStyle = pr.t > 0.5 ? p.prop : p.prop2;
        ctx.lineWidth = 2; ctx.lineCap = 'round';
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 3, 0);
          ctx.quadraticCurveTo(i * 4, -6, i * 6 + Math.sin(t + pr.a) * 2, -11);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    ctx.restore();

    // arena border
    ctx.strokeStyle = p.border;
    ctx.lineWidth = 6;
    ctx.shadowColor = p.border; ctx.shadowBlur = 18;
    global.U.roundRect(ctx, 0, 0, world.w, world.h, 60);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  global.Art = { HERO_LOOK, drawHero, drawPortrait, drawButterfly, drawEnemy, drawArena, buildProps, shadow };
})(window);
