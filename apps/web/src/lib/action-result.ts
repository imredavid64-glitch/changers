// What a Server Action answers a form with (R1b): a short message for the person, never a raw database error, and
// sometimes a link to go on with.
export type ActionResult = { ok: boolean; message?: string; href?: string; linkText?: string } | null
