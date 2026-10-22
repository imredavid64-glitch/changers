#!/usr/bin/env node
// Vendors cobe 2.0.1 (MIT, Shu Ding) into src/lib/cobe/ with four changes for the landing's network map (Luke, 4 Oct:
// "make the map more detailed and look better"):
//   1. dotSize: the land dots' radius is an option (cobe hard-codes 0.008 rad, which turns into blobs when zoomed in);
//   2. more dots: the lattice maths is extended from 2^15 to 2^20 points, so mapSamples can go past 32,768;
//   3. smoother coasts: the land picture is sampled bilinearly and cut at 50% (cobe samples it pixel by pixel);
//   4. graticule: an optional faint latitude/longitude grid every 10°, drawn in the shader.
// Also landTexture: an optional URL for a sharper land picture. Re-run after updating cobe: node scripts/vendor-cobe.mjs
import fs from 'node:fs'

const src = new URL('../node_modules/cobe/dist/index.esm.js', import.meta.url)
const outDir = new URL('../src/lib/cobe/', import.meta.url)
let s = fs.readFileSync(src, 'utf8')
const swap = (from, to, times = 1) => {
  const n = s.split(from).length - 1
  if (n !== times) throw new Error(`Expected ${times}× "${from.slice(0, 60)}…", found ${n}`)
  s = s.split(from).join(to)
}

// 1 + 4. New uniforms D (dot radius) and Gr (grid strength).
swap('uniform float k,x,y;uniform sampler2D z;', 'uniform float k,x,y,D,Gr;uniform sampler2D z;')
swap('smoothstep(8e-3,0.,g)', 'smoothstep(D,0.,g)')
swap('H(a,w,["t","s","k","x","v","F","w","n","y","z"])', 'H(a,w,["t","s","k","x","v","F","w","n","y","z","D","Gr"])')
swap('a.uniform1f(I.y,d),', 'a.uniform1f(I.y,d),a.uniform1f(I.D,$d),a.uniform1f(I.Gr,$g),')
swap('p=t.markerElevation??.05,', 'p=t.markerElevation??.05,$d=t.dotSize??.008,$g=t.graticule??0,')
swap('t.markerElevation!=q&&(p=t.markerElevation),', 't.markerElevation!=q&&(p=t.markerElevation),t.dotSize!=q&&($d=t.dotSize),t.graticule!=q&&($g=t.graticule),')

// 2. fract(2^n / φ) for n = 19…15, so lattice indices up to 2^20 keep their precision (cobe stops at 2^14).
const phiInv = 0.6180339887498949
const terms = [19, 18, 17, 16, 15].map((n) => {
  const v = 2 ** n
  const f = (v * phiInv) % 1
  return `a>=${v}.?(a-=${v}.,b+=${f.toFixed(6)}):0.,`
}).join('')
swap('a>=16384.?(a-=16384.,b+=.868872):0.,', terms + 'a>=16384.?(a-=16384.,b+=.868872):0.,')

// 3. Bilinear land picture, cut at 50%.
swap('a.TEXTURE_MIN_FILTER,a.NEAREST', 'a.TEXTURE_MIN_FILTER,a.LINEAR', 2)
swap('a.TEXTURE_MAG_FILTER,a.NEAREST', 'a.TEXTURE_MAG_FILTER,a.LINEAR', 2)
swap('float p=max(texture2D(z,vec2(e*.5/3.141593,-(j/3.141593+.5))).x,y)', 'float p=max(step(.5,texture2D(z,vec2(e*.5/3.141593,-(j/3.141593+.5))).x),y)')

// 4. The grid: distance (in radians) from this pixel's point on the sphere to the nearest 10° line, against the size
//    of a pixel there; faded towards the poles and the rim.
swap('m+=vec4(F*(mix((1.-q)*pow(i,.4),q,n.z)+.1)+pow(1.-i,4.)*w,1),',
  'm+=vec4(F*(mix((1.-q)*pow(i,.4),q,n.z)+.1)+pow(1.-i,4.)*w,1);' +
  'if(Gr>0.){vec3 gP=h*o;float gLa=asin(clamp(gP.y,-1.,1.)),gLo=atan(gP.z,-gP.x),gS=.1745329,' +
  'gDl=abs(fract(gLa/gS+.5)-.5)*gS,gDn=abs(fract(gLo/gS+.5)-.5)*gS*cos(gLa),gPx=2.*c.y/x/.8/max(i,.15),' +
  'gA=(1.-smoothstep(.5*gPx,1.5*gPx,min(gDl,gDn)))*(1.-smoothstep(1.2,1.4,abs(gLa)))*smoothstep(0.,.3,i);m.rgb+=gA*Gr*w;}')
swap('m.rgb+=gA*Gr*w;}l+=m*(1.+n.w)*.5,', 'm.rgb+=gA*Gr*w;}l+=m*(1.+n.w)*.5;')

// landTexture: a sharper land picture when we have one (same orientation as cobe's: equirectangular, land = white).
swap('j.src="data:image/png;base64,', 'j.src=t.landTexture||"data:image/png;base64,')

const license = fs.readFileSync(new URL('../node_modules/cobe/LICENSE', import.meta.url), 'utf8').trim()
const header = `/* eslint-disable */
// Vendored from cobe 2.0.1 (https://github.com/shuding/cobe), changed by scripts/vendor-cobe.mjs (dotSize, more
// samples, smoother coasts, graticule, landTexture). Don't edit by hand: change the script and re-run it.
/*
${license}
*/
`
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(new URL('index.js', outDir), header + s)
const dts = fs.readFileSync(new URL('../node_modules/cobe/dist/index.d.ts', import.meta.url), 'utf8')
  .replace('  markerElevation?: number\n}', `  markerElevation?: number

  // Vendored additions (scripts/vendor-cobe.mjs)
  /** Radius of a land dot, in radians on the unit sphere (cobe: 0.008). */
  dotSize?: number
  /** Strength of a faint 10° latitude/longitude grid, 0–1 (0 = none). */
  graticule?: number
  /** URL of an equirectangular land picture (land white), instead of cobe's 256×128 one. */
  landTexture?: string
}`)
if (!dts.includes('dotSize')) throw new Error('index.d.ts: anchor not found')
fs.writeFileSync(new URL('index.d.ts', outDir), dts)
console.log(`✓ src/lib/cobe/index.js (${((header.length + s.length) / 1024).toFixed(1)} KB) and index.d.ts`)
