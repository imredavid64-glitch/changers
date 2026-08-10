# Bridge Platform

Bridge is a changemaker social network with one live backend and multiple clients:

- `web/`: Next.js website and API routes
- `mobile/`: Expo app for iPhone and Android
- `desktop/`: Electron app for macOS, Windows, and Linux
- `docker-compose.yml`: Dell PC production stack with Postgres, web, Caddy, and local media storage

## One-click local launch

- macOS: open `Bridge.command`
- Linux: run `./Bridge.sh`
- Windows: double-click `Bridge.bat`

These launch the web app and desktop shell together so you do not need to juggle `npm run dev` commands manually.

## Platform setup

1. Run `npm install` in the repository root.
2. Run `npm run install:all`.
3. Add Appwrite web env vars to `web/.env.local` and Expo Firebase env vars to `mobile/.env`.
4. Add Postgres/media env vars for the web app: `DATABASE_URL` and `MEDIA_ROOT`.
5. For Dell PC hosting, copy `.env.dell.example` to `.env.dell` and run `docker compose --env-file .env.dell up -d --build`.
6. Point the packaged desktop app to your live URL on first launch, or set `BRIDGE_DESKTOP_URL`.

## Build targets

- Website: `npm run web:build`
- Dell PC stack: `docker compose --env-file .env.dell up -d --build`
- Desktop installers: `npm run desktop:pack`
- Mobile production builds: `cd mobile && npx eas build --platform ios` or `npx eas build --platform android`

## Checks on the local copy (`check:local`)

This repo lives on iCloud-synced storage where bulk reads make `tsc`, `eslint`, and `next build` hang when run from the checkout. The `check:local` scripts sync the web source to a fast local copy (`/tmp/changers-web-check`, separate from the preview copy) and run the checks there:

- `npm --prefix web run check:local:type` — full `tsc --noEmit`
- `npm --prefix web run check:local:lint` — `eslint .`
- `npm --prefix web run check:local:build` — `tsc --noEmit && next build`
- `npm --prefix web run check:local` — all three in sequence

The sync is file-by-file with per-file timeouts (slow iCloud reads can never hang the run) and skips already-copied files; dependencies install automatically on first use. See `web/scripts/check-local.sh`. All three checks pass green (lint: 0 errors; `react-hooks/purity` and `react-hooks/set-state-in-effect` are intentionally warnings — see the comment in `web/eslint.config.mjs`).

`check:local` also runs the unit test suite (`npm run test`, vitest): 22 tests cover the user-data erase/anonymize flows against a mocked Appwrite fetch layer, contact-route validation/honeypot/rate-limiting, email-forwarding gating, and media storage safety — all without a live backend. The same checks run in CI on a clean machine via `.github/workflows/ci.yml` (Node 24, `npm ci`, then `npm run type-check`, `npm run lint`, `npm run test`, `npm run build`).

## Live backend

Bridge web currently uses Appwrite for auth, social records, permissions, and realtime activity. Uploaded website images use Postgres metadata plus local disk storage through the new media API.

The Dell PC deployment guide is in [DELL_PC_SETUP.md](/Users/imredavid/Documents/Changers/DELL_PC_SETUP.md). The media architecture notes are in [web/MEDIA_STORAGE.md](/Users/imredavid/Documents/Changers/web/MEDIA_STORAGE.md).

## Contact page

`web/app/contact/page.tsx` is a public contact page (linked from the footer and side nav) where visitors can email the team at `30dimrekatai@student.aisb.hu` (business & partnerships) and `davidimrekatai@gmail.com` (general), or submit the built-in form.

Form submissions are stored in the `contact_messages` Postgres table (migration `web/db/migrations/002_contact_messages.sql`) via `POST /api/contact`. The API captures the sender's name, email, optional organization/subject, message, consent flag, IP, user agent, referrer, page path, and the signed-in user ID when available. Each submission is also **forwarded by email** to the team inboxes when SMTP is configured (best-effort — a forward failure never fails the submission). Admins can review messages on the Admin Dashboard (Messages tab), which is served by `GET /api/contact` (admin-only, verified through Appwrite), can mark messages read/replied via `PATCH /api/contact/[id]`, and can **reply by email** straight from the panel (`POST /api/contact/[id]/reply`, which sends over SMTP and marks the message replied).

Environment variables:

