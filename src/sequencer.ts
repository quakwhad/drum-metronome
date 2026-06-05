import * as Tone from "tone";
import { TRACKS, triggerDrum, initAudio, KitName } from "./drums";

export type TimeSignature = "4/4" | "6/8" | "12/8";
export type BpmNoteUnit = "4n" | "4n." | "8n";

export const BPM_NOTE_OPTIONS: { value: BpmNoteUnit; label: string }[] = [
  { value: "4n",  label: "♩ 4분음표" },
  { value: "4n.", label: "♩. 점4분음표" },
  { value: "8n",  label: "♪ 8분음표" },
];

// Multiply user BPM by this to get Tone.js quarter-note BPM
const NOTE_RATIOS: Record<BpmNoteUnit, number> = {
  "4n": 1, "4n.": 1.5, "8n": 0.5,
};

const SIG_STEPS: Record<TimeSignature, number> = {
  "4/4": 16,
  "6/8": 12,   // 2그룹 × 6스텝 (16분음표 기준)
  "12/8": 24,  // 4그룹 × 6스텝 (16분음표 기준)
};

let steps: boolean[][] = [];
let bars = 2;
let sig: TimeSignature = "4/4";
let bpmUnit: BpmNoteUnit = "4n";
let loopStartBar = 0;
let loopEndBar = 1;
let countInEnabled = false;
let currentStep = -1;
let sequence: Tone.Sequence | null = null;

let onTick: ((step: number) => void) | null = null;
let onCountIn: ((beat: number) => void) | null = null;

export function getState() {
  return {
    steps, bars, sig, bpmUnit, currentStep,
    stepsPerBar: SIG_STEPS[sig],
    loopStartBar, loopEndBar, countInEnabled,
  };
}

export function initSteps() {
  const total = bars * SIG_STEPS[sig];
  steps = TRACKS.map((_, i) =>
    steps[i] ? resizeArr(steps[i], total) : new Array(total).fill(false)
  );
}

function resizeArr(arr: boolean[], len: number): boolean[] {
  if (arr.length === len) return arr;
  if (arr.length > len) return arr.slice(0, len);
  return [...arr, ...new Array(len - arr.length).fill(false)];
}

export function toggleStep(track: number, stepIdx: number) {
  steps[track][stepIdx] = !steps[track][stepIdx];
}

export function clearAll() {
  steps = steps.map(row => row.map(() => false));
}

export function setBars(n: number) {
  bars = Math.max(1, Math.min(8, n));
  loopEndBar = Math.min(loopEndBar, bars - 1);
  loopStartBar = Math.min(loopStartBar, loopEndBar);
  initSteps();
}

export function setSig(s: TimeSignature) {
  sig = s;
  initSteps();
}

export function setBpmUnit(u: BpmNoteUnit) { bpmUnit = u; }
export function setLoopRange(start: number, end: number) {
  loopStartBar = Math.max(0, Math.min(start, bars - 1));
  loopEndBar = Math.max(loopStartBar, Math.min(end, bars - 1));
}
export function setCountIn(enabled: boolean) { countInEnabled = enabled; }
export function setTickCallback(fn: (step: number) => void) { onTick = fn; }
export function setCountInCallback(fn: (beat: number) => void) { onCountIn = fn; }

export function applyPattern(pattern: { key: string; steps: number[] }[], targetBars: number) {
  const spb = SIG_STEPS[sig];
  steps = steps.map(() => new Array(bars * spb).fill(false));
  TRACKS.forEach((track, ti) => {
    const p = pattern.find(p => p.key === track.sampleKey);
    if (!p) return;
    for (let b = 0; b < targetBars; b++) {
      p.steps.forEach(s => {
        const idx = b * spb + s;
        if (idx < steps[ti].length) steps[ti][idx] = true;
      });
    }
  });
}

export async function startSequencer(bpm: number, kit?: KitName) {
  await initAudio(kit);
  stopSequencer();

  const tonesBpm = bpm * NOTE_RATIOS[bpmUnit];
  Tone.getTransport().bpm.value = tonesBpm;

  const spb = SIG_STEPS[sig];
  const stepDuration = "16n";
  const loopStartStep = loopStartBar * spb;
  const loopEndStep = (loopEndBar + 1) * spb;
  const loopStepCount = loopEndStep - loopStartStep;

  sequence = new Tone.Sequence(
    (time, localIdx) => {
      currentStep = loopStartStep + (localIdx as number);
      TRACKS.forEach((track, ti) => {
        if (steps[ti][currentStep]) triggerDrum(track.sampleKey, time);
      });
      if (onTick) Tone.getDraw().schedule(() => onTick!(currentStep), time);
    },
    [...Array(loopStepCount).keys()],
    stepDuration
  );

  if (countInEnabled) {
    // actual beat duration regardless of note unit
    const beatSec = 60 / bpm;
    const startOffset = 0.1;
    const seqStartTime = startOffset + 4 * beatSec;

    sequence.start(`+${seqStartTime}`);
    Tone.getTransport().start(`+${startOffset}`);

    for (let i = 0; i < 4; i++) {
      const t = startOffset + i * beatSec;
      Tone.getTransport().schedule((time) => {
        if (i === 0) triggerDrum("kick", time);
        else triggerDrum("hihat", time);
        if (onCountIn) Tone.getDraw().schedule(() => onCountIn!(i + 1), time);
      }, `+${t}`);
    }
    // clear count-in display when sequence starts
    Tone.getTransport().schedule(() => {
      if (onCountIn) Tone.getDraw().schedule(() => onCountIn!(0), Tone.now());
    }, `+${seqStartTime}`);
  } else {
    sequence.start(0);
    Tone.getTransport().start();
  }
}

export function stopSequencer() {
  if (sequence) { sequence.stop(); sequence.dispose(); sequence = null; }
  Tone.getTransport().stop();
  Tone.getTransport().cancel();
  Tone.getTransport().position = 0;
  currentStep = -1;
  if (onTick) onTick(-1);
  if (onCountIn) onCountIn(0);
}

export function updateBpm(bpm: number) {
  Tone.getTransport().bpm.value = bpm * NOTE_RATIOS[bpmUnit];
}
