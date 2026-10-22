import { createTranslator } from 'next-intl'
import messages from '../../messages/en.json'

// next-intl from day one (07 §12). v1 is English only and has no locale routing, so server
// components translate from the static message file: nothing here reads the request, which keeps
// public pages prerenderable. Adding locales later swaps this for next-intl's request config.
export const locale = 'en' as const
export type Messages = typeof messages

export function t<N extends keyof Messages>(namespace: N) {
  return createTranslator({ locale, messages, namespace })
}

export { messages }
