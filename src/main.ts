import { TRACKS, KIT_NAMES, KitName, loadKit, setTrackVolume } from "./drums";
import {
  getState, initSteps, toggleStep, clearAll,
  setBars, setSig, setBpmUnit, setLoopRange, setCountIn,
  startSequencer, stopSequencer, updateBpm,
  setTickCallback, setCountInCallback,
  applyPattern,
  TimeSignature, BpmNoteUnit, BPM_NOTE_OPTIONS,
} from "./sequencer";

// ── State ──────────────────────────────────────────────────────────────────
let bpm = 90;
let playing = false;
let currentKit: KitName = "acoustic-kit";
const trackVolumes = TRACKS.map(() => 1.0);

type Preset = {
  name: string;
  sig: TimeSignature;
  bpmUnit: BpmNoteUnit;
  bpm: number;
  pattern: { key: string; steps: number[] }[];
};

const PRESETS: Preset[] = [
  {
    name: "12/8 기본",
    sig: "12/8", bpmUnit: "4n.", bpm: 60,
    // 24스텝: 6그룹×4스텝. 정박(0,12)에 베이스, 엇박에 하이햇
    pattern: [
      { key: "kick",  steps: [0, 12] },
      { key: "hihat", steps: [2,4,6,8,10, 14,16,18,20,22] },
    ],
  },
  {
    name: "4/4 기본",
    sig: "4/4", bpmUnit: "4n", bpm: 90,
    pattern: [
      { key: "kick",  steps: [0, 8] },
      { key: "snare", steps: [4, 12] },
      { key: "hihat", steps: [0,2,4,6,8,10,12,14] },
    ],
  },
  {
    name: "4/4 록",
    sig: "4/4", bpmUnit: "4n", bpm: 120,
    pattern: [
      { key: "kick",  steps: [0, 6, 8] },
      { key: "snare", steps: [4, 12] },
      { key: "hihat", steps: [0,2,4,6,8,10,12,14] },
    ],
  },
  {
    name: "슬로우 블루스",
    sig: "12/8", bpmUnit: "4n.", bpm: 45,
    // 24스텝: 큰 박 4개(0,6,12,18), 스네어는 2,4박(6,18)
    pattern: [
      { key: "kick",  steps: [0, 12] },
      { key: "snare", steps: [6, 18] },
      { key: "hihat", steps: [0, 6, 12, 18] },
    ],
  },
];

// ── Bootstrap ──────────────────────────────────────────────────────────────
initSteps();
setTickCallback(render);
setCountInCallback(updateCountIn);
loadKit(currentKit);

// ── Build UI ───────────────────────────────────────────────────────────────
const app = document.getElementById("app")!;
app.innerHTML = `
  <h1>DRUM METRONOME</h1>

  <div class="controls">
    <div class="control-group">
      <label>Kit</label>
      <select id="kit">
        ${KIT_NAMES.map(k => `<option value="${k}"${k === currentKit ? " selected" : ""}>${k}</option>`).join("")}
      </select>
    </div>
    <div class="control-group">
      <label>Time Sig</label>
      <select id="sig">
        <option value="4/4">4/4</option>
        <option value="6/8">6/8</option>
        <option value="12/8">12/8</option>
      </select>
    </div>
    <div class="control-group">
      <label>BPM 기준</label>
      <select id="bpm-unit">
        ${BPM_NOTE_OPTIONS.map(o => `<option value="${o.value}"${o.value === "4n" ? " selected" : ""}>${o.label}</option>`).join("")}
      </select>
    </div>
    <div class="control-group">
      <label>BPM</label>
      <div class="bpm-row">
        <button class="bpm-step-btn" id="bpm-dec">−</button>
        <input type="number" id="bpm-display" class="bpm-input" min="20" max="280" value="${bpm}" />
        <button class="bpm-step-btn" id="bpm-inc">+</button>
      </div>
      <input type="range" id="bpm-range" min="20" max="280" value="${bpm}" />
    </div>
    <div class="btn-row">
      <button class="btn btn-play" id="play-btn">▶ PLAY</button>
      <button class="btn btn-clear" id="clear-btn">CLEAR</button>
      <div id="count-display" class="count-display"></div>
    </div>
  </div>

  <div class="sub-controls">
    <label class="checkbox-label">
      <input type="checkbox" id="count-in" /> 카운트인
    </label>
    <div class="loop-control">
      <span>Loop</span>
      <select id="loop-start"><option>1</option></select>
      <span>~</span>
      <select id="loop-end"><option>2</option></select>
      <span>마디</span>
    </div>
  </div>

  <div class="preset-row">
    ${PRESETS.map((p, i) => `<button class="btn btn-preset" data-preset="${i}">${p.name}</button>`).join("")}
  </div>

  <div class="bars-row">
    <button id="bars-dec">−</button>
    <span id="bars-label"></span>
    <button id="bars-inc">+</button>
  </div>

  <div class="sequencer" id="sequencer"></div>
`;

