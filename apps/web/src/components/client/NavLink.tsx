'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type NavItem = { href: string; label: string }

/** The main nav with aria-current on the active link. Reads the URL, so the header wraps it in <Suspense>. */
export function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname()
  return (
    <>
      {items.map(({ href, label }) => {
        const current = path === href || path.startsWith(href + '/')
        return (
          <Link key={href} href={href} className="nav-link" aria-current={current ? 'page' : undefined}>
            {label}
          </Link>
        )
      })}
    </>
  )
}
