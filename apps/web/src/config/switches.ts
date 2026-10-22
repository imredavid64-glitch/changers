// Honesty switches (BUILD-PROMPT §Honesty switches). Every switch defaults to off, and each one
// names what has to be true before it turns on. Nothing reads these from the browser.
export const switches = {
  /** Real club photos exist, each approved by its advisor. */
  landingPhotos: false,
  /** The numbers are real and Luke switches them on. */
  networkCounters: false,
  /** Compass Education gave written permission (on hold). */
  compassWording: false,
  /** The host team registered or gave written permission (06 #10). */
  conferenceHub: false,
  /** The landing globe names real conference schools from their public pages (Luke, 4 Oct). PRD §5 rule 5 names a
   *  school only once its club registers or gives written permission, so the launch build waits for this; review
   *  builds (DEMO) show it so the group can see it. */
  conferenceSchools: false,
  /** That school's IT approved the app; add its domain to the allowlist too. */
  googleSignIn: false,
  microsoftSignIn: false,
  /** R3 is done, Resend is configured at launch, and the consent path is verified. */
  digest: false,
  /** An adult approved the legal texts (06 #1–2). Until then the pages show TODO markers. */
  legalFinal: false,
  /** Supabase passkeys leave beta. */
  passkeys: false,
} as const

/** Languages other than English ship only after a native review. */
export const languages = ['en'] as const

/** DEMO data: review builds only (npm run dev / preview). The launch build runs without it. */
export const demoMode = process.env.DEMO_MODE === '1'
