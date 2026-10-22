'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Maximize2, Minus, Plus, Undo2, X } from 'lucide-react'
import type { LngLatBoundsLike, Map as MapLibreMap } from 'maplibre-gl'
import type { MapPlace, NetworkMap as NetworkData } from '@/lib/network'

/**
 * The landing's network map (Luke, 4 Oct: "more detailed … more zoomed in … more interactive … more details on the
 * individual places"). A real map: OpenStreetMap vector tiles, self-hosted (scripts/map-data.mjs), drawn by MapLibre
 * on a globe. It starts on the whole Earth and flies in to Europe when it scrolls into view.
 * - Every city's name sits right beside its own dot. Where cities are too close to label at this zoom, the label that
 *   fits carries "+N"; pressing it zooms in until they come apart. No lines to follow.
 * - Pressing a city flies in to it (its streets, rivers and parks) and opens a card with its schools, what their
 *   students do and any conference held there, every fact with its source. Places stay city-level: the map never
 *   shows where a school is (07 §privacy).
 * - Drag to move; Ctrl/⌘ + scroll or two fingers to zoom; the + and − buttons; "Back to Europe".
 * - "Explore the map" fills the screen (Luke, 11 Oct: "improve … general navigating of the map"): there a plain scroll
 *   or one finger moves and zooms the map, every city sits in a strip along the bottom, and Close, Escape or the
 *   phone's back button return to the page. A city's card steps on to the next city and back (alphabetical, as the
 *   city buttons are), so the whole network can be toured without hunting for dots.
 * MapLibre (~1 MB) loads only when the section comes near the screen. Without WebGL, the city buttons below the map
 * still open every card.
 */

export type MapStrings = {
  back: string; close: string; nextBadge: string; nextTag: string; nextChip: string | null; hosted: string
  schoolOne: string; schoolMany: string; attended: string; about: string; doing: string; atConference: string
  noFacts: string; source: string; site: string; website: string; club: string; cities: string
  zoomIn: string; zoomOut: string; more: string; moreLabel: string; mapLabel: string; noMap: string
  journeyPrev: string; journeyNext: string
  explore: string; exploreClose: string; prevCity: string; nextCity: string
  helpMac: string; helpWindows: string; helpMobile: string
}
type Props = { map: NetworkData; strings: MapStrings; nextPlaceId: string | null }
type Mark = { id: string; lng: number; lat: number; tone: MapPlace['kind']; rank: number }
type Api = {
  europe: (ms?: number) => void
  city: (p: MapPlace) => void
  group: (ids: string[]) => void
  zoom: (d: number) => void
  setCardOpen: (open: boolean) => void
  explore: (on: boolean) => void
}

const FOCUS = { lat: 50, lng: 14 }
const NEAR = 35 // degrees from central Europe: further away (Columbus, Ohio) isn't in the Europe view
const DEG = Math.PI / 180
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''))
const arcDeg = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const x = Math.sin(a.lat * DEG) * Math.sin(b.lat * DEG) + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.cos((a.lng - b.lng) * DEG)
  return Math.acos(Math.max(-1, Math.min(1, x))) / DEG
}
const bounds = (pts: { lat: number; lng: number }[]): LngLatBoundsLike => [
  [Math.min(...pts.map((p) => p.lng)), Math.min(...pts.map((p) => p.lat))],
  [Math.max(...pts.map((p) => p.lng)), Math.max(...pts.map((p) => p.lat))],
]

// MapLibre is served from this site as a plain module (scripts/vendor-maplibre.mjs): MapLibre 6 finds its web worker
// beside its own file, which a bundler would break. Loaded once, on demand, with the pmtiles reader.
let loading: Promise<typeof import('maplibre-gl')> | null = null
function loadMapLibre() {
  if (!loading) {
    const css = '/vendor/maplibre/maplibre-gl.css'
    if (!document.querySelector(`link[href="${css}"]`)) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = css; document.head.appendChild(l)
    }
    const url = '/vendor/maplibre/maplibre-gl.mjs'
    loading = Promise.all([import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url), import('pmtiles')]).then(([ml, pm]) => {
      ml.addProtocol('pmtiles', new pm.Protocol().tile)
      return ml as typeof import('maplibre-gl')
    })
  }
  return loading
}

