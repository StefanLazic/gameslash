/* Tiny procedural sound engine - no audio assets, everything is synthesised. */
(function (global) {
  'use strict';

  const Sound = {
    ctx: null,
    master: null,
    musicGain: null,
    enabled: true,
    musicTimer: null,
    step: 0,

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.22;
      this.musicGain.connect(this.master);
    },

    tone(freq, dur, type, vol, slideTo, dest) {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol == null ? 0.25 : vol), t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(dest || this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },

    noise(dur, vol, filterFreq) {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, Math.max(1, len), this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = filterFreq || 1400;
      const g = this.ctx.createGain();
      g.gain.value = vol == null ? 0.3 : vol;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    },

    slash(heavy) {
      this.noise(heavy ? 0.24 : 0.12, heavy ? 0.32 : 0.2, heavy ? 700 : 2200);
      this.tone(heavy ? 220 : 640, heavy ? 0.2 : 0.09, 'triangle', 0.14, heavy ? 90 : 320);
    },
    hit() { this.noise(0.09, 0.26, 900); this.tone(180, 0.08, 'square', 0.1, 90); },
    kill() { this.tone(320, 0.22, 'triangle', 0.16, 80); this.noise(0.2, 0.2, 500); },
    hurt() { this.tone(180, 0.28, 'sawtooth', 0.2, 60); },
    dodge() { this.tone(760, 0.16, 'sine', 0.12, 1500); },
    special() {
      this.tone(200, 0.5, 'sawtooth', 0.2, 900);
      this.tone(400, 0.5, 'triangle', 0.14, 1400);
    },
    rescue() {
      [660, 880, 1170].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'sine', 0.16), i * 70));
    },
    pickup() { this.tone(880, 0.14, 'sine', 0.16, 1320); },
    levelUp() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'triangle', 0.18), i * 110));
    },
    bossRoar() {
      this.tone(110, 1.1, 'sawtooth', 0.28, 42);
      this.noise(0.9, 0.3, 240);
    },

    /* --- music: a slow, moody arpeggio that gets tenser during boss fights --- */
    startMusic(mode) {
      this.stopMusic();
      if (!this.enabled || !this.ctx) return;
      const scales = {
        calm: [220, 261.6, 329.6, 392, 523.3],
        fight: [196, 233, 293.7, 349.2, 466.2],
        boss: [146.8, 174.6, 233, 277.2, 349.2]
      };
      const scale = scales[mode] || scales.calm;
      const beat = mode === 'boss' ? 220 : 300;
      this.step = 0;
      this.musicTimer = setInterval(() => {
        const s = this.step++;
        const n = scale[s % scale.length];
        this.tone(n * (s % 8 === 0 ? 2 : 1), 0.55, 'triangle', 0.09, null, this.musicGain);
        if (s % 4 === 0) this.tone(scale[0] / 2, 0.7, 'sine', 0.13, null, this.musicGain);
        if (mode === 'boss' && s % 2 === 1) this.noise(0.05, 0.05, 3000);
      }, beat);
    },
    stopMusic() {
      if (this.musicTimer) clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  };

  global.Sound = Sound;
})(window);
