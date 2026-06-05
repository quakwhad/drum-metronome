import * as Tone from "tone";

export type DrumTrack = {
  name: string;
  sampleKey: string;
};

export const TRACKS: DrumTrack[] = [
  { name: "Bass",   sampleKey: "kick"  },
  { name: "Snare",  sampleKey: "snare" },
  { name: "Hi-hat", sampleKey: "hihat" },
  { name: "Tom Hi", sampleKey: "tom1"  },
  { name: "Tom Mid",sampleKey: "tom2"  },
  { name: "Tom Lo", sampleKey: "tom3"  },
];

export type KitName = "acoustic-kit" | "LINN";
export const KIT_NAMES: KitName[] = ["acoustic-kit", "LINN"];

let players: Tone.Players | null = null;
let loadedKit: KitName | null = null;
let loading = false;

export function isLoading() { return loading; }

export async function loadKit(kit: KitName): Promise<void> {
  if (loadedKit === kit && players) return;
  loading = true;
  if (players) { players.dispose(); players = null; }

  const urls: Record<string, string> = {};
  for (const track of TRACKS) {
    urls[track.sampleKey] = `/samples/${kit}/${track.sampleKey}.mp3`;
  }

  await new Promise<void>((resolve, reject) => {
    players = new Tone.Players(urls, { onload: resolve, onerror: reject }).toDestination();
  });

  loadedKit = kit;
  loading = false;
}

export async function initAudio(kit: KitName = "CR78") {
  await Tone.start();
  await loadKit(kit);
}

export function triggerDrum(sampleKey: string, time?: number) {
  if (!players) return;
  try { players.player(sampleKey).start(time ?? Tone.now()); } catch {}
}

export function setTrackVolume(sampleKey: string, vol: number) {
  if (!players) return;
  try {
    players.player(sampleKey).volume.value =
      vol <= 0 ? -Infinity : Tone.gainToDb(vol);
  } catch {}
}
