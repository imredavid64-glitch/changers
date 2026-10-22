#!/usr/bin/env node
// Copies MapLibre GL JS (BSD-3-Clause) from node_modules into public/vendor/maplibre/, so the browser loads it as a
// plain module from this site, only when the network map comes near the screen. MapLibre 6 finds its web worker next
// to its own file (import.meta.url), which a bundler would break, so it isn't bundled. Runs before every build.
import fs from 'node:fs'

import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dir = path.dirname(fileURLToPath(import.meta.url))
const candidates = [
  path.join(__dir, '..', 'node_modules', 'maplibre-gl'),
  path.join(__dir, '..', '..', '..', 'node_modules', 'maplibre-gl'),
]
const found = candidates.find((p) => fs.existsSync(path.join(p, 'package.json')))
const { pathToFileURL } = await import('node:url')
const from = pathToFileURL(found + '/')
const to = new URL('../public/vendor/maplibre/', import.meta.url)
const files = ['maplibre-gl.mjs', 'maplibre-gl-shared.mjs', 'maplibre-gl-worker.mjs', 'maplibre-gl.css']
fs.mkdirSync(to, { recursive: true })
const version = JSON.parse(fs.readFileSync(new URL('package.json', from), 'utf8')).version
let bytes = 0
for (const f of files) {
  // Drop the source-map comments: the maps aren't shipped.
  const text = fs.readFileSync(new URL(`dist/${f}`, from), 'utf8').replace(/\n\/\/# sourceMappingURL=\S+\s*$/, '\n')
  fs.writeFileSync(new URL(f, to), text)
  bytes += Buffer.byteLength(text)
}
fs.copyFileSync(new URL('LICENSE.txt', from), new URL('LICENSE.txt', to))
fs.writeFileSync(new URL('VERSION', to), `${version}\n`)
console.log(`✓ maplibre-gl ${version} → public/vendor/maplibre/ (${(bytes / 1024).toFixed(0)} KB)`)
