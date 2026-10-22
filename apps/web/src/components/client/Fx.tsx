'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Lenis from 'lenis'

const TILT = '.sticker-card, .tile, .learn-card, .list-card, .project-card, .resource-block'
const MAGNETIC = '.btn, [data-magnetic]'

/**
 * v3's global motion (the animated version, on unless the DEMO pill turns it off; never with reduced motion):
 * - Lenis smooth scrolling (both measured references, Cuberto and Locomotive, run Lenis);
 * - a cursor ring that follows the pointer and grows over links (the native cursor stays);
 * - magnetic buttons that lean toward the pointer and spring back (Cuberto: .8s cubic-bezier(.16,1,.3,1));
 * - --tilt-x/--tilt-y on the card under the pointer (only that card moves; the hero wall no longer follows the mouse).
 */
export function Fx() {
  const pathname = usePathname()

  useEffect(() => {
    const root = document.documentElement
    if (root.dataset.motion !== 'on' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches

    const lenis = new Lenis({ lerp: 0.1, anchors: true })
    let raf = requestAnimationFrame(function loop(time) { lenis.raf(time); raf = requestAnimationFrame(loop) })
    ;(window as unknown as { __lenis?: Lenis }).__lenis = lenis

    if (!fine) return () => { cancelAnimationFrame(raf); lenis.destroy() }

    const cursor = document.createElement('div')
    cursor.className = 'cursor'
    cursor.setAttribute('aria-hidden', 'true')
    document.body.appendChild(cursor)
    let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy
    let frame = 0
    const follow = () => {
      cx += (tx - cx) * 0.2
      cy += (ty - cy) * 0.2
      cursor.style.translate = `${cx}px ${cy}px`
      frame = requestAnimationFrame(follow)
    }
    frame = requestAnimationFrame(follow)

    const onMove = (e: PointerEvent) => {
      tx = e.clientX; ty = e.clientY
      const target = e.target as Element | null
      cursor.classList.toggle('is-link', !!target?.closest?.('a, button, label, summary, [role="button"]'))
      cursor.classList.toggle('is-card', !!target?.closest?.(TILT))
      const tilt = target?.closest?.(TILT) as HTMLElement | null
      if (tilt) {
        const r = tilt.getBoundingClientRect()
        tilt.style.setProperty('--tilt-x', `${(-(((e.clientY - r.top) / r.height) - 0.5) * 8).toFixed(2)}deg`)
        tilt.style.setProperty('--tilt-y', `${((((e.clientX - r.left) / r.width) - 0.5) * 10).toFixed(2)}deg`)
      }
      const mag = target?.closest?.(MAGNETIC) as HTMLElement | null
      if (mag) {
        const r = mag.getBoundingClientRect()
        mag.style.setProperty('--mag-x', `${((e.clientX - (r.left + r.width / 2)) * 0.28).toFixed(1)}px`)
        mag.style.setProperty('--mag-y', `${((e.clientY - (r.top + r.height / 2)) * 0.32).toFixed(1)}px`)
      }
    }
    const onOut = (e: PointerEvent) => {
      const from = e.target as Element | null
      const to = e.relatedTarget as Node | null
      for (const sel of [TILT, MAGNETIC]) {
        const el = from?.closest?.(sel) as HTMLElement | null
        if (el && !el.contains(to)) ['--tilt-x', '--tilt-y', '--mag-x', '--mag-y'].forEach((p) => el.style.removeProperty(p))
      }
    }
    const onDown = () => cursor.classList.add('is-down')
    const onUp = () => cursor.classList.remove('is-down')
    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerout', onOut, { passive: true })
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('pointerup', onUp)
    return () => {
      cancelAnimationFrame(raf); cancelAnimationFrame(frame); lenis.destroy(); cursor.remove()
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerout', onOut)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointerup', onUp)
    }
  }, [])

  // A new page starts at the top (Lenis keeps its own scroll position otherwise), and its headings that start
  // below the fold wait to fly in until they scroll into view. (They are hidden only here, by script, so without
  // JavaScript they simply show.)
  useEffect(() => {
    const lenis = (window as unknown as { __lenis?: Lenis }).__lenis
    lenis?.scrollTo(0, { immediate: true, force: true })
    if (document.documentElement.dataset.motion !== 'on' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const late = [...document.querySelectorAll<HTMLElement>('.kx')].filter((el) => el.getBoundingClientRect().top > innerHeight * 0.9)
    late.forEach((el) => el.classList.add('kx--late'))
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target) }
    }, { threshold: 0.25 })
    late.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [pathname])

  return null
}
