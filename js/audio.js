// Sons e música sintetizados com Web Audio (sem arquivos).
export class Sfx {
  constructor() { this.ctx = null; this.music = null; }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _out(pan = 0) {
    const c = this.ctx;
    if (!c.createStereoPanner) return this.master;
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(this.master);
    return p;
  }

  _tone(freq, dur, vol, { pan = 0, type = 'sine', bend = 1, delay = 0 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * bend), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this._out(pan));
    o.start(t); o.stop(t + dur + 0.02);
  }

  _noise(dur, vol, freq, { q = 1, pan = 0, attack = 0.002, type = 'bandpass', delay = 0 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this._out(pan));
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  shot(pan = 0) {
    this._noise(0.25, 0.7, 1800, { q: 0.6, pan, type: 'lowpass' });
    this._tone(140, 0.18, 0.6, { pan, bend: 0.4 });
  }
  empty(pan = 0) { this._tone(2400, 0.03, 0.25, { pan, type: 'square' }); }
  reload(pan = 0) {
    for (let i = 0; i < 3; i++) this._tone(1600 + i * 200, 0.03, 0.18, { pan, type: 'square', delay: i * 0.12 });
    this._tone(500, 0.08, 0.25, { pan, delay: 0.5 });
  }
  hit(pan = 0) { this._noise(0.12, 0.35, 500, { q: 1.2, pan }); }
  armor(pan = 0) { this._tone(2200, 0.15, 0.2, { pan, type: 'triangle', bend: 0.9 }); }
  kill(pan = 0) { this._noise(0.3, 0.3, 300, { q: 0.8, pan, attack: 0.02 }); this._tone(160, 0.35, 0.25, { pan, type: 'sawtooth', bend: 0.5 }); }
  groan(pan = 0) {
    this._tone(90 + Math.random() * 50, 0.9, 0.12, { pan, type: 'sawtooth', bend: 0.7 });
    this._noise(0.8, 0.06, 400, { q: 2, pan, attack: 0.2 });
  }
  screech(pan = 0) { for (let i = 0; i < 3; i++) this._tone(3200 - i * 300, 0.06, 0.08, { pan, type: 'square', delay: i * 0.07, bend: 1.3 }); }
  spit(pan = 0) { this._noise(0.25, 0.25, 900, { q: 3, pan, attack: 0.05 }); }
  hurt() { this._tone(70, 0.4, 0.6, { type: 'sawtooth', bend: 0.6 }); this._noise(0.3, 0.4, 250, { q: 0.7 }); }
  pickup() { [660, 880, 1320].forEach((f, i) => this._tone(f, 0.15, 0.2, { type: 'triangle', delay: i * 0.08 })); }
  roar() { this._tone(60, 1.6, 0.35, { type: 'sawtooth', bend: 1.8 }); this._noise(1.4, 0.3, 200, { q: 0.6, attack: 0.3 }); }
  click() { this._tone(440, 0.05, 0.18, { type: 'square', bend: 1.4 }); }
  sting(win) {
    const notes = win ? [392, 494, 587, 784] : [330, 311, 294, 220];
    notes.forEach((f, i) => this._tone(f, 0.5, 0.18, { type: 'triangle', delay: i * 0.18 }));
  }

  // Música de fundo: zumbido grave que fica mais tenso no chefe (intensity 0..1).
  setMusic(on, intensity = 0) {
    if (!this.ctx) return;
    if (!this.music && on) {
      const c = this.ctx;
      const g = c.createGain(); g.gain.value = 0; g.connect(this.master);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300; f.connect(g);
      const oscs = [55, 55.7, 82.4].map((fr) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(); return o; });
      const lfo = c.createOscillator(); lfo.frequency.value = 0.08;
      const lg = c.createGain(); lg.gain.value = 150; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
      this.music = { g, f, oscs, lfo };
    }
    if (!this.music) return;
    const t = this.ctx.currentTime;
    this.music.g.gain.setTargetAtTime(on ? 0.05 + intensity * 0.05 : 0, t, 0.8);
    this.music.oscs[2].frequency.setTargetAtTime(intensity > 0.5 ? 87.3 : 82.4, t, 0.5);
    this.music.lfo.frequency.setTargetAtTime(0.08 + intensity * 0.6, t, 0.5);
  }
}
