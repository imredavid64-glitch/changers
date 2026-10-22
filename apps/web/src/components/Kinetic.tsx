import type { CSSProperties, ElementType, ReactNode } from 'react'

/**
 * Kinetic text (v3): the words and letters of a heading in their own spans, so the animated version can fly them in
 * one by one. Screen readers get the plain text from aria-label; the split copy is hidden from them.
 * Without the animated version (or with reduced motion) it renders as ordinary text.
 */
export function Kinetic({ text, as: Tag = 'h1', className, id, lines, after }: {
  text: string
  as?: ElementType
  className?: string
  id?: string
  /** split into this many lines (each line is a block, so the animated version can move lines apart on scroll) */
  lines?: number
  /** decoration after one word, e.g. a hand-drawn underline: [word, node] */
  after?: [string, ReactNode]
}) {
  const words = text.split(' ')
  const groups: string[][] = []
  if (lines && lines > 1) {
    const size = Math.ceil(words.length / lines)
    for (let i = 0; i < words.length; i += size) groups.push(words.slice(i, i + size))
  } else groups.push(words)
  let n = 0
  return (
    <Tag id={id} className={className} aria-label={text}>
      <span aria-hidden="true" className="kx">
        {groups.map((g, li) => (
          <span key={li} className={lines ? 'kx__line' : undefined} style={{ '--li': li } as CSSProperties}>
            {g.map((w, wi) => (
              <span key={wi}>
                <span className={after && after[0] === w ? 'kx__w squiggle' : 'kx__w'}>
                  {[...w].map((ch, ci) => (
                    <span key={ci} className="kx__c" style={{ '--i': n++ } as CSSProperties}>{ch}</span>
                  ))}
                  {after && after[0] === w ? after[1] : null}
                </span>
                {wi < g.length - 1 ? ' ' : ''}
              </span>
            ))}
            {!lines && li < groups.length - 1 ? ' ' : null}
          </span>
        ))}
      </span>
    </Tag>
  )
}
