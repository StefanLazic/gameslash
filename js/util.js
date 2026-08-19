/* Small helpers shared by every module. */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  };
  const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
  const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

  /** Shortest signed difference between two angles. */
  function angleDiff(a, b) {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  }

  /** True when `target` sits inside a cone centred on `facing`. */
  function inArc(from, target, facing, range, arc) {
    if (dist2(from.x, from.y, target.x, target.y) > (range + target.r) * (range + target.r)) return false;
    return Math.abs(angleDiff(facing, angleTo(from.x, from.y, target.x, target.y))) <= arc / 2;
  }

  const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

  /** Rounded rectangle path (older Safari lacks ctx.roundRect). */
  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  global.U = { TAU, clamp, lerp, rand, randInt, pick, dist, dist2, angleTo, angleDiff, inArc, approach, roundRect };
})(window);
