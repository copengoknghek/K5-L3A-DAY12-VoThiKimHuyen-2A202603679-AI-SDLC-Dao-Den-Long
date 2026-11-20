/** Âm thanh procedural (Web Audio) — không file ngoài, không bản quyền */

export class GameAudio {
  private ctx: AudioContext | null = null;
  volume = 0.7;

  async ensure(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    decay = true,
  ): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    if (decay) {
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  playMotePickup(): void {
    this.tone(880, 0.12, "sine", 0.08);
    this.tone(1320, 0.08, "sine", 0.04);
  }

  playPulse(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.25);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  playLanternLit(): void {
    this.tone(220, 0.35, "triangle", 0.1);
    this.tone(330, 0.3, "sine", 0.06);
  }

  playHit(): void {
    this.tone(90, 0.2, "sawtooth", 0.08);
  }
  playJump(): void {
    this.tone(400, 0.08, "square", 0.04);
  }
  playDash(): void {
    this.tone(240, 0.12, "triangle", 0.07);
  }
  playWin(): void {
    this.tone(523, 0.2, "sine", 0.08);
    this.tone(659, 0.25, "sine", 0.06);
  }
  playLose(): void {
    this.tone(160, 0.4, "sine", 0.08);
  }
  playSpawn(): void {
    this.tone(110, 0.15, "sine", 0.05);
  }
  playWarn(): void {
    this.tone(880, 0.08, "square", 0.05);
  }
}