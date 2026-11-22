import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicReportPage } from './PublicReportPage'
import { formatDuration, pickFormat } from './recorder'
import { VoiceRecorder } from './VoiceRecorder'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  server.resetHandlers()
  vi.unstubAllGlobals()
})
afterAll(() => server.close())

/** A stand-in MediaRecorder: emits one chunk of fake Opus audio when stopped. */
class FakeMediaRecorder {
  static isTypeSupported = (mime: string) => mime.startsWith('audio/webm')
  state: 'inactive' | 'recording' = 'inactive'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  options: { mimeType: string }
  constructor(_stream: MediaStream, options: { mimeType: string }) {
    this.options = options
  }
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3])], { type: this.options.mimeType }) })
    this.onstop?.()
  }
}

const stopTrack = vi.fn<() => void>()

function allowMicrophone(getUserMedia: () => Promise<MediaStream> = () => Promise.resolve({ getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream)) {
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn<() => Promise<MediaStream>>(getUserMedia) }, configurable: true })
}

beforeEach(() => {
  stopTrack.mockClear()
  URL.createObjectURL = vi.fn<(b: Blob) => string>(() => 'blob:voice-note')
  URL.revokeObjectURL = vi.fn<(u: string) => void>()
})

describe('recorder helpers', () => {
  it('prefers WebM/Opus, then MP4 for Safari, and formats the elapsed time', () => {
    expect(pickFormat(() => true)).toEqual(['audio/webm;codecs=opus', 'audio/webm', 'webm'])
    expect(pickFormat((m) => m === 'audio/mp4')).toEqual(['audio/mp4', 'audio/mp4', 'm4a'])
    expect(pickFormat(() => false)).toBeNull()
    expect(formatDuration(75.9)).toBe('1:15')
  })
})

describe('VoiceRecorder', () => {
  it('records a voice note, lets the reporter listen back, and releases the microphone', async () => {
    allowMicrophone()
    const onChange = vi.fn<(f: File | null) => void>()
    const { rerender } = render(<VoiceRecorder value={null} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: /record a voice note/i }))
    expect(await screen.findByText(/^Recording 0:00$/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /stop recording/i }))

    const file = onChange.mock.calls.at(-1)![0]!
    expect(file.name).toBe('voice-note.webm')
    expect(file.type).toBe('audio/webm')
    expect(stopTrack).toHaveBeenCalled()

    rerender(<VoiceRecorder value={file} onChange={onChange} />)
    expect(screen.getByLabelText('Your voice note')).toHaveAttribute('src', 'blob:voice-note')
    await userEvent.click(screen.getByRole('button', { name: /remove voice note/i }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('explains a blocked microphone and points to attaching a file instead', async () => {
    allowMicrophone(() => Promise.reject(new DOMException('denied', 'NotAllowedError')))
    render(<VoiceRecorder value={null} onChange={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /record a voice note/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Microphone access was blocked. Allow it and try again, or attach an audio file instead.')
  })

  it('is hidden where the browser cannot record', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    const { container } = render(<VoiceRecorder value={null} onChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('submitting a voice note', () => {
  // jsdom's File cannot be serialised by Node's fetch, so this checks what the page puts in the submission;
  // the real upload to the API is covered by the Playwright voice test.
  it('adds the recording to the report’s attachments', async () => {
    allowMicrophone()
    const append = vi.spyOn(FormData.prototype, 'append')
    server.use(http.post('/api/v1/public/reports', () => HttpResponse.json({ reference: 'PH-2026-000777', submittedAt: new Date().toISOString() }, { status: 201 })))
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <PublicReportPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await userEvent.type(screen.getByLabelText(/title/i), 'Fire at the market')
    await userEvent.type(screen.getByLabelText(/description/i), 'Flames from the stalls, people shouting upstairs.')
    await userEvent.type(screen.getByLabelText(/^location/i), 'Central market, east gate')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /category/i }), 'Fire')
    await userEvent.click(screen.getByRole('button', { name: /record a voice note/i }))
    await act(async () => {
      await userEvent.click(await screen.findByRole('button', { name: /stop recording/i }))
    })
    await screen.findByLabelText('Your voice note')
    await userEvent.click(screen.getByRole('button', { name: /submit report/i }))

    await waitFor(() => {
      const files = append.mock.calls.filter(([name]) => name === 'files').map(([, value]) => value as File)
      expect(files.map((f) => [f.name, f.type])).toEqual([['voice-note.webm', 'audio/webm']])
    })
    append.mockRestore()
  })
})
