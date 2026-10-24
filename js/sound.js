// sound.js - every sound is synthesized with the Web Audio API, so there are no audio files.
// Swap any of these for a recorded sound later (and credit it in CREDITS.md).

const Sound = {
  ctx: null,
  master: null,
  muted: false,
  heart: null,

  start() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
      this.ambience();
    } catch (e) {
      this.ctx = null; // no audio available: the game still works silently
    }
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.8;
    return this.muted;
  },

  // Low air-conditioning hum under the whole game.
  ambience() {
    const c = this.ctx;
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; // brown noise
      d[i] = last * 3.5;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 180;
    const g = c.createGain();
    g.gain.value = 0.12;
    src.connect(lp).connect(g).connect(this.master);
    src.start();
  },

  tone(freq, dur, { type = "sine", vol = 0.2, delay = 0, attack = 0.01 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  buzz() { // phone vibrating on a desk
    for (let i = 0; i < 2; i++) {
      for (let k = 0; k < 8; k++) this.tone(140, 0.05, { type: "square", vol: 0.05, delay: i * 0.5 + k * 0.045 });
    }
  },
  message() { this.tone(1046, 0.12, { vol: 0.08 }); this.tone(1568, 0.18, { vol: 0.06, delay: 0.08 }); },
  beep() { this.tone(1760, 0.09, { type: "square", vol: 0.06 }); this.tone(1760, 0.09, { type: "square", vol: 0.06, delay: 0.14 }); },
  ding() { this.tone(988, 1.4, { vol: 0.12 }); this.tone(784, 1.8, { vol: 0.12, delay: 0.35 }); },
  key() { this.tone(2200 + Math.random() * 600, 0.02, { type: "square", vol: 0.012 }); },
  success() { this.tone(523, 0.25, { vol: 0.08 }); this.tone(659, 0.25, { vol: 0.08, delay: 0.1 }); this.tone(784, 0.5, { vol: 0.08, delay: 0.2 }); },
  error() { this.tone(196, 0.25, { type: "sawtooth", vol: 0.04 }); },
  sting() { this.tone(55, 2.5, { type: "sawtooth", vol: 0.12, attack: 0.02 }); this.tone(58, 2.5, { type: "sawtooth", vol: 0.1 }); },
  step(delay = 0) { this.tone(70, 0.18, { type: "triangle", vol: 0.25, delay }); },
  footsteps(n = 6, gap = 0.55) { for (let i = 0; i < n; i++) this.step(i * gap); },

  heartbeatOn() {
    if (!this.ctx || this.heart) return;
    const beat = () => { this.tone(60, 0.15, { vol: 0.3 }); this.tone(55, 0.15, { vol: 0.25, delay: 0.18 }); };
    beat();
    this.heart = setInterval(beat, 850);
  },
  heartbeatOff() { clearInterval(this.heart); this.heart = null; },
};
