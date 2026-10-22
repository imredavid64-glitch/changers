import { layers, namedFlavor, type Flavor } from '@protomaps/basemaps'
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from '@maplibre/maplibre-gl-style-spec'

/**
 * The network map's look: OpenStreetMap vector tiles (Protomaps basemap v4, cut by scripts/map-data.mjs) drawn in the
 * site's ink. Three tile files stack up: the whole world for the globe (zoom 0–3), Europe for the Europe view (4–6)
 * and each city around its schools (10–11). Each one is drawn on top of the one before, so where a closer file has
 * tiles they cover the coarser ones, and everywhere else the coarser map still shows.
 */

export const INK = '#17171d'
const OCEAN = '#101015'
const LAND = '#2a2a33'

// Protomaps' dark flavour, recoloured: land lighter than the sea (the continents read at a glance, as the dotted globe
// did), borders and labels in greys that stay legible on both.
const FLAVOR: Flavor = {
  ...namedFlavor('dark'),
  background: OCEAN, earth: LAND, water: OCEAN,
  park_a: '#26332b', park_b: '#2a382f', wood_a: '#28322b', wood_b: '#28322b', scrub_a: '#2c3129', scrub_b: '#2c3129',
  glacier: '#34343e', sand: '#33322d', beach: '#36352f', zoo: '#2a332c', pedestrian: '#2e2e38', aerodrome: '#2e2e38',
  hospital: '#2e2c33', industrial: '#2c2c34', school: '#2f2e36', military: '#2c2c34', pier: '#34343e', runway: '#3a3a45',
  buildings: '#33333d',
  other: '#3a3a45', minor_service: '#3a3a45', minor_a: '#43434f', minor_b: '#3c3c47', link: '#4a4a57', major: '#4f4f5d',
  highway: '#5d5d6d', railway: '#45454f',
  minor_service_casing: LAND, minor_casing: LAND, link_casing: LAND, major_casing_late: LAND, highway_casing_late: LAND,
  major_casing_early: LAND, highway_casing_early: LAND,
  boundaries: '#7c7c8f',
  roads_label_minor: '#9a9aa8', roads_label_minor_halo: LAND, roads_label_major: '#adadbb', roads_label_major_halo: LAND,
  ocean_label: '#5f5f6c', subplace_label: '#9a9aa7', subplace_label_halo: LAND, city_label: '#a9a9b6',
  city_label_halo: INK, state_label: '#6f6f7c', state_label_halo: LAND, country_label: '#858592',
  landcover: {
    grassland: '#2b322c', barren: '#2f2f30', urban_area: '#2e2e37', farmland: '#2c312c', glacier: '#34343e',
    scrub: '#2d322b', forest: '#27302a',
  },
}

// Other spellings the basemap uses for some of our cities.
const ALSO: Record<string, string[]> = {
  'The Hague': ['Den Haag', "'s-Gravenhage"], Frankfurt: ['Frankfurt am Main'], 'Kraków': ['Cracow', 'Krakow'],
  Munich: ['München'], Prague: ['Praha'], Vienna: ['Wien'], Brussels: ['Bruxelles', 'Brussel', 'Bruxelles - Brussel'],
  Bucharest: ['București', 'Bucuresti'], 'Düsseldorf': ['Duesseldorf'], Gebze: [], 'Neu-Ulm': [],
}

// Layers that need an icon sprite (points of interest, road shields, one-way arrows) or only matter at house level.
const DROP = new Set(['background', 'pois', 'roads_shields', 'roads_oneway', 'address_label'])

/**
 * Labels in Latin script only: the English name, else the local name if it's Latin. Anything else gets no label, so
 * the map never asks for a font range this site doesn't serve (public/map/fonts holds the Latin ranges). Our own
 * cities are left out too: they have their own buttons on the map.
 */
function latinName(skip: string[]): ExpressionSpecification {
  const name: ExpressionSpecification = ['case',
    ['has', 'name:en'], ['get', 'name:en'],
    ['any', ['!', ['has', 'script']], ['==', ['get', 'script'], 'Latin']], ['coalesce', ['get', 'name'], ''],
    '']
  if (!skip.length) return name
  // Our cities have their own buttons on the map; the basemap's label for the same city would sit beside it twice.
  const variants = [...new Set(skip.flatMap((c) => [c, c.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), ...(ALSO[c] ?? [])]))]
  return ['case', ['in', name, ['literal', variants]], '', name]
}

