/**
 * Consolidated brand palette — the theme-aware color washes used in inline
 * styles across pages. Each value is a `color-mix()` off a globals.css token,
 * so it tracks the brand and flips with dark mode.
 *
 * Prefer these over hand-writing `color-mix(in srgb, var(--teal) 12%, …)`
 * everywhere: a tint tweak now lands in exactly one place. Tokens with a
 * single use site stay inline where they appear.
 */
export const TINTS = {
  teal5: "color-mix(in srgb, var(--teal) 5%, transparent)",
  teal6: "color-mix(in srgb, var(--teal) 6%, transparent)",
  teal8: "color-mix(in srgb, var(--teal) 8%, transparent)",
  teal10: "color-mix(in srgb, var(--teal) 10%, transparent)",
  teal12: "color-mix(in srgb, var(--teal) 12%, transparent)",
  teal14: "color-mix(in srgb, var(--teal) 14%, transparent)",
  teal15: "color-mix(in srgb, var(--teal) 15%, transparent)",
  teal20: "color-mix(in srgb, var(--teal) 20%, transparent)",
  coral8: "color-mix(in srgb, var(--coral) 8%, transparent)",
  coral10: "color-mix(in srgb, var(--coral) 10%, transparent)",
  coral15: "color-mix(in srgb, var(--coral) 15%, transparent)",
  coral20: "color-mix(in srgb, var(--coral) 20%, transparent)",
  coral40: "color-mix(in srgb, var(--coral) 40%, transparent)",
  sun10: "color-mix(in srgb, var(--sun) 10%, transparent)",
  sun12: "color-mix(in srgb, var(--sun) 12%, transparent)",
  sun22: "color-mix(in srgb, var(--sun) 22%, transparent)",
  moss5: "color-mix(in srgb, var(--moss) 5%, transparent)",
  moss6: "color-mix(in srgb, var(--moss) 6%, transparent)",
  moss10: "color-mix(in srgb, var(--moss) 10%, transparent)",
  moss12: "color-mix(in srgb, var(--moss) 12%, transparent)",
} as const;

export type TintName = keyof typeof TINTS;
