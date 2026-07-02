// ===== Web Audio 효과음 (음원 파일 없이 코드로 생성) =====

class SFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  // 사용자 제스처 이후 호출해야 함
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone(freq, dur = 0.15, type = 'sine', gain = 0.18, when = 0, slideTo = null) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise(dur = 0.12, gain = 0.15, when = 0) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + when;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.ctx.destination);
    src.start(t0);
  }

  // --- 프리셋 ---
  tap()    { this.tone(660, 0.06, 'triangle', 0.1); }
  open()   { this.tone(440, 0.1, 'sine', 0.12); this.tone(660, 0.12, 'sine', 0.1, 0.07); }
  ok()     { this.tone(523, 0.1, 'sine', 0.15); this.tone(784, 0.16, 'sine', 0.15, 0.09); }
  bad()    { this.tone(220, 0.2, 'sawtooth', 0.1, 0, 140); }
  stamp()  {
    this.tone(523, 0.1, 'triangle', 0.16);
    this.tone(659, 0.1, 'triangle', 0.16, 0.1);
    this.tone(784, 0.12, 'triangle', 0.16, 0.2);
    this.tone(1046, 0.3, 'triangle', 0.16, 0.3);
  }
  portal() {
    this.tone(196, 0.6, 'sine', 0.14, 0, 392);
    this.tone(392, 0.7, 'sine', 0.1, 0.3, 784);
    this.tone(784, 0.9, 'sine', 0.08, 0.6, 1568);
  }
  goal()   { this.noise(0.25, 0.2); this.tone(880, 0.25, 'triangle', 0.14, 0.05); }
  kick()   { this.tone(150, 0.18, 'sine', 0.3, 0, 45); }
  snare()  { this.noise(0.12, 0.22); this.tone(200, 0.08, 'triangle', 0.1); }
  hihat()  { this.noise(0.05, 0.12); }
  cymbal() { this.noise(0.4, 0.14); this.tone(3200, 0.3, 'square', 0.03); }

  // 사이먼 패드 톤 (인덱스별)
  pad(i) {
    const freqs = [392, 494, 587, 698];
    this.tone(freqs[i % 4], 0.28, 'triangle', 0.16);
  }
  drumPad(i) {
    [() => this.kick(), () => this.snare(), () => this.hihat(), () => this.cymbal()][i % 4]();
  }
}

export const sfx = new SFX();