// What each tile file is drawn with. The world and Europe files only ever show the globe, countries and regions, so
// they skip everything that only matters close up (tunnels, bridges, minor roads, buildings, street names): fewer
// layers make the map start faster.
const FAR = new Set(['earth', 'landcover', 'water', 'boundaries_country', 'boundaries', 'water_label_ocean', 'places_country', 'places_locality'])
const MID = new Set([...FAR, 'landuse_park', 'landuse_urban_green', 'water_river', 'roads_highway_casing_early', 'roads_highway', 'roads_major_casing_early',
  'roads_major', 'roads_rail', 'places_region', 'water_label_lakes', 'earth_label_islands'])
const NEAR_DROP = new Set(['roads_labels_minor', 'roads_taxiway']) // the map never zooms in far enough for these

function stack(source: string, o: { minzoom?: number; labelsFrom?: number; labelsTo?: number; skip: string[]; only?: Set<string>; drop?: Set<string> }): LayerSpecification[] {
  return layers(source, FLAVOR, { lang: 'en' })
    .filter((l) => !DROP.has(l.id) && (!o.only || o.only.has(l.id)) && !o.drop?.has(l.id))
    .flatMap((l): LayerSpecification[] => {
      const layer = { ...l, id: `${source}-${l.id}` } as LayerSpecification
      if (layer.type === 'symbol') {
        if (o.labelsTo !== undefined && o.labelsTo <= (layer.minzoom ?? 0)) return []
        const layout = { ...layer.layout }
        delete layout['icon-image'] // the city dots need a sprite; the names stay
        layout['text-field'] = latinName(l.id === 'places_locality' ? o.skip : [])
        layer.layout = layout
        layer.minzoom = Math.max(layer.minzoom ?? 0, o.labelsFrom ?? 0)
        if (o.labelsTo !== undefined) layer.maxzoom = Math.min(layer.maxzoom ?? 24, o.labelsTo)
      }
      if (o.minzoom !== undefined) layer.minzoom = Math.max(layer.minzoom ?? 0, o.minzoom)
      return [layer]
    })
}

/** Great-circle arc between two points, so the conference's journey follows the curve of the Earth. */
export function arc(from: [number, number], to: [number, number], n = 48): [number, number][] {
  const r = Math.PI / 180, [la1, lo1] = [from[0] * r, from[1] * r], [la2, lo2] = [to[0] * r, to[1] * r]
  const d = 2 * Math.asin(Math.sqrt(Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2))
  if (!d) return [[from[1], from[0]], [to[1], to[0]]]
  return Array.from({ length: n + 1 }, (_, i) => {
    const f = i / n, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2)
    const y = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2)
    const z = A * Math.sin(la1) + B * Math.sin(la2)
    return [Math.atan2(y, x) / r, Math.atan2(z, Math.sqrt(x * x + y * y)) / r]
  })
}

export function mapStyle(origin: string, cities: string[], route: { from: [number, number]; to: [number, number]; next: boolean }[]): StyleSpecification {
  const attribution = '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a>'
  const tiles = (name: string) => ({ type: 'vector' as const, url: `pmtiles://${origin}/map/${name}.pmtiles`, attribution })
  return {
    version: 8,
    glyphs: `${origin}/map/fonts/{fontstack}/{range}.pbf`,
    projection: { type: 'globe' },
    // The glow round the globe (v1's look), fading out as you zoom in to a region.
    sky: { 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 4, 0.7, 7, 0] },
    sources: {
      world: tiles('world'), europe: tiles('europe'), cities: tiles('cities'),
      route: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: route.map((a) => ({ type: 'Feature', properties: { next: a.next }, geometry: { type: 'LineString', coordinates: arc(a.from, a.to) } })) },
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': OCEAN } },
      ...stack('world', { labelsTo: 4, skip: cities, only: FAR }),
      ...stack('europe', { labelsFrom: 4, labelsTo: 10, skip: cities, only: MID }),
      ...stack('cities', { minzoom: 10, labelsFrom: 10, skip: cities, drop: NEAR_DROP }),
      { id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round' }, paint: { 'line-color': INK, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 4, 8, 8], 'line-opacity': 0.8 } },
      // Past legs in the hosts' yellow; the leg to the next conference dashed, in orange.
      { id: 'route', type: 'line', source: 'route', filter: ['!', ['get', 'next']], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ffcf40', 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 2, 8, 4] } },
      { id: 'route-next', type: 'line', source: 'route', filter: ['get', 'next'], paint: { 'line-color': '#ff6a41', 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 2, 8, 4], 'line-dasharray': [2, 1.5] } },
    ],
  }
}