// ── Event Listeners ────────────────────────────────────────────────────────
document.getElementById("kit")!.addEventListener("change", async (e) => {
  currentKit = (e.target as HTMLSelectElement).value as KitName;
  loadKit(currentKit);
  if (playing) { await restartPlaying(); }
});

document.getElementById("sig")!.addEventListener("change", (e) => {
  const newSig = (e.target as HTMLSelectElement).value as TimeSignature;
  setSig(newSig);
  // suggest sensible BPM unit
  if (newSig === "6/8" || newSig === "12/8") {
    (document.getElementById("bpm-unit") as HTMLSelectElement).value = "4n.";
    setBpmUnit("4n.");
  }
  updateLoopSelects();
  if (playing) restartPlaying();
  render(-1);
});

document.getElementById("bpm-unit")!.addEventListener("change", (e) => {
  setBpmUnit((e.target as HTMLSelectElement).value as BpmNoteUnit);
  if (playing) updateBpm(bpm);
});

function setBpm(val: number) {
  bpm = Math.max(20, Math.min(280, val));
  (document.getElementById("bpm-display") as HTMLInputElement).value = String(bpm);
  (document.getElementById("bpm-range") as HTMLInputElement).value = String(bpm);
  if (playing) updateBpm(bpm);
}

document.getElementById("bpm-range")!.addEventListener("input", (e) => {
  setBpm(Number((e.target as HTMLInputElement).value));
});

document.getElementById("bpm-display")!.addEventListener("change", (e) => {
  setBpm(Number((e.target as HTMLInputElement).value));
});

document.getElementById("bpm-dec")!.addEventListener("click", () => setBpm(bpm - 1));
document.getElementById("bpm-inc")!.addEventListener("click", () => setBpm(bpm + 1));

document.getElementById("play-btn")!.addEventListener("click", async () => {
  playing = !playing;
  if (playing) {
    setPlayingUI(true);
    await startSequencer(bpm, currentKit);
    applyVolumes();
  } else {
    setPlayingUI(false);
    stopSequencer();
  }
});

document.getElementById("clear-btn")!.addEventListener("click", () => {
  clearAll(); render(-1);
});

document.getElementById("count-in")!.addEventListener("change", (e) => {
  setCountIn((e.target as HTMLInputElement).checked);
});

document.getElementById("loop-start")!.addEventListener("change", () => updateLoop());
document.getElementById("loop-end")!.addEventListener("change", () => updateLoop());

document.getElementById("bars-dec")!.addEventListener("click", () => {
  const { bars } = getState();
  setBars(bars - 1);
  updateLoopSelects();
  if (playing) restartPlaying();
  render(-1);
});

document.getElementById("bars-inc")!.addEventListener("click", () => {
  const { bars } = getState();
  setBars(bars + 1);
  updateLoopSelects();
  if (playing) restartPlaying();
  render(-1);
});

