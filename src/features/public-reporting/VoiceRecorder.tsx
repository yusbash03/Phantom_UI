import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, RotateCcw, Square, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MAX_RECORDING_BYTES, MAX_RECORDING_SECONDS, canRecord, formatDuration, pickFormat } from './recorder'

interface VoiceRecorderProps {
  value: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
}

type State = { kind: 'idle' } | { kind: 'recording'; seconds: number } | { kind: 'error'; message: string }

/**
 * Records a short voice note in the browser (Requirement 4.1). Nothing leaves the device until the report is
 * submitted. Hidden where the browser cannot record; an audio file can still be attached instead.
 */
export function VoiceRecorder({ value, onChange, disabled }: VoiceRecorderProps) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const recorder = useRef<MediaRecorder | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const previewUrl = useMemo(() => (value ? URL.createObjectURL(value) : null), [value])
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(
    () => () => {
      clearInterval(timer.current)
      if (recorder.current?.state === 'recording') recorder.current.stop()
    },
    [],
  )

  if (!canRecord()) return null

  async function start() {
    const format = pickFormat((m) => MediaRecorder.isTypeSupported(m))
    if (!format) {
      setState({ kind: 'error', message: 'This browser cannot record audio. You can attach an audio file instead.' })
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setState({ kind: 'error', message: 'Microphone access was blocked. Allow it and try again, or attach an audio file instead.' })
      return
    }

    const [mime, base, extension] = format
    const chunks: Blob[] = []
    const media = new MediaRecorder(stream, { mimeType: mime })
    media.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    media.onstop = () => {
      clearInterval(timer.current)
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunks, { type: base })
      if (blob.size === 0) {
        setState({ kind: 'error', message: 'Nothing was recorded. Please try again.' })
      } else if (blob.size > MAX_RECORDING_BYTES) {
        setState({ kind: 'error', message: 'The recording is larger than 10 MB. Please record a shorter note.' })
      } else {
        onChange(new File([blob], `voice-note.${extension}`, { type: base }))
        setState({ kind: 'idle' })
      }
    }
    recorder.current = media
    media.start(1000)
    setState({ kind: 'recording', seconds: 0 })
    const startedAt = Date.now()
    timer.current = setInterval(() => {
      const seconds = (Date.now() - startedAt) / 1000
      if (seconds >= MAX_RECORDING_SECONDS) media.stop()
      else setState({ kind: 'recording', seconds })
    }, 250)
  }

  function stop() {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }

  function remove() {
    onChange(null)
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3" aria-labelledby="voice-note-label">
      <p id="voice-note-label" className="text-sm font-medium">
        Voice note (optional)
      </p>
      <p className="text-xs text-muted-foreground">
        Describe what is happening in your own words, up to {MAX_RECORDING_SECONDS / 60} minutes. It may be transcribed automatically for the coordinators.
      </p>

      {state.kind === 'recording' ? (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm" role="timer" aria-live="off" aria-label="Recording time">
            <span className="size-2.5 animate-pulse rounded-full bg-destructive" aria-hidden />
            Recording {formatDuration(state.seconds)}
          </span>
          <Button type="button" size="sm" variant="destructive" onClick={stop}>
            <Square aria-hidden /> Stop recording
          </Button>
        </div>
      ) : value && previewUrl ? (
        <div className="space-y-2">
          {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- the reporter's own note, just recorded; no captions exist yet */}
          <audio controls src={previewUrl} className="w-full" aria-label="Your voice note" />
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void start()} disabled={disabled}>
              <RotateCcw aria-hidden /> Record again
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={remove} disabled={disabled}>
              <Trash2 aria-hidden /> Remove voice note
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => void start()} disabled={disabled}>
          <Mic aria-hidden /> Record a voice note
        </Button>
      )}

      {state.kind === 'error' && (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      )}
    </div>
  )
}
