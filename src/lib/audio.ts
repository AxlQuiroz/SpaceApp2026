// Efectos de sonido chiptune generados en tiempo real con Web Audio.
// Sin archivos externos: cada efecto es una secuencia de notas de onda cuadrada.

export type Sfx = "click" | "alert" | "success" | "error" | "type";

type Note = { freq: number; dur: number; wave?: OscillatorType };

const SFX: Record<Sfx, Note[]> = {
  click: [{ freq: 880, dur: 0.04 }],
  type: [{ freq: 1320, dur: 0.015 }],
  success: [
    { freq: 523, dur: 0.08 },
    { freq: 659, dur: 0.08 },
    { freq: 784, dur: 0.14 },
  ],
  error: [
    { freq: 220, dur: 0.1, wave: "sawtooth" },
    { freq: 165, dur: 0.18, wave: "sawtooth" },
  ],
  alert: [
    { freq: 740, dur: 0.12 },
    { freq: 520, dur: 0.12 },
    { freq: 740, dur: 0.12 },
    { freq: 520, dur: 0.12 },
  ],
};

export class ChipSynth {
  private ctx: AudioContext | null = null;

  play(sfx: Sfx, volume: number) {
    if (typeof window === "undefined") return;
    try {
      this.ctx ??= new AudioContext();
      const ctx = this.ctx;
      let t = ctx.currentTime;
      for (const n of SFX[sfx]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = n.wave ?? "square";
        osc.frequency.value = n.freq;
        // Volumen bajo: la onda cuadrada es muy intensa.
        gain.gain.setValueAtTime(0.08 * volume, t);
        gain.gain.setValueAtTime(0, t + n.dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + n.dur + 0.01);
        t += n.dur;
      }
    } catch {
      /* navegador sin Web Audio: silencio */
    }
  }
}