- `DATABASE_URL` (or `POSTGRES_URL`) — required to store messages (same DB as media assets).
- `CONTACT_RATE_LIMIT_MAX` — optional; max messages per IP per hour (default `10`).
- `APPWRITE_API_KEY` — required for the admin Messages tab and user-data export/delete. Server-only: `NEXT_PUBLIC_*` keys are public by convention and are never used for privileged operations.
- `SMTP_HOST`, `SMTP_PORT` (default `587`), `SMTP_USER`, `SMTP_PASS` — SMTP account used to forward submissions.
- `SMTP_FROM` — optional; sender address for forwarded emails (defaults to `SMTP_USER`).
- `CONTACT_FORWARD_TO` — comma-separated recipient list, e.g. `30dimrekatai@student.aisb.hu, davidimrekatai@gmail.com`. Forwarding is inert until this and the SMTP vars are set.

The table auto-creates on first use, so no manual SQL is needed in dev.

## Video calls

Rooms have a **Start video call** button (room workspace header) linking to `/call/<roomId>`. Calls are peer-to-peer WebRTC (STUN included; optional TURN via `NEXT_PUBLIC_TURN_URL` / `NEXT_PUBLIC_TURN_USERNAME` / `NEXT_PUBLIC_TURN_CREDENTIAL` for restrictive networks), with signaling over an Appwrite collection:

- **Signaling** — the `call-signals` collection is the message bus. `POST /api/call/signal` (signed-in) writes signal documents server-side; clients subscribe to the collection channel via Appwrite realtime and filter by room. **Setup:** create a `call-signals` collection in Appwrite with fields `room_id`, `sender_id`, `kind`, `payload`, `created_at_ms`, and read access for signed-in users (set `NEXT_PUBLIC_APPWRITE_COLLECTION_CALL_SIGNALS` if you use a different id). Without it, the call UI shows a clear configuration message.
- **Features** — camera/mic toggles, screen share, participant grid, in-call chat, a collaborative **whiteboard** (strokes, color/size, undo, clear), **breakout rooms** (host assigns round-robin groups; other groups are muted/dimmed), a shared **timer** (presets + custom, with a completion chime), and emoji **reactions**.

Messaging outside calls uses the existing private threads (`/messages`) and per-room chat.

## Privacy & user data

`web/app/privacy/page.tsx` documents what Changers collects (account, content, social activity, contact submissions, media, and technical data) and gives signed-in users two self-service controls:

- **Export my data** — `GET /api/user-data/export` bundles the user's Appwrite documents (posts, comments, projects, rooms, messages, notifications, follows, badges, tools content, etc.), Postgres media metadata, and contact messages into a downloadable JSON file.
- **Delete my data** — `DELETE /api/user-data` (with `{ confirm: true }`) permanently deletes the user's documents, owned rooms/projects, removes them from shared memberships, deletes media rows + files and contact messages from Postgres, then deletes the Appwrite account.

Both routes require a signed-in session (Appwrite JWT) and only ever touch the caller's own data. Implementation lives in `web/lib/userdata/server.ts` and `web/lib/userdata/client.ts`. Requires `APPWRITE_API_KEY` (server-only) and `DATABASE_URL` for the Postgres portions.

Admins can also erase any user's data from the Admin Dashboard (Users tab → Erase): `DELETE /api/user-data` accepts an optional `targetUserId`, which is only honored when the caller is verified as an admin (`web/lib/admin/server.ts`). This lets moderators honor deletion requests from users who can no longer sign in. The erase tool has two modes:

- **Hard delete** (default) — permanently removes everything: documents, owned rooms/projects, memberships, media files + rows, contact messages, and the Appwrite account.
- **Anonymize** — keeps the user's public community content (posts, comments, events, room/thread messages, owned rooms/projects) but rewrites identity fields to "Former member", deletes personal/relational data (notifications, follows, saves, blocks, badges, RSVPs, private tool content, tasks), and drops them from shared memberships before deleting the profile + account. This is the right mode when the community content should survive the person's departure.

Every admin erase/anonymize action is recorded in the `admin_actions` Postgres table (`web/db/migrations/003_admin_audit.sql`, same DB as contact messages) and shown on the Admin Dashboard **Audit** tab: who acted on whom, which mode, item counts, and errors.

## Firebase checklist

The mobile app and bot layer still contain Firebase-era code. Keep these services available until the mobile app and functions are migrated to the same Postgres/Appwrite architecture:

- Authentication with Email/Password
- Cloud Firestore
- Firebase Storage
- Cloud Functions

The current app expects:

- Firestore rules from `firestore.rules`
- Storage rules from `storage.rules`
- Web public env vars in `web/.env.local`
- Functions deployed from `functions/`

The bot layer currently includes:

- `Bridge Guide`: sends a welcome notification when a new profile is created
- `Bridge Signal`: auto-comments on new posts with strand-aware coaching and discovery hints
