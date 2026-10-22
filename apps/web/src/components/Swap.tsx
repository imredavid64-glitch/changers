import { ViewTransition, type ReactNode } from 'react'

/**
 * Content swapped by a user action (docs/03 §11, ledger row 4): filter results, list ↔ map, tabs.
 * A view transition runs only on navigation, never on the first page load, so the page is at rest when
 * it arrives. The new content fades in over 550 ms on Cosmos's spring (the `.swap` rules in globals.css).
 */
export function Swap({ k, name, children }: { k: string; name: string; children: ReactNode }) {
  return (
    <ViewTransition key={k} name={name} enter="swap" share="swap" default="none">
      {children}
    </ViewTransition>
  )
}
