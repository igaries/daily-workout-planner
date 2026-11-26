import type { SoundId } from "./types";

let ctx: AudioContext | null = null;

export async function unlockAudio(): Promise<AudioContext> {
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  return ctx;
}

function limiter(ac: AudioContext): DynamicsCompressorNode {
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -3;
  comp.knee.value = 0;
  comp.ratio.value = 20;
  comp.attack.value = 0.001;
  comp.release.value = 0.05;
  comp.connect(ac.destination);
  return comp;
}

function tone(
  ac: AudioContext,
  dest: AudioNode,
  {
    type,
    freq,
    start,
    dur,
    gain = 0.35,
    attack = 0.008,
    release = 0.04,
    detune = 0,
  }: {
    type: OscillatorType;
    freq: number;
    start: number;
    dur: number;
    gain?: number;
    attack?: number;
    release?: number;
    detune?: number;
  },
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  const t0 = ac.currentTime + start;
  const t1 = t0 + dur;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.setValueAtTime(gain, Math.max(t0 + attack, t1 - release));
  g.gain.exponentialRampToValueAtTime(0.0001, t1);
  osc.connect(g);
  g.connect(dest);
  osc.start(t0);
  osc.stop(t1 + 0.02);
  return osc;
}

function vibrate() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([400, 120, 400, 120, 400]);
    }
  } catch {
    /* ignore */
  }
}

async function play(id: SoundId) {
  const ac = await unlockAudio();
  const dest = limiter(ac);
  const t = 0;

  switch (id) {
    case "alarm": {
      // 2 groups of 4 square beeps at 2050 Hz, 70 ms, 120 ms apart; groups 620 ms apart
      for (let group = 0; group < 2; group++) {
        for (let i = 0; i < 4; i++) {
          const start = group * 0.62 + i * 0.12;
          tone(ac, dest, {
            type: "square",
            freq: 2050,
            start,
            dur: 0.07,
            gain: 0.28,
          });
        }
      }
      break;
    }
    case "airhorn": {
      // Sawtooth stack 466, 470, 932, 1398 Hz, 1.1 s, glide 2% down
      const freqs = [466, 470, 932, 1398];
      for (const f of freqs) {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = "sawtooth";
        const t0 = ac.currentTime;
        osc.frequency.setValueAtTime(f, t0);
        osc.frequency.linearRampToValueAtTime(f * 0.98, t0 + 1.1);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.008);
        g.gain.setValueAtTime(0.18, t0 + 1.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
        osc.connect(g);
        g.connect(dest);
        osc.start(t0);
        osc.stop(t0 + 1.15);
      }
      break;
    }
    case "siren": {
      // Square sweeping 900→1900→900 twice over 1.6 s
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = "square";
      const t0 = ac.currentTime;
      osc.frequency.setValueAtTime(900, t0);
      osc.frequency.linearRampToValueAtTime(1900, t0 + 0.4);
      osc.frequency.linearRampToValueAtTime(900, t0 + 0.8);
      osc.frequency.linearRampToValueAtTime(1900, t0 + 1.2);
      osc.frequency.linearRampToValueAtTime(900, t0 + 1.6);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.008);
      g.gain.setValueAtTime(0.22, t0 + 1.55);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
      osc.connect(g);
      g.connect(dest);
      osc.start(t0);
      osc.stop(t0 + 1.65);
      break;
    }
    case "whistle": {
      // 2900 Hz triangle with 38 Hz → 140 Hz warble + quieter square; blasts 0.32 & 0.6
      const blasts: [number, number][] = [
        [0, 0.32],
        [0.4, 0.6],
      ];
      for (const [start, dur] of blasts) {
        const t0 = ac.currentTime + start;
        const tri = ac.createOscillator();
        const sq = ac.createOscillator();
        const lfo = ac.createOscillator();
        const lfoGain = ac.createGain();
        const g = ac.createGain();
        const g2 = ac.createGain();
        tri.type = "triangle";
        sq.type = "square";
        lfo.type = "sine";
        tri.frequency.value = 2900;
        sq.frequency.value = 2900;
        lfo.frequency.setValueAtTime(38, t0);
        lfo.frequency.linearRampToValueAtTime(140, t0 + dur);
        lfoGain.gain.value = 80;
        lfo.connect(lfoGain);
        lfoGain.connect(tri.frequency);
        lfoGain.connect(sq.frequency);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.008);
        g.gain.setValueAtTime(0.3, t0 + dur - 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        g2.gain.setValueAtTime(0.0001, t0);
        g2.gain.exponentialRampToValueAtTime(0.08, t0 + 0.008);
        g2.gain.setValueAtTime(0.08, t0 + dur - 0.04);
        g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        tri.connect(g);
        sq.connect(g2);
        g.connect(dest);
        g2.connect(dest);
        lfo.start(t0);
        tri.start(t0);
        sq.start(t0);
        lfo.stop(t0 + dur + 0.02);
        tri.stop(t0 + dur + 0.02);
        sq.stop(t0 + dur + 0.02);
      }
      break;
    }
    case "bell": {
      // 3 strikes 300 ms apart; partials 1, 2.76, 5.4, 8.93 × 1180 Hz
      const partials = [1, 2.76, 5.4, 8.93];
      const base = 1180;
      for (let strike = 0; strike < 3; strike++) {
        const t0 = ac.currentTime + strike * 0.3;
        for (const p of partials) {
          const osc = ac.createOscillator();
          const g = ac.createGain();
          osc.type = "sine";
          osc.frequency.value = base * p;
          const amp = 0.25 / p;
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(amp, t0 + 0.008);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
          osc.connect(g);
          g.connect(dest);
          osc.start(t0);
          osc.stop(t0 + 1.25);
        }
      }
      break;
    }
    case "buzzer": {
      // Sawtooth 180, 362, 1450 + square 724, 1 s
      const saws = [180, 362, 1450];
      for (const f of saws) {
        tone(ac, dest, {
          type: "sawtooth",
          freq: f,
          start: t,
          dur: 1,
          gain: 0.16,
        });
      }
      tone(ac, dest, {
        type: "square",
        freq: 724,
        start: t,
        dur: 1,
        gain: 0.12,
      });
      break;
    }
    case "triple": {
      // 3 square beeps at 1760 Hz, 260 ms, 360 ms apart
      for (let i = 0; i < 3; i++) {
        tone(ac, dest, {
          type: "square",
          freq: 1760,
          start: i * 0.36,
          dur: 0.26,
          gain: 0.28,
        });
      }
      break;
    }
  }

  vibrate();
}

export async function playSound(id: SoundId): Promise<void> {
  try {
    await play(id);
  } catch {
    /* audio may be blocked */
  }
}
