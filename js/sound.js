// sound.js - every sound is synthesized with the Web Audio API, so there are no audio files.
// Swap any of these for a recorded sound later (and credit it in CREDITS.md).

// Two groups, each with its own switch in the HUD:
//   ambient - the room hum, the score that builds through the night, and the last-hour clock tick
//   effects - everything else (phone, keys, footsteps, the clock rolling, success and error sounds)
const PREFS_KEY = "ledger-detective-sound";

const Sound = {
  ctx: null,
  master: null,
  amb: null,
  fx: null,
  ambientOn: true,
  effectsOn: true,
  heart: null,
  ticker: null,
  level: 0,
  layers: null,
  pulseGap: 0,
  pulseTimer: null,

  start() {
    if (this.ctx) return;
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
      if (p.ambient === false) this.ambientOn = false;
      if (p.effects === false) this.effectsOn = false;
    } catch (e) { /* storage off: both on */ }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
      this.amb = this.ctx.createGain();
      this.amb.gain.value = this.ambientOn ? 1 : 0;
      this.amb.connect(this.master);
      this.fx = this.ctx.createGain();
      this.fx.gain.value = this.effectsOn ? 1 : 0;
      this.fx.connect(this.master);
      this.ambience();
    } catch (e) {
      this.ctx = null; // no audio available: the game still works silently
    }
  },

  setAmbient(on) {
    this.ambientOn = on;
    if (this.amb) this.amb.gain.value = on ? 1 : 0;
    this.savePrefs();
  },
  setEffects(on) {
    this.effectsOn = on;
    if (this.fx) this.fx.gain.value = on ? 1 : 0;
    this.savePrefs();
  },
  savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ ambient: this.ambientOn, effects: this.effectsOn })); } catch (e) { /* ignore */ }
  },

  // ---------- the score: it builds through the night ----------
  // 1 (before 1 AM): a low, uneasy drone.  2 (1 to 4 AM): a slow pulse joins underneath.
  // 3 (from 4 AM, the hallway): the pulse quickens and two thin high notes rub against each other.
  // 4 (from 8 AM): everything louder and faster, and the clock starts ticking (tickOn).  0: silence, for the endings.
  score(level) {
    if (!this.ctx || level === this.level) return;
    this.level = level;
    if (!this.layers) this.buildScore();
    const t = this.ctx.currentTime;
    const L = this.layers;
    const fade = (param, v) => param.setTargetAtTime(v, t, 1.5); // eases over about 4 seconds
    fade(L.drone.gain, [0, 0.025, 0.03, 0.037, 0.047][level]);
    fade(L.filter.frequency, [200, 260, 320, 420, 600][level]);
    fade(L.high.gain, [0, 0, 0, 0.012, 0.02][level]);
    this.pulseGap = [0, 0, 1.6, 1.05, 0.75][level]; // seconds between pulses
    if (this.pulseGap && !this.pulseTimer) this.pulse();
  },
  buildScore() {
    const c = this.ctx;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 200;
    filter.Q.value = 4;
    // A and C, slightly out of tune with each other: minor and unsettled
    for (const [f, detune] of [[55, -6], [55, 6], [65.41, 0]]) {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(filter);
      o.start();
    }
    // a slow wobble on the filter, so the drone breathes
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const depth = c.createGain();
    depth.gain.value = 60;
    lfo.connect(depth).connect(filter.frequency);
    lfo.start();
    const drone = c.createGain();
    drone.gain.value = 0;
    filter.connect(drone).connect(this.amb);
    // D#5 against E5: two notes a half step apart, for the tense part of the night
    const high = c.createGain();
    high.gain.value = 0;
    for (const f of [622.25, 659.25]) {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.connect(high);
      o.start();
    }
    high.connect(this.amb);
    this.layers = { drone, filter, high };
  },
  pulse() {
    if (!this.pulseGap) { this.pulseTimer = null; return; }
    this.tone(46, 0.5, { vol: 0.1 + 0.03 * this.level, attack: 0.03, bus: this.amb });
    this.pulseTimer = setTimeout(() => this.pulse(), this.pulseGap * 1000);
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
    src.connect(lp).connect(g).connect(this.amb);
    src.start();
  },

  tone(freq, dur, { type = "sine", vol = 0.2, delay = 0, attack = 0.01, bus = this.fx } = {}) {
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
    o.connect(g).connect(bus);
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
  // A wrong query is the correct-query sound played backwards and lower: it falls instead of climbing.
  error() { this.tone(659, 0.25, { vol: 0.08 }); this.tone(523, 0.25, { vol: 0.08, delay: 0.1 }); this.tone(415, 0.5, { vol: 0.08, delay: 0.2 }); },
  stamp(delay = 0) { this.tone(95, 0.14, { type: "triangle", vol: 0.35, delay }); this.tone(190, 0.05, { type: "square", vol: 0.03, delay }); }, // rubber stamp thud
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

  // Time passing: each flip of the clock's digits is a dry click; it settles with a low thud,
  // plus a soft two-note chime when an hour has passed.
  flip() { this.tone(900 + Math.random() * 120, 0.015, { type: "square", vol: 0.03 }); },
  clockSet(hourPassed) {
    this.tone(82, 0.35, { type: "triangle", vol: 0.28 });
    if (hourPassed) {
      this.tone(659, 1.6, { vol: 0.07, delay: 0.25 });
      this.tone(494, 2.2, { vol: 0.07, delay: 0.75 });
    }
  },
  // Losing minutes to a hint or a choice: time skips. The clock ticks race ahead for a split second, then a heavy thud.
  penalty() {
    let t = 0;
    for (let i = 0; i < 7; i++) {
      this.tone(1400, 0.025, { type: "square", vol: 0.03, delay: t });
      t += 0.09 - i * 0.011; // each tick comes sooner than the last
    }
    this.tone(70, 0.4, { type: "triangle", vol: 0.32, delay: t + 0.03 });
    this.tone(140, 0.12, { vol: 0.06, delay: t + 0.03 });
  },
  // Shock cut: a low hit under the scare.
  hit() { this.tone(48, 0.7, { type: "sawtooth", vol: 0.18, attack: 0.005 }); this.tone(96, 0.25, { type: "square", vol: 0.05 }); },
  // Chapter titles: one soft key click per letter.
  typing(n, gap = 0.045, delay = 0) {
    for (let i = 0; i < n; i++) this.tone(2200 + Math.random() * 600, 0.02, { type: "square", vol: 0.012, delay: delay + i * gap });
  },
  // The last hour before the bell: a quiet tick every second.
  tickOn() {
    if (this.ticker || !this.ctx) return;
    this.ticker = setInterval(() => this.tone(1400, 0.03, { type: "square", vol: 0.015, bus: this.amb }), 1000);
  },
  tickOff() { clearInterval(this.ticker); this.ticker = null; },
  // The hiding scene: the heartbeat speeds up and footsteps get louder as time runs out. Returns a stop function.
  tension(seconds) {
    if (!this.ctx) return () => {};
    const start = Date.now();
    const timers = [];
    let stopped = false;
    const progress = () => Math.min(1, (Date.now() - start) / (seconds * 1000));
    const beat = () => {
      if (stopped) return;
      this.tone(60, 0.15, { vol: 0.3 });
      this.tone(55, 0.15, { vol: 0.25, delay: 0.18 });
      timers.push(setTimeout(beat, 900 - 520 * progress()));
    };
    const step = () => {
      if (stopped) return;
      this.tone(70, 0.18, { type: "triangle", vol: 0.08 + 0.4 * progress() });
      timers.push(setTimeout(step, 600));
    };
    beat();
    timers.push(setTimeout(step, 300));
    return () => { stopped = true; timers.forEach(clearTimeout); };
  },
};
