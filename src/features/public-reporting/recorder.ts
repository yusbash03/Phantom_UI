/** A voice note is capped well under the 10 MB upload limit (Opus at ~32 kbit/s is about 0.7 MB for 3 minutes). */
export const MAX_RECORDING_SECONDS = 180
export const MAX_RECORDING_BYTES = 10 * 1024 * 1024

// Formats the API accepts (content-signature checked server-side): WebM/Opus (Chrome, Firefox), MP4 (Safari), Ogg.
const CANDIDATES: [mime: string, base: string, extension: string][] = [
  ['audio/webm;codecs=opus', 'audio/webm', 'webm'],
  ['audio/webm', 'audio/webm', 'webm'],
  ['audio/mp4', 'audio/mp4', 'm4a'],
  ['audio/ogg;codecs=opus', 'audio/ogg', 'ogg'],
]

export function canRecord(): boolean {
  return typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

/** The first recording format this browser supports, as [recorder mime type, upload mime type, file extension]. */
export function pickFormat(isTypeSupported: (mime: string) => boolean): [string, string, string] | null {
  return CANDIDATES.find(([mime]) => isTypeSupported(mime)) ?? null
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
