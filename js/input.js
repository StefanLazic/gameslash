/* Keyboard + touch input. Exposes a normalised movement axis and edge-triggered actions. */
(function (global) {
  'use strict';
  const { clamp } = global.U;

  const KEY_MAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    KeyJ: 'attack', Space: 'attack',
    KeyK: 'special', KeyF: 'special',
    KeyL: 'dodge', ShiftLeft: 'dodge', ShiftRight: 'dodge',
    KeyQ: 'swap', KeyE: 'swap',
    Escape: 'pause', KeyP: 'pause'
  };

  const Input = {
    down: Object.create(null),
    justPressed: Object.create(null),
    axis: { x: 0, y: 0 },
    touchActive: false,
    stick: { id: null, cx: 0, cy: 0, dx: 0, dy: 0, radius: 52 },

    init() {
      global.addEventListener('keydown', (e) => {
        const a = KEY_MAP[e.code];
        if (!a) return;
        e.preventDefault();
        if (!this.down[a]) this.justPressed[a] = true;
        this.down[a] = true;
      });
      global.addEventListener('keyup', (e) => {
        const a = KEY_MAP[e.code];
        if (!a) return;
        e.preventDefault();
        this.down[a] = false;
      });
      global.addEventListener('blur', () => { this.down = Object.create(null); this.resetStick(); });

      this.initStick(document.getElementById('stick'));
      document.querySelectorAll('.tbtn').forEach((btn) => {
        const action = btn.dataset.btn;
        const press = (e) => {
          e.preventDefault();
          this.touchActive = true;
          if (!this.down[action]) this.justPressed[action] = true;
          this.down[action] = true;
        };
        const release = (e) => { e.preventDefault(); this.down[action] = false; };
        btn.addEventListener('pointerdown', press);
        btn.addEventListener('pointerup', release);
        btn.addEventListener('pointercancel', release);
        btn.addEventListener('pointerleave', release);
      });

      global.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') this.touchActive = true;
      }, true);
    },

    initStick(el) {
      if (!el) return;
      const knob = el.querySelector('i');
      const rectCenter = () => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, radius: r.width / 2 - 12 };
      };
      const move = (e) => {
        if (this.stick.id !== e.pointerId) return;
        e.preventDefault();
        const c = rectCenter();
        let dx = e.clientX - c.x, dy = e.clientY - c.y;
        const len = Math.hypot(dx, dy) || 1;
        const capped = Math.min(len, c.radius);
        dx = (dx / len) * capped;
        dy = (dy / len) * capped;
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        const mag = capped / c.radius;
        this.axis.x = (dx / (capped || 1)) * mag;
        this.axis.y = (dy / (capped || 1)) * mag;
        if (mag < 0.16) { this.axis.x = 0; this.axis.y = 0; }
      };
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.touchActive = true;
        this.stick.id = e.pointerId;
        el.setPointerCapture(e.pointerId);
        move(e);
      });
      el.addEventListener('pointermove', move);
      const end = (e) => {
        if (this.stick.id !== e.pointerId) return;
        this.stick.id = null;
        this.resetStick();
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      this._knob = knob;
    },

    resetStick() {
      this.axis.x = 0; this.axis.y = 0;
      this.stick.id = null;
      if (this._knob) this._knob.style.transform = '';
    },

    /** Movement vector combining keyboard and thumbstick, magnitude <= 1. */
    move() {
      let x = this.axis.x, y = this.axis.y;
      if (this.down.left) x -= 1;
      if (this.down.right) x += 1;
      if (this.down.up) y -= 1;
      if (this.down.down) y += 1;
      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      return { x: clamp(x, -1, 1), y: clamp(y, -1, 1), len: Math.min(len, 1) };
    },

    pressed(action) { return !!this.justPressed[action]; },
    held(action) { return !!this.down[action]; },
    endFrame() { this.justPressed = Object.create(null); },
    clear() { this.down = Object.create(null); this.justPressed = Object.create(null); this.resetStick(); }
  };

  global.Input = Input;
})(window);
