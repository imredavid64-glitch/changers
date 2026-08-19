# Full Platform QA — Design

Date: 2026-08-19
Status: Approved
Environment: Production `https://changers-three.vercel.app` (Vercel, Appwrite Cloud)

## Goal

Run a complete test of every feature of the Changers platform on the live
production site, fix bugs as they are found (commit + deploy + re-verify), and
produce a QA report. The QA account and all test data are removed afterward.

## Approach

1. **Automated baselines** — re-run the Playwright e2e suite (7 specs) and the
   vitest suite (103 tests) on the VM in a node:22 Docker container to confirm
   the suite is green before manual testing begins.
2. **Live browser audit** — drive the production site with agent-browser using a
   dedicated QA account created through the real sign-up form (exercises the
   actual flow, including email verification and the new password policy).
3. **Fix as found** — every bug is fixed, committed, deployed, re-verified, and
   noted in the report.
4. **QA report** — written to `docs/qa/2026-08-19-full-audit.md` with every
   area tested, pass/fail result, and bugs found/fixed.
5. **Cleanup** — the QA account and its test data are deleted via the Appwrite
   Cloud API at the end.

## Feature Surface Under Test

### Auth
- Sign-up, sign-in, sign-out
- Email verification (banner, settings resend, verify page)
- Forgot / reset password
- Session persistence

### Profile & Settings
- Complete / edit profile, avatar upload
- Privacy settings, data export, delete account flow (visited, not executed on real data)
- Change password

### Social
- Posts: create, edit, delete, like, comment, poll, tags, strand filtering
- Search: people, projects, posts

### Projects & Events
- Projects: create, edit, join
- Events: create, RSVP

### Rooms & Messaging
- Rooms: create, join, chat
- Messages: 1:1 threads, unread state
- Notifications: list, preferences

### Tools
- Documents: create, edit, view
- Slideshows: create, view
- Code / Design / Films / Tables builders: create + view

### Media
- Uploads: avatar, post images, document attachments

### Impact & Gamification
- Dashboard stats
- Impact map / strand scores
- Badges: check flow, earned state

### Network & Mentors
- Follow, network list
- Mentor matching / mentor presence

### CAS Journal
- Reflections: create, edit, delete

### Call
- Call room: join, signaling, peers

### Admin / Access
- Admin-gated routes render correct access states (non-admin QA account)

### API Routes (via UI)
- Contact form, user-data export, spotlight, digest (smoke)

## Acceptance Criteria

- Every page loads without console errors.
- Every core flow completes end-to-end.
- Automated suites stay green.
- No leftover QA data after cleanup.

## Out of Scope for This Pass

- Desktop and mobile app builds (separate workstreams 2 and 3).
- Next-features roadmap (workstream 4).
- Dell-hosted app deep testing (re-run only if a blocking production bug is suspected there).