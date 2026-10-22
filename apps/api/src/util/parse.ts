export function parseSelect(select: string): string[] {
  // PostgREST select - keep simple tokenization
  const parts: string[] = []
  let cur = ''
  let depth = 0
  let inStr = false
  let quote = '"'
  for (let i = 0; i < select.length; i++) {
    const c = select[i]
    if (inStr) {
      cur += c
      if (c === quote) inStr = false
      continue
    }
    if (c === '"' || c === "'") {
      inStr = true
      quote = c
      cur += c
      continue
    }
    if (c === '(') { depth++; cur += c; continue }
    if (c === ')') { depth--; cur += c; continue }
    if (c === ',' && depth === 0) {
      parts.push(cur.trim())
      cur = ''
      continue
    }
    cur += c
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

export function isEmbed(s: string): boolean {
  return s.includes('(') && !s.includes('->')
}