document.querySelectorAll(".btn-preset").forEach(btn => {
  btn.addEventListener("click", () => {
    const idx = Number((btn as HTMLElement).dataset.preset);
    applyPreset(PRESETS[idx]);
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────
function applyPreset(preset: Preset) {
  if (playing) { stopSequencer(); setPlayingUI(false); playing = false; }

  const sigEl = document.getElementById("sig") as HTMLSelectElement;
  const unitEl = document.getElementById("bpm-unit") as HTMLSelectElement;
  const rangeEl = document.getElementById("bpm-range") as HTMLInputElement;

  sigEl.value = preset.sig;
  setSig(preset.sig);

  unitEl.value = preset.bpmUnit;
  setBpmUnit(preset.bpmUnit);

  bpm = preset.bpm;
  rangeEl.value = String(bpm);
  document.getElementById("bpm-display")!.textContent = String(bpm);

  applyPattern(preset.pattern, getState().bars);
  updateLoopSelects();
  render(-1);
}

function updateLoopSelects() {
  const { bars, loopStartBar, loopEndBar } = getState();
  const startEl = document.getElementById("loop-start") as HTMLSelectElement;
  const endEl = document.getElementById("loop-end") as HTMLSelectElement;

  const buildOptions = (sel: HTMLSelectElement, selected: number) => {
    sel.innerHTML = Array.from({ length: bars }, (_, i) =>
      `<option value="${i}"${i === selected ? " selected" : ""}>${i + 1}</option>`
    ).join("");
  };

  buildOptions(startEl, loopStartBar);
  buildOptions(endEl, Math.min(loopEndBar, bars - 1));
}

function updateLoop() {
  const start = Number((document.getElementById("loop-start") as HTMLSelectElement).value);
  const end   = Number((document.getElementById("loop-end")   as HTMLSelectElement).value);
  setLoopRange(start, Math.max(start, end));
  if (playing) restartPlaying();
}

async function restartPlaying() {
  stopSequencer();
  await startSequencer(bpm, currentKit);
  applyVolumes();
}

function applyVolumes() {
  TRACKS.forEach((track, i) => setTrackVolume(track.sampleKey, trackVolumes[i]));
}

function setPlayingUI(isPlaying: boolean) {
  const btn = document.getElementById("play-btn")!;
  btn.textContent = isPlaying ? "■ STOP" : "▶ PLAY";
  btn.classList.toggle("playing", isPlaying);
}

function updateCountIn(beat: number) {
  const el = document.getElementById("count-display")!;
  el.textContent = beat > 0 ? String(beat) : "";
}

// ── Render ─────────────────────────────────────────────────────────────────
const BARS_PER_ROW = 2;

function calcStepSize(stepsPerBar: number): number {
  const stepsInRow = BARS_PER_ROW * stepsPerBar;
  const available = app.clientWidth - 200; // label wrap + padding + gaps estimate
  return Math.max(20, Math.min(36, Math.floor(available / stepsInRow)));
}

function buildBarGroup(
  rowStartBar: number, rowEndBar: number,
  bars: number, stepsPerBar: number, sig: string,
  steps: boolean[][], loopStartBar: number, loopEndBar: number,
  currentStep: number
): HTMLElement {
  const group = document.createElement("div");
  group.className = "bar-group";

  // Bar number header
  const header = document.createElement("div");
  header.className = "bar-group-header";
  const spacer = document.createElement("div");
  spacer.className = "track-label-wrap";
  header.appendChild(spacer);
  for (let b = rowStartBar; b <= rowEndBar; b++) {
    if (b > rowStartBar) {
      const sepSpacer = document.createElement("div");
      sepSpacer.style.width = "2px";
      header.appendChild(sepSpacer);
    }
    const barLabel = document.createElement("div");
    barLabel.className = "bar-num-label";
    barLabel.textContent = `마디 ${b + 1}`;
    barLabel.style.width = `${stepsPerBar * (calcStepSize(stepsPerBar) + 3) - 3}px`;
    header.appendChild(barLabel);
  }
  group.appendChild(header);

  TRACKS.forEach((track, ti) => {
    const row = document.createElement("div");
    row.className = "track";

    const labelWrap = document.createElement("div");
    labelWrap.className = "track-label-wrap";

    const label = document.createElement("div");
    label.className = "track-label";
    label.textContent = track.name;

    const volSlider = document.createElement("input");
    volSlider.type = "range";
    volSlider.min = "0"; volSlider.max = "100";
    volSlider.value = String(Math.round(trackVolumes[ti] * 100));
    volSlider.className = "vol-slider";
    volSlider.title = "볼륨";
    volSlider.addEventListener("input", () => {
      trackVolumes[ti] = Number(volSlider.value) / 100;
      setTrackVolume(track.sampleKey, trackVolumes[ti]);
    });

    labelWrap.appendChild(label);
    labelWrap.appendChild(volSlider);
    row.appendChild(labelWrap);

    const stepsDiv = document.createElement("div");
    stepsDiv.className = "steps";

    for (let b = rowStartBar; b <= rowEndBar; b++) {
      if (b > rowStartBar) {
        const sep = document.createElement("div");
        sep.className = "bar-sep";
        if (b > loopStartBar && b <= loopEndBar) sep.classList.add("in-loop");
        stepsDiv.appendChild(sep);
      }
      for (let s = 0; s < stepsPerBar; s++) {
        const idx = b * stepsPerBar + s;
        const btn = document.createElement("button");
        btn.className = "step";
        const groupSize = (sig === "12/8" || sig === "6/8") ? 6 : 4;
        if (s % groupSize === 0 && s > 0) btn.classList.add("beat-start");
        if (b >= loopStartBar && b <= loopEndBar) btn.classList.add("in-loop");

        btn.dataset.track = String(ti);
        btn.dataset.idx = String(idx);
        if (steps[ti][idx]) btn.classList.add("active");
        if (idx === currentStep) btn.classList.add("current");

        btn.addEventListener("click", () => {
          toggleStep(ti, idx);
          btn.classList.toggle("active");
        });
        stepsDiv.appendChild(btn);
      }
    }

    row.appendChild(stepsDiv);
    group.appendChild(row);
  });

  return group;
}

function render(currentStep: number) {
  const { steps, bars, sig, stepsPerBar, loopStartBar, loopEndBar } = getState();
  const seq = document.getElementById("sequencer")!;

  document.getElementById("bars-label")!.textContent = `${bars} bar${bars > 1 ? "s" : ""}`;

  const stepSize = calcStepSize(stepsPerBar);
  document.documentElement.style.setProperty("--step-size", `${stepSize}px`);

  const expectedGroups = Math.ceil(bars / BARS_PER_ROW);
  const expectedCells  = TRACKS.length * bars * stepsPerBar;
  const existingCells  = seq.querySelectorAll(".step").length;

  if (existingCells !== expectedCells) {
    seq.innerHTML = "";
    for (let row = 0; row < expectedGroups; row++) {
      const rowStart = row * BARS_PER_ROW;
      const rowEnd   = Math.min(rowStart + BARS_PER_ROW - 1, bars - 1);
      seq.appendChild(buildBarGroup(rowStart, rowEnd, bars, stepsPerBar, sig, steps, loopStartBar, loopEndBar, currentStep));
    }
  } else {
    seq.querySelectorAll<HTMLButtonElement>(".step").forEach((btn) => {
      const ti  = Number(btn.dataset.track);
      const idx = Number(btn.dataset.idx);
      const b   = Math.floor(idx / stepsPerBar);
      btn.classList.toggle("active",   steps[ti][idx]);
      btn.classList.toggle("current",  idx === currentStep);
      btn.classList.toggle("in-loop",  b >= loopStartBar && b <= loopEndBar);
    });
    seq.querySelectorAll<HTMLElement>(".bar-sep").forEach((sep) => {
      const nextStep = sep.nextElementSibling as HTMLElement;
      if (!nextStep) return;
      const b = Math.floor(Number(nextStep.dataset.idx ?? 0) / stepsPerBar);
      sep.classList.toggle("in-loop", b > loopStartBar && b <= loopEndBar);
    });
  }
}

window.addEventListener("resize", () => {
  const { stepsPerBar } = getState();
  document.documentElement.style.setProperty("--step-size", `${calcStepSize(stepsPerBar)}px`);
});

updateLoopSelects();
updateStepSize();
render(-1);
