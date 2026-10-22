import { NextResponse, type NextRequest } from 'next/server'
import { DEMO_COOKIE, MOTION_COOKIE } from '@/lib/viewer'

const PERSONAS = new Set(['visitor', 'member', 'lead', 'advisor', 'admin'])

// Review builds only: switch the DEMO persona and go back to the page it was pressed on.
export async function GET(req: NextRequest) {
  if (process.env.DEMO_MODE !== '1') return new NextResponse('Not found', { status: 404 })
  const as = req.nextUrl.searchParams.get('as') ?? 'visitor'
  const referer = req.headers.get('referer')
  let back = '/'
  try {
    if (referer && new URL(referer).origin === req.nextUrl.origin) back = new URL(referer).pathname + new URL(referer).search
  } catch {}
  const res = NextResponse.redirect(new URL(back, req.nextUrl.origin))
  // v3 animations are on by default; "off" is remembered per browser. Not httpOnly: the head script reads it.
  const motion = req.nextUrl.searchParams.get('motion')
  if (motion === 'off') res.cookies.set(MOTION_COOKIE, 'off', { httpOnly: false, sameSite: 'lax', path: '/' })
  if (motion === 'on') res.cookies.delete(MOTION_COOKIE)
  if (motion) return res
  if (!PERSONAS.has(as) || as === 'visitor') res.cookies.delete(DEMO_COOKIE)
  else res.cookies.set(DEMO_COOKIE, as, { httpOnly: true, sameSite: 'lax', path: '/' })
  return res
}
