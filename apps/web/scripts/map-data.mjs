#!/usr/bin/env node
// Builds the self-hosted map data for the landing's network map (Luke, 4 Oct: "real zoomable map"; the map stack
// BUILD-PROMPT already locks for /clubs: MapLibre + a self-hosted Protomaps extract). OpenStreetMap vector tiles are
// cut from a Protomaps daily build down to what the map can show, and the label fonts are fetched once:
//   public/map/world.pmtiles   the whole world, zoom 0–3 (the globe)
//   public/map/europe.pmtiles  Europe, and Columbus (Ohio), zoom 4–6 (the Europe view and regions)
//   public/map/cities.pmtiles  each city around its schools, zoom 10–11 (streets, rivers, parks)
//   public/map/fonts/          Noto Sans (SIL OFL), the Latin ranges only
// Visitors' browsers read these files from this site, a few tiles at a time; nothing loads from another site.
// Needs the pmtiles CLI (~/.local/bin/pmtiles, github.com/protomaps/go-pmtiles).
//   node scripts/map-data.mjs [base|cities|fonts|all] [--dry-run]
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const BUILD = '20261004' // build.protomaps.com daily build (OpenStreetMap data of 4 Oct 2026), basemap v4
const PLANET = `https://build.protomaps.com/${BUILD}.pmtiles`
const PMTILES = path.join(os.homedir(), '.local/bin/pmtiles')
const site = new URL('..', import.meta.url).pathname
const out = path.join(site, 'public/map')
const docs = path.join(site, '../docs/research')
const what = process.argv[2] ?? 'all'
const dry = process.argv.includes('--dry-run')
fs.mkdirSync(out, { recursive: true })

const box = (w, s, e, n) => [[[w, s], [e, s], [e, n], [w, n], [w, s]]]
const writeRegion = (name, polygons) => {
  const file = path.join(os.tmpdir(), `cm-map-${name}.geojson`)
  fs.writeFileSync(file, JSON.stringify({ type: 'MultiPolygon', coordinates: polygons }))
  return file
}
const extract = (name, args) => {
  const target = path.join(out, `${name}.pmtiles`)
  const log = execFileSync(PMTILES, ['extract', PLANET, target, ...args, ...(dry ? ['--dry-run'] : [])], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const size = log.match(/archive size of ([\d.]+ \w+)/)?.[1] ?? '?'
  console.log(`✓ ${name}.pmtiles ${dry ? '(dry run) ' : ''}${size} · ${args.join(' ')}`)
}

// Every school's campus (from the research, where found) or its city, grouped by city.
function places() {
  const j = JSON.parse(fs.readFileSync(path.join(docs, 'network-places.json'), 'utf8'))
  const campus = new Map()
  for (const f of fs.readdirSync(docs).filter((n) => /^network-details-[a-z]\.json$/.test(n))) {
    const p = path.join(docs, f)
    for (const s of JSON.parse(fs.readFileSync(p, 'utf8')).schools ?? []) {
      if (s.campus?.lat != null && s.campus?.lng != null) campus.set(s.name, [s.campus.lat, s.campus.lng])
    }
  }
  const byCity = new Map()
  const add = (key, lat, lng) => byCity.set(key, [...(byCity.get(key) ?? []), [lat, lng]])
  for (const s of j.schools) add(`${s.city}|${s.country}`, ...(campus.get(s.name) ?? [s.lat, s.lng]))
  for (const c of j.conferences) add(`${c.city}|${c.country}`, c.lat, c.lng)
  return byCity
}

if (what === 'base' || what === 'all') {
  extract('world', ['--maxzoom=3'])
  extract('europe', ['--region=' + writeRegion('europe', [box(-25, 27, 50, 71), box(-85, 38.5, -81, 41.5)]), '--minzoom=4', '--maxzoom=6'])
}

if (what === 'cities' || what === 'all') {
  // Around each city: its schools plus about 12 km on every side, so the city view (zoom 10.5–12) never runs off the
  // detailed tiles unless you pan well away.
  const polys = []
  for (const [, pts] of places()) {
    const lats = pts.map((p) => p[0]), lngs = pts.map((p) => p[1])
    const mLat = 0.11, mLng = 0.11 / Math.cos((lats[0] * Math.PI) / 180)
    polys.push(box(Math.min(...lngs) - mLng, Math.min(...lats) - mLat, Math.max(...lngs) + mLng, Math.max(...lats) + mLat))
  }
  extract('cities', ['--region=' + writeRegion('cities', polys), '--minzoom=10', '--maxzoom=11'])
}

if (what === 'fonts' || what === 'all') {
  // The ranges Latin-script names need: Basic Latin, Latin-1, Latin Extended-A/B (ő ű ą ę ė š ż ğ ş ș ț), combining
  // marks, general punctuation. Labels are filtered to Latin names, so no other range is ever asked for.
  const stacks = ['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic']
  const ranges = ['0-255', '256-511', '512-767', '768-1023', '8192-8447']
  const base = 'https://raw.githubusercontent.com/protomaps/basemaps-assets/main/fonts'
  let n = 0, bytes = 0
  for (const stack of stacks) {
    fs.mkdirSync(path.join(out, 'fonts', stack), { recursive: true })
    for (const range of ranges) {
      const file = path.join(out, 'fonts', stack, `${range}.pbf`)
      if (fs.existsSync(file)) { bytes += fs.statSync(file).size; n++; continue }
      const res = await fetch(`${base}/${encodeURIComponent(stack)}/${range}.pbf`)
      if (!res.ok) throw new Error(`${stack} ${range}: HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      fs.writeFileSync(file, buf)
      bytes += buf.length; n++
    }
  }
  const ofl = path.join(out, 'fonts', 'OFL.txt')
  if (!fs.existsSync(ofl)) fs.writeFileSync(ofl, await (await fetch(`${base}/OFL.txt`)).text())
  console.log(`✓ fonts: ${n} files, ${(bytes / 1024).toFixed(0)} KB (Noto Sans, SIL Open Font License, public/map/fonts/OFL.txt)`)
}
