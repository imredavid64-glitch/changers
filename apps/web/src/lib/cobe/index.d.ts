export interface Marker {
  location: [number, number]
  size: number
  color?: [number, number, number]
  id?: string
}

export interface Arc {
  from: [number, number]
  to: [number, number]
  color?: [number, number, number]
  id?: string
}

export interface COBEOptions {
  width: number
  height: number
  phi: number
  theta: number
  mapSamples: number
  mapBrightness: number
  mapBaseBrightness?: number
  baseColor: [number, number, number]
  markerColor: [number, number, number]
  glowColor: [number, number, number]
  markers?: Marker[]
  diffuse: number
  devicePixelRatio: number
  dark: number
  opacity?: number
  offset?: [number, number]
  scale?: number
  context?: WebGLContextAttributes

  // New in v2
  arcs?: Arc[]
  arcColor?: [number, number, number]
  arcWidth?: number
  arcHeight?: number
  markerElevation?: number

  // Vendored additions (scripts/vendor-cobe.mjs)
  /** Radius of a land dot, in radians on the unit sphere (cobe: 0.008). */
  dotSize?: number
  /** Strength of a faint 10° latitude/longitude grid, 0–1 (0 = none). */
  graticule?: number
  /** URL of an equirectangular land picture (land white), instead of cobe's 256×128 one. */
  landTexture?: string
}

export interface Globe {
  update: (state: Partial<COBEOptions>) => void
  destroy: () => void
}

export default function createGlobe(
  canvas: HTMLCanvasElement,
  opts: COBEOptions,
): Globe