export function NetworkMap({ map: data, strings, nextPlaceId }: Props) {
  const { places, route } = data
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const holder = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const cardHeading = useRef<HTMLHeadingElement>(null)
  const exploreButton = useRef<HTMLButtonElement>(null)
  const api = useRef<Api | null>(null)
  const groups = useRef(new Map<string, string[]>())
  const returnFocus = useRef<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'ready' | 'failed'>('idle')
  const [moved, setMoved] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [hot, setHot] = useState<string | null>(null)
  const [exploring, setExploring] = useState(false)
  const [stepped, setStepped] = useState(false) // the card moved on with its own arrows: say the new city aloud
  const cardId = useId()
  const byId = useMemo(() => new Map(places.map((p) => [p.id, p])), [places])
  const chips = useMemo(() => [...places].sort((a, b) => a.city.localeCompare(b.city)), [places])
  // The conference's journey, edition by edition, so a host city's card can step to the host before and after it.
  const stops = useMemo(() => places.flatMap((p) => p.conferences.map((c) => ({ year: c.year, id: p.id, city: p.city }))).sort((a, b) => a.year - b.year), [places])

  // The tag beside a city's name: "Next" for the next conference's city, else the year(s) it hosted.
  const tagOf = useCallback((p: MapPlace) => (p.conferences.some((c) => c.next) ? strings.nextTag : p.conferences.map((c) => c.year).join(', ') || null), [strings.nextTag])

  // One mark per city: the next host first, then past hosts, then by number of schools.
  const marks = useMemo<Mark[]>(() => places.map((p) => ({
    id: p.id, lng: p.lng, lat: p.lat, tone: p.kind,
    rank: (p.kind === 'next' ? 3000 : p.kind === 'host' ? 2000 : 1000) + p.schools.length * 10,
  })), [places])

  useEffect(() => {
    const el = stage.current, box = holder.current, overlay = layer.current
    if (!el || !box || !overlay) return
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off'
    let map: MapLibreMap | null = null
    let disposed = false
    let cardOpen = false
    let fullScreen = false
    const cleanups: (() => void)[] = []
    const near = places.filter((p) => arcDeg(p, FOCUS) <= NEAR)

    // Room the camera leaves for what covers the map: the card on the right (wide screens), or, full screen on a
    // phone, the card rising from the bottom; and the city strip along the bottom when full screen.
    const padding = () => {
      const w = el.clientWidth, h = el.clientHeight
      const card = cardOpen && w >= 900 ? 392 : 0
      const sheet = cardOpen && fullScreen && w < 900 ? Math.round(h * 0.58) : 0
      return { top: fullScreen ? 76 : 48, bottom: Math.max(fullScreen ? 120 : 80, sheet + 24), left: Math.min(64, w * 0.05), right: Math.min(64, w * 0.05) + card }
    }

    // ── Labels: each name beside its own dot, never on top of another ──
    const nodes = new Map<string, HTMLElement>()
    for (const n of overlay.querySelectorAll<HTMLElement>('[data-mark]')) nodes.set(n.dataset.mark!, n)
    const sizes = new Map<string, { w: number; h: number }>() // pill sizes, measured once (labels don't change)
    const size = (id: string) => {
      let s = sizes.get(id)
      if (!s) {
        const pill = nodes.get(id)?.querySelector<HTMLElement>('.nmap__pill')
        s = { w: pill?.offsetWidth || 120, h: pill?.offsetHeight || 44 }
        if (pill?.offsetWidth) sizes.set(id, s)
      }
      return s
    }
    type Rect = { x0: number; y0: number; x1: number; y1: number }
    type Side = 'e' | 'w' | 'ne' | 'se' | 'nw' | 'sw' | 'n' | 's'
    const placed = new Map<string, Side>() // where each name sat last frame, so names don't jump about
    const MORE = 50 // the "+N" button beside a label
    let raf = 0
    const layout = () => {
      raf = 0
      if (!map) return
      const W = el.clientWidth, H = el.clientHeight, c = map.getCenter()
      const center = { lat: c.lat, lng: c.lng }
      const pts = marks.map((m) => {
        const p = map!.project([m.lng, m.lat])
        return { m, x: p.x, y: p.y, visible: arcDeg(m, center) < 80 && p.x > -40 && p.x < W + 40 && p.y > -40 && p.y < H + 40 }
      })
      const order = pts.filter((q) => q.visible).sort((a, b) => b.m.rank - a.m.rank)
      // Things on the stage a name must not sit under: the zoom buttons, the next-conference chip, "Back to Europe", the card.
      const sr = el.getBoundingClientRect()
      const blocks: Rect[] = [...(el.parentElement?.querySelectorAll<HTMLElement>('[data-obstacle]') ?? [])]
        .filter((o) => o.offsetParent !== null) // on a phone the card sits below the map: its box is off the stage, so harmless
        .map((o) => { const r = o.getBoundingClientRect(); return { x0: r.left - sr.left, y0: r.top - sr.top, x1: r.right - sr.left, y1: r.bottom - sr.top } })
      const taken: (Rect & { id: string })[] = []
      const meet = (a: Rect, b: Rect, pad = 0) => a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.y0 < b.y1 + pad && a.y1 > b.y0 - pad
      const dotOf = (q: (typeof pts)[number]): Rect => ({ x0: q.x - 7, y0: q.y - 7, x1: q.x + 7, y1: q.y + 7 })
      // Eight places a name can sit, each touching its own dot: beside it (east, west), at its corners, above or below.
      const rect = (q: (typeof pts)[number], side: Side, extra = 0): Rect => {
        const { w: pw, h } = size(q.m.id), w = pw + extra
        switch (side) {
          case 'e': return { x0: q.x + 10, y0: q.y - h / 2, x1: q.x + 10 + w, y1: q.y + h / 2 }
          case 'w': return { x0: q.x - 10 - w, y0: q.y - h / 2, x1: q.x - 10, y1: q.y + h / 2 }
          case 'ne': return { x0: q.x + 2, y0: q.y - 8 - h, x1: q.x + 2 + w, y1: q.y - 8 }
          case 'se': return { x0: q.x + 2, y0: q.y + 8, x1: q.x + 2 + w, y1: q.y + 8 + h }
          case 'nw': return { x0: q.x - 2 - w, y0: q.y - 8 - h, x1: q.x - 2, y1: q.y - 8 }
          case 'sw': return { x0: q.x - 2 - w, y0: q.y + 8, x1: q.x - 2, y1: q.y + 8 + h }
          case 'n': return { x0: q.x - w / 2, y0: q.y - 12 - h, x1: q.x + w / 2, y1: q.y - 12 }
          default: return { x0: q.x - w / 2, y0: q.y + 12, x1: q.x + w / 2, y1: q.y + 12 + h }
        }
      }
      const SIDES: Side[] = ['e', 'w', 'ne', 'se', 'nw', 'sw', 's', 'n']
      const sidesFor = (prev?: Side) => (prev ? [prev, ...SIDES.filter((x) => x !== prev)] : SIDES)
      const shown = new Map<string, Side>()
      const under = new Map<string, string>() // a city whose dot a host's name had to cover → that host
      const key = (id: string) => byId.get(id)?.kind !== 'school' // the next host and past hosts: their names always show
      const fits = (r: Rect, id: string, pad: number, strict: boolean) =>
        r.x0 > 4 && r.x1 < W - 4 && r.y0 > 4 && r.y1 < H - 4 &&
        !blocks.some((b) => meet(r, b, 6)) &&
        !taken.some((t) => t.id !== id && meet(r, t, pad)) &&
        // Never over another place's dot. Only a host city, if it has no other room, may cover a school city's dot;
        // that city then rides on the host's "+N".
        !order.some((o) => o.m.id !== id && meet(r, dotOf(o)) && (strict || key(o.m.id) || shown.has(o.m.id)))
      // Pass 1, most important first: a name goes beside its dot where it fits, keeping last frame's place if it can.
      for (const q of order) {
        if (blocks.some((b) => meet(dotOf(q), b)) || under.has(q.m.id)) continue
        const prev = placed.get(q.m.id)
        const tries = key(q.m.id) && W >= 700 ? [true, false] : [true]
        for (const strict of tries) {
          const side = sidesFor(prev).find((sd) => fits(rect(q, sd), q.m.id, prev ? 2 : 6, strict))
          if (!side) continue
          const r = rect(q, side)
          shown.set(q.m.id, side); taken.push({ ...r, id: q.m.id })
          if (!strict) for (const o of order) if (o.m.id !== q.m.id && !shown.has(o.m.id) && meet(r, dotOf(o))) under.set(o.m.id, q.m.id)
          break
        }
      }
      // Pass 2: every unnamed city rides on a named city's "+N": the one whose name covers its dot, else the nearest
      // named city that still has room for the button (up to 260 px away).
      groups.current.clear()
      const grown = new Set<string>()
      const grow = (id: string) => {
        if (grown.has(id)) return true
        const q = order.find((o) => o.m.id === id)!
        const i = taken.findIndex((t) => t.id === id)
        const was = taken.splice(i, 1)[0]
        const side = sidesFor(shown.get(id)).find((sd) => fits(rect(q, sd, MORE), id, 4, ![...under.values()].includes(id)))
        if (!side) { taken.push(was); return false }
        shown.set(id, side); taken.push({ ...rect(q, side, MORE), id }); grown.add(id)
        return true
      }
      for (const q of order) {
        if (shown.has(q.m.id)) continue
        const coverer = under.get(q.m.id)
        const near = order.filter((o) => shown.has(o.m.id) && o.m.id !== coverer)
          .map((o) => ({ id: o.m.id, d: Math.hypot(o.x - q.x, o.y - q.y) })).filter((o) => o.d <= 260).sort((x, y) => x.d - y.d).map((o) => o.id)
        const host = [...(coverer && shown.has(coverer) ? [coverer] : []), ...near].find((id) => grow(id))
        if (host) groups.current.set(host, [...(groups.current.get(host) ?? [host]), q.m.id])
      }
      placed.clear()
      for (const [k, v] of shown) placed.set(k, v)
      for (const q of pts) {
        const n = nodes.get(q.m.id)
        if (!n) continue
        n.style.translate = `${q.x.toFixed(1)}px ${q.y.toFixed(1)}px`
        n.dataset.visible = q.visible ? '1' : '0'
        n.dataset.side = (q.visible && shown.get(q.m.id)) || 'none'
        const more = n.querySelector<HTMLButtonElement>('.nmap__more')
        if (!more) continue
        const g = groups.current.get(q.m.id)
        if (g && shown.has(q.m.id)) {
          more.dataset.n = String(g.length - 1)
          more.textContent = fill(strings.more, { n: g.length - 1 })
          more.setAttribute('aria-label', fill(strings.moreLabel, { n: g.length - 1, names: g.slice(1).map((id) => byId.get(id)?.city ?? '').join(', ') }))
        } else delete more.dataset.n
      }
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(layout) }

    // ── The map ──
    let started = false
    const start = async () => {
      if (started) return
      started = true
      let ml: typeof import('maplibre-gl'), style
      try {
        ;[ml, { mapStyle: style }] = await Promise.all([loadMapLibre(), import('@/lib/map-style')])
      } catch { if (!disposed) setStatus('failed'); return }
      if (disposed) return
      // Build the map when the page is idle, not in the middle of a scroll: setting it up takes the main thread for a
      // moment (about 1.5 s on a slow phone), and doing it mid-scroll shows as a stutter.
      await new Promise<void>((done) => ('requestIdleCallback' in window ? requestIdleCallback(() => done(), { timeout: 1200 }) : setTimeout(done, 200)))
      if (disposed) return
      const H = el.clientHeight
      const globeZoom = Math.log2((0.78 * H * Math.PI) / 512)
      try {
        map = new ml.Map({
          container: box,
          style: style(location.origin, places.map((p) => p.city), route),
          center: still ? [FOCUS.lng, FOCUS.lat] : [FOCUS.lng + 70, 22],
          zoom: still ? 4 : globeZoom,
          minZoom: Math.max(0, globeZoom - 0.3),
          maxZoom: 13.5,
          maxPitch: 0,
          dragRotate: false,
          touchPitch: false,
          pitchWithRotate: false,
          cooperativeGestures: true,
          // What MapLibre says when a plain scroll or one finger tries to move the map inside the page.
          locale: {
            'CooperativeGesturesHandler.WindowsHelpText': strings.helpWindows,
            'CooperativeGesturesHandler.MacHelpText': strings.helpMac,
            'CooperativeGesturesHandler.MobileHelpText': strings.helpMobile,
          },
          attributionControl: { compact: true },
          fadeDuration: 200,
          validateStyle: false, // the style is ours and fixed; checking it again on every visit only costs time
        })
      } catch { setStatus('failed'); return }
      map.touchZoomRotate.disableRotation()
      map.keyboard.disableRotation()
      map.on('error', (e) => { if (String(e.error?.message ?? '').includes('WebGL')) setStatus('failed') })
      map.on('move', kick)
      map.on('moveend', kick)
      map.on('resize', kick)
      map.on('dragstart', () => setMoved(true))
      map.on('zoomstart', (e) => { if ((e as { originalEvent?: Event }).originalEvent) setMoved(true) })

      const europe = (ms = 1800) => {
        if (!map || !near.length) return
        map.fitBounds(bounds(near), { padding: padding(), duration: still ? 0 : ms, maxZoom: 5.2, essential: false })
      }
      api.current = {
        europe,
        // A city: fly in to its streets (city-level, never to a school), centred in the part of the map the card
        // doesn't cover. An offset, not a padding: MapLibre keeps a padding as camera state, and every later fit
        // (Back to Europe, "+N") then added its own on top (Luke, 12 Oct: "zooms out too far to the right").
        city: (p) => {
          const w = el.clientWidth, h = el.clientHeight
          const card = cardOpen && w >= 900 ? 392 : 0
          const sheet = cardOpen && fullScreen && w < 900 ? Math.round(h * 0.58) : 0
          map?.flyTo({ center: [p.lng, p.lat], zoom: 11, offset: [-card / 2, -sheet / 2], duration: still ? 0 : 2400, essential: false })
        },
        group: (ids) => {
          if (!map) return
          setMoved(true)
          const pts = ids.map((id) => byId.get(id)).filter(Boolean) as MapPlace[]
          // Fit the group, but always come at least 1.5 levels closer: on a phone a big group barely fits better than
          // the whole of Europe, and a "+N" that doesn't zoom would look broken.
          const side = Math.min(160, el.clientWidth * 0.18)
          const cam = map.cameraForBounds(bounds(pts), { padding: { ...padding(), left: side, right: padding().right + side }, maxZoom: 9.5 })
          const zoom = Math.max(cam?.zoom ?? 0, Math.min(9.5, map.getZoom() + 1.5))
          const c = pts.reduce((acc, q) => ({ lat: acc.lat + q.lat / pts.length, lng: acc.lng + q.lng / pts.length }), { lat: 0, lng: 0 })
          map.flyTo({ center: cam?.center ?? [c.lng, c.lat], zoom, duration: still ? 0 : 1400, essential: false })
        },
        zoom: (d) => { setMoved(true); map?.easeTo({ zoom: map.getZoom() + d, duration: still ? 0 : 300 }) },
        setCardOpen: (open) => { cardOpen = open },
        // Full screen: a plain scroll and one finger move the map (in the page they scroll the page, and the map needs
        // Ctrl/⌘ or two fingers). The stage has just changed size, so the map redraws at the new size.
        explore: (on) => {
          fullScreen = on
          if (!map) return
          if (on) map.cooperativeGestures.disable(); else map.cooperativeGestures.enable()
          requestAnimationFrame(() => { map?.resize(); kick() })
        },
      }
      map.once('load', () => {
        if (disposed) return
        setStatus('ready')
        kick()
        if (still) { europe(0); return }
        // Fly in to Europe the first time the map is well in view.
        const io = new IntersectionObserver(([e]) => {
          if (!e.isIntersecting) return
          io.disconnect()
          europe(2800)
        }, { threshold: 0.4 })
        io.observe(el)
        cleanups.push(() => io.disconnect())
      })
    }

    // Set the map up once the page has settled (the visitor is usually still reading the top), so scrolling down to it
    // doesn't stall: loading MapLibre's 1.2 MB of script, building the map and drawing it the first time take the main
    // thread for a moment. It then waits, still, until the section is in view. Not on Save-Data connections: there it
    // starts only near the map.
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    let warmTimer = 0
    const warm = () => { warmTimer = window.setTimeout(() => {
      const go = () => { if (!disposed) start() }
      if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 4000 }); else go()
    }, 1500) }
    if (!saveData) { if (document.readyState === 'complete') warm(); else window.addEventListener('load', warm, { once: true }) }
    cleanups.push(() => { clearTimeout(warmTimer); window.removeEventListener('load', warm) })
    // Build the map when the section comes near the screen.
    const soon = new IntersectionObserver(([e]) => { if (e.isIntersecting) { soon.disconnect(); start() } }, { rootMargin: '600px 0px' })
    soon.observe(el)
    return () => {
      disposed = true
      soon.disconnect()
      cleanups.forEach((f) => f())
      cancelAnimationFrame(raf)
      map?.remove()
      api.current = null
    }
    // places, route and marks come from the server and don't change while the page is open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // keepFocus: the card's own arrows moved it on, so the keyboard stays on the arrow (and the new city is announced).
  const open = useCallback((id: string, keepFocus = false) => {
    const p = byId.get(id)
    if (!p) return
    returnFocus.current = id
    setSelected(id)
    setStepped(keepFocus)
    setMoved(true)
    api.current?.setCardOpen(true)
    api.current?.city(p)
    if (!keepFocus) requestAnimationFrame(() => cardHeading.current?.focus())
  }, [byId])
  const close = useCallback(() => {
    setSelected(null)
    api.current?.setCardOpen(false)
    const back = returnFocus.current
    if (back) requestAnimationFrame(() => {
      const all = stage.current?.parentElement?.querySelectorAll<HTMLElement>(`[data-place="${back}"]`) ?? []
      ;[...all].find((b) => b.offsetParent !== null && b.closest('[data-visible="0"], [data-side="none"]') === null)?.focus()
    })
  }, [])
  // Back to the whole of Europe, the overview: the card closes too, so Europe sits in the middle of the map again.
  const reset = useCallback(() => {
    setMoved(false)
    setSelected(null)
    api.current?.setCardOpen(false)
    api.current?.europe(1600)
  }, [])

  // Going full screen takes the map out of the page's flow. Its place is held (min-height) and the scroll position
  // kept, so the page behind doesn't move and closing the map lands exactly where the visitor was.
  const keepScroll = useRef(0)
  const explore = useCallback((on: boolean) => {
    const box = root.current
    if (on && box) { box.style.minHeight = `${box.offsetHeight}px`; keepScroll.current = window.scrollY }
    setExploring(on)
    api.current?.explore(on)
  }, [])

  // Full screen: the chosen city's button slides into view in the strip along the bottom.
  useEffect(() => {
    if (!exploring || !selected) return
    root.current?.querySelector<HTMLElement>(`.gmap__chips [data-place="${selected}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [exploring, selected])

  // Escape closes the card first, then the full-screen map.
  useEffect(() => {
    if (!selected && !exploring) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (selected) close()
      else { explore(false); requestAnimationFrame(() => exploreButton.current?.focus()) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, exploring, close, explore])

  // While the map fills the screen: the page behind it doesn't scroll, Tab stays inside the map, and the phone's back
  // button closes the map instead of leaving the page (one history entry, removed again on Close).
  useEffect(() => {
    if (!exploring) return
    const html = document.documentElement
    const overflow = html.style.overflow
    html.style.overflow = 'hidden'
    // The site's smooth scroll (Fx) pauses too, so nothing it was still animating moves the page behind the map.
    const lenis = (window as unknown as { __lenis?: { stop(): void; start(): void; scrollTo(y: number, o?: { immediate?: boolean }): void } }).__lenis
    lenis?.stop()
    let entry = true
    history.pushState({ nmapExplore: true }, '')
    const onPop = () => { entry = false; explore(false) }
    window.addEventListener('popstate', onPop)
    const onTab = (e: KeyboardEvent) => {
      const box = root.current
      if (e.key !== 'Tab' || !box) return
      const items = [...box.querySelectorAll<HTMLElement>('button, a[href], canvas[tabindex], h3[tabindex]')]
        .filter((x) => x.getClientRects().length > 0 && getComputedStyle(x).visibility !== 'hidden' && !x.closest('[hidden]'))
      if (!items.length) return
      const first = items[0], last = items[items.length - 1], at = document.activeElement as HTMLElement | null
      if (!at || !box.contains(at)) { e.preventDefault(); first.focus() }
      else if (e.shiftKey && at === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onTab)
    // Straight onto the map, so the arrow keys move it and + and − zoom.
    requestAnimationFrame(() => stage.current?.querySelector<HTMLElement>('.maplibregl-canvas')?.focus({ preventScroll: true }))
    const box = root.current
    return () => {
      html.style.overflow = overflow
      if (box) box.style.minHeight = ''
      lenis?.start()
      lenis?.scrollTo(keepScroll.current, { immediate: true })
      window.scrollTo({ top: keepScroll.current, behavior: 'instant' })
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onTab)
      // Only while our entry is still the current one: after a link in the card has opened another page, going back
      // here would undo that.
      if (entry && (history.state as { nmapExplore?: boolean } | null)?.nmapExplore) history.back()
    }
  }, [exploring, explore])

  const place = selected ? byId.get(selected) ?? null : null
  // Step along the journey: the host city before this one's first edition, and the one after its last.
  const journey = useMemo(() => {
    if (!place?.conferences.length) return { before: undefined, after: undefined }
    const years = place.conferences.map((c) => c.year)
    return {
      before: [...stops].reverse().find((s) => s.year < Math.min(...years) && s.id !== place.id),
      after: stops.find((s) => s.year > Math.max(...years) && s.id !== place.id),
    }
  }, [place, stops])
  const go = useCallback((e: React.MouseEvent<HTMLButtonElement>) => { const id = e.currentTarget.dataset.go; if (id) open(id) }, [open])
  // The card's arrows: the city before and after this one in the city buttons' order (alphabetical), round the end.
  const at = place ? chips.findIndex((p) => p.id === place.id) : -1
  const prevPlace = at >= 0 && chips.length > 1 ? chips[(at - 1 + chips.length) % chips.length] : null
  const nextPlace = at >= 0 && chips.length > 1 ? chips[(at + 1) % chips.length] : null
  const step = useCallback((e: React.MouseEvent<HTMLButtonElement>) => { const id = e.currentTarget.dataset.go; if (id) open(id, true) }, [open])
  const schoolsLabel = (n: number) => (n === 1 ? strings.schoolOne : fill(strings.schoolMany, { n }))
  const describe = (p: MapPlace) => {
    const bits = [`${p.city}, ${p.country}`]
    if (p.schools.length) bits.push(schoolsLabel(p.schools.length))
    for (const c of p.conferences) bits.push(c.next ? `${strings.nextBadge}: ${c.dates}` : fill(strings.hosted, { year: c.year }))
    return bits.join('. ')
  }
  const cityButton = (p: MapPlace, className: string) => {
    const tag = tagOf(p)
    return (
      <button
        type="button"
        data-place={p.id}
        className={`${className} is-${p.kind}${selected === p.id ? ' is-selected' : ''}`}
        aria-label={describe(p)}
        aria-expanded={selected === p.id}
        aria-controls={cardId}
        onClick={() => (selected === p.id ? close() : open(p.id))}
        onPointerEnter={() => setHot(p.id)}
        onPointerLeave={() => setHot((h) => (h === p.id ? null : h))}
        onFocus={() => setHot(p.id)}
        onBlur={() => setHot((h) => (h === p.id ? null : h))}
      >
        <span aria-hidden="true">{p.city}</span>
        {tag ? <span className="gname__tag" aria-hidden="true">{tag}</span> : null}
      </button>
    )
  }
  const facts = (list: { text: string; source: string }[]) => list.map((f) => (
    <li key={f.text} className="gcard__fact">
      {f.text}{' '}
      <a href={f.source} target="_blank" rel="noopener noreferrer" className="link gcard__source">{strings.source}<ArrowUpRight size={16} aria-hidden="true" /></a>
    </li>
  ))

  return (
    // data-lenis-prevent: the site's smooth scroll leaves these alone, so a wheel over the full-screen map zooms it (not
    // the page behind) and a wheel over the card scrolls the card.
    <div ref={root} className={`gmap nmap${place ? ' has-card' : ''}${exploring ? ' is-exploring' : ''}${status === 'failed' ? ' nmap--failed' : ''}`} data-lenis-prevent={exploring ? '' : undefined}>
      <div ref={stage} className={`gmap__stage nmap__stage${status === 'ready' ? ' is-ready' : ''}`} role="region" aria-label={strings.mapLabel}>
        <div ref={holder} className="nmap__gl" />
        {status === 'failed' ? <p className="nmap__fallback">{strings.noMap}</p> : null}
        <div ref={layer} className="nmap__marks">
          {marks.map((m) => (
            <div key={m.id} data-mark={m.id} data-visible="0" data-side="none" className={`nmap__mark is-${m.tone}${selected === m.id ? ' is-selected' : ''}${hot === m.id ? ' is-hot' : ''}`}>
              {/* The dot itself opens its city too (with a mouse; the names and "+N" are the keyboard's way in). */}
              <span className="nmap__dot" aria-hidden="true" onClick={() => open(m.id)} />
              <span className="nmap__label">
                {cityButton(byId.get(m.id)!, 'gname nmap__pill')}
                <button type="button" className="nmap__more" onClick={() => api.current?.group(groups.current.get(m.id) ?? [m.id])} />
              </span>
            </div>
          ))}
        </div>
        {status === 'ready' ? (
          <div className="nmap__controls" data-obstacle>
            <button type="button" className="nmap__ctl" onClick={() => api.current?.zoom(1)} aria-label={strings.zoomIn}><Plus size={22} aria-hidden="true" /></button>
            <button type="button" className="nmap__ctl" onClick={() => api.current?.zoom(-1)} aria-label={strings.zoomOut}><Minus size={22} aria-hidden="true" /></button>
          </div>
        ) : null}
        {status === 'ready' ? (
          <div className="nmap__top">
            {moved ? (
              <button type="button" className="gmap__back btn btn-sm btn-paper" onClick={reset} data-obstacle>
                <Undo2 size={18} aria-hidden="true" /> {strings.back}
              </button>
            ) : null}
            <button
              ref={exploreButton}
              type="button"
              className="nmap__explore btn btn-sm btn-paper"
              onClick={() => explore(!exploring)}
              aria-label={exploring ? strings.exploreClose : undefined}
              data-obstacle
            >
              {exploring ? <X size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />} {exploring ? strings.close : strings.explore}
            </button>
          </div>
        ) : null}
        {strings.nextChip && nextPlaceId ? (
          <button type="button" className="gmap__next" onClick={() => open(nextPlaceId)} data-obstacle>
            <span className="gmap__pulse" aria-hidden="true" /> {strings.nextChip}
          </button>
        ) : null}
      </div>

      <div className="gmap__chips" role="group" aria-label={strings.cities}>
        {chips.map((p) => cityButton(p, 'gchip'))}
      </div>

      <section id={cardId} className="gcard" hidden={!place} aria-labelledby={`${cardId}-h`} data-obstacle data-lenis-prevent>
        {place ? (
          <>
            <div className="gcard__head">
              <h3 id={`${cardId}-h`} ref={cardHeading} tabIndex={-1} className="gcard__title">
                {place.city}<span className="gcard__country">{place.country}</span>
              </h3>
              <button type="button" className="gcard__close" onClick={close} aria-label={strings.close}><X size={22} aria-hidden="true" /></button>
            </div>
            {prevPlace && nextPlace ? (
              <div className="gcard__steps">
                <button type="button" className="gcard__nav" data-go={prevPlace.id} onClick={step} aria-label={fill(strings.prevCity, { city: prevPlace.city })}>
                  <ArrowLeft size={18} aria-hidden="true" /><span aria-hidden="true">{prevPlace.city}</span>
                </button>
                <button type="button" className="gcard__nav gcard__nav--next" data-go={nextPlace.id} onClick={step} aria-label={fill(strings.nextCity, { city: nextPlace.city })}>
                  <span aria-hidden="true">{nextPlace.city}</span><ArrowRight size={18} aria-hidden="true" />
                </button>
              </div>
            ) : null}
            <p className="visually-hidden" aria-live="polite">{stepped ? `${place.city}, ${place.country}` : ''}</p>
            {place.conferences.map((c) => (
              <div key={c.year} className={`gcard__conf${c.next ? ' is-next' : ''}`}>
                <p className="gcard__badge">{c.next ? strings.nextBadge : fill(strings.hosted, { year: c.year })}</p>
                <p>{c.dates} · {c.host}</p>
                {c.highlights.length ? <ul className="gcard__facts">{facts(c.highlights)}</ul> : null}
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="link">{strings.site}<ArrowUpRight size={16} aria-hidden="true" /></a>
              </div>
            ))}
            {journey.before || journey.after ? (
              <div className="gcard__journey">
                {journey.before ? <button type="button" className="gcard__step" data-go={journey.before.id} onClick={go}><ArrowLeft size={18} aria-hidden="true" /> {fill(strings.journeyPrev, { city: journey.before.city, year: journey.before.year })}</button> : <span />}
                {journey.after ? <button type="button" className="gcard__step gcard__step--after" data-go={journey.after.id} onClick={go}>{fill(strings.journeyNext, { city: journey.after.city, year: journey.after.year })} <ArrowRight size={18} aria-hidden="true" /></button> : null}
              </div>
            ) : null}
            {place.schools.length ? <p className="gcard__count">{schoolsLabel(place.schools.length)}</p> : null}
            <ul className="gcard__schools">
              {place.schools.map((s) => (
                <li key={s.name}>
                  <p className="gcard__school">{s.href ? <a href={s.href} className="link">{s.name}</a> : s.name}</p>
                  {s.years.length ? <p className="gcard__meta">{fill(strings.attended, { years: s.years.join(', ') })}</p> : null}
                  {s.website ? <a href={s.website} target="_blank" rel="noopener noreferrer" className="link">{strings.website}<ArrowUpRight size={16} aria-hidden="true" /></a> : null}
                  {s.profile.length ? (<><p className="gcard__label">{strings.about}</p><ul className="gcard__facts">{facts(s.profile)}</ul></>) : null}
                  {s.doing.length ? (<><p className="gcard__label">{strings.doing}</p><ul className="gcard__facts">{facts(s.doing)}</ul></>) : null}
                  {s.atConference.length ? (<><p className="gcard__label">{strings.atConference}</p><ul className="gcard__facts">{facts(s.atConference)}</ul></>) : null}
                  {!s.profile.length && !s.doing.length && !s.atConference.length && !s.href ? <p className="gcard__meta">{strings.noFacts}</p> : null}
                  {s.href ? <a href={s.href} className="link">{strings.club}</a> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </div>
  )
}
