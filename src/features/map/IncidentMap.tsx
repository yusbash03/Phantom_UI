import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MapPinOff } from 'lucide-react'
import type { MapIncident } from '@/api/types'
import { EmptyState } from '@/components/feedback/EmptyState'
import { boundsOf, markerAppearance } from './markers'

/** Lagos, a sensible default view before any incidents load. */
const DEFAULT_CENTER: [number, number] = [3.3792, 6.5244]
const TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined

/** Problems known before trying to start the map, so the page can explain them instead of showing a blank box. */
function initialFailure(): string | null {
  if (!TOKEN) return 'No Mapbox public token is configured (VITE_MAPBOX_PUBLIC_TOKEN).'
  const canvas = document.createElement('canvas')
  return canvas.getContext('webgl2') || canvas.getContext('webgl') ? null : 'The map needs WebGL, which this browser has turned off.'
}

interface IncidentMapProps {
  items: MapIncident[]
  selectedId: string | null
  onSelect: (id: string) => void
}

/**
 * Mapbox GL map with one accessible HTML button per incident. Uses the URL-restricted public token
 * only (design §7); there are no responder positions because no tracking source exists (8.9).
 */
export default function IncidentMap({ items, selectedId, onSelect }: IncidentMapProps) {
  const container = useRef<HTMLElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markers = useRef(new Map<string, { marker: mapboxgl.Marker; element: HTMLButtonElement }>())
  const framed = useRef(false)
  const onSelectRef = useRef(onSelect)
  const selectedRef = useRef(selectedId)
  const [failure, setFailure] = useState<string | null>(initialFailure)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    if (failure || !container.current) return
    try {
      const instance = new mapboxgl.Map({
        container: container.current,
        accessToken: TOKEN,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: DEFAULT_CENTER,
        zoom: 10,
        attributionControl: true,
      })
      instance.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
      instance.on('error', (event) => {
        if (event.error?.message?.includes('access token')) setFailure('The Mapbox token was rejected.')
      })
      map.current = instance
    } catch (error) {
      console.error('Map failed to start', error)
      // Reported after the effect, not during it.
      setTimeout(() => setFailure('The map could not start in this browser.'), 0)
    }

    const current = markers.current
    return () => {
      current.forEach(({ marker }) => marker.remove())
      current.clear()
      map.current?.remove()
      map.current = null
      framed.current = false
    }
  }, [failure])

  // Keep markers in sync with the data.
  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const seen = new Set<string>()
    for (const item of items) {
      seen.add(item.id)
      const look = markerAppearance(item)
      let entry = markers.current.get(item.id)
      if (!entry) {
        const element = document.createElement('button')
        element.type = 'button'
        element.addEventListener('click', () => onSelectRef.current(item.id))
        const marker = new mapboxgl.Marker({ element, anchor: 'bottom' }).setLngLat([item.longitude, item.latitude]).addTo(instance)
        entry = { marker, element }
        markers.current.set(item.id, entry)
      }

      entry.marker.setLngLat([item.longitude, item.latitude])
      const { element } = entry
      element.className = 'phantom-marker'
      element.dataset.dashed = String(look.dashed)
      element.style.setProperty('--marker-color', look.color)
      // Mapbox GL marks marker elements role="img"; these are controls, so keep them buttons for assistive tech.
      element.setAttribute('role', 'button')
      element.setAttribute('aria-label', look.label)
      element.setAttribute('aria-pressed', String(item.id === selectedRef.current))
      element.title = look.label
      element.innerHTML = ''
      const dot = document.createElement('span')
      dot.className = 'phantom-marker__dot'
      element.append(dot)
      if (look.tag) {
        const tag = document.createElement('span')
        tag.className = 'phantom-marker__tag'
        tag.textContent = look.tag
        element.append(tag)
      }
    }

    for (const [id, { marker }] of markers.current) {
      if (!seen.has(id)) {
        marker.remove()
        markers.current.delete(id)
      }
    }

    const bounds = boundsOf(items)
    if (bounds && !framed.current) {
      framed.current = true
      instance.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 0 })
    }
  }, [items])

  // Highlight the selection (new markers read it from the ref).
  useEffect(() => {
    selectedRef.current = selectedId
    for (const [id, { element }] of markers.current) {
      element.setAttribute('aria-pressed', String(id === selectedId))
    }
  }, [selectedId])

  if (failure) {
    return <EmptyState icon={MapPinOff} title="Map unavailable" description={failure} />
  }

  return <section ref={container} className="h-full min-h-[420px] w-full" aria-label="Operations map" />
}
