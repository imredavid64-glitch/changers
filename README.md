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

## Live backend

Bridge web currently uses Appwrite for auth, social records, permissions, and realtime activity. Uploaded website images use Postgres metadata plus local disk storage through the new media API.

The Dell PC deployment guide is in [DELL_PC_SETUP.md](/Users/imredavid/Documents/Changers/DELL_PC_SETUP.md). The media architecture notes are in [web/MEDIA_STORAGE.md](/Users/imredavid/Documents/Changers/web/MEDIA_STORAGE.md).

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
