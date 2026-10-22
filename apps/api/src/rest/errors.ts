export function postgrestError(code: string, message: string, details?: string, hint?: string, status = 400) {
  const err: any = new Error(message)
  err.code = code
  err.details = details ?? ''
  err.hint = hint ?? ''
  err.status = status
  return err
}

export function mapError(e: any) {
  const status = e.status ?? 400
  const body = {
    code: e.code ?? 'PGRST000',
    message: e.message ?? 'error',
    details: e.details ?? '',
    hint: e.hint ?? '',
  }
  return { status, body }
}
