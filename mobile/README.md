# Changers Mobile

Native iOS and Android app for the Changers platform. It wraps the full
Changers web app (the same responsive app the PWA installs) in a native shell —
safe-area-aware chrome, back/forward/reload controls, offline handling, and
external links opened in the system browser. One codebase, both stores, the
entire platform.

## Why a WebView wrapper?

The web app already has the complete feature set (posts, rooms, messaging,
video calls, projects, admin). Duplicating all of it natively in React Native
would split the codebase and double the maintenance for every feature. Instead,
the native app is a thin, mobile-suited shell around the same platform — the
same approach as the desktop Electron app.

## Quick Start

```bash
npm install

# Point the app at a local web dev server instead of production:
EXPO_PUBLIC_APP_URL=http://127.0.0.1:3000 npm run ios
# or
EXPO_PUBLIC_APP_URL=http://127.0.0.1:3000 npm run android
```

The default URL is the production deploy (`https://changers-three.vercel.app`),
configurable at build/run time via `EXPO_PUBLIC_APP_URL` (see `src/lib/config.ts`).

## Structure

- `App.tsx` — the native shell (WebView + chrome).
- `src/lib/config.ts` — app URL configuration.
- `src/theme.ts` — shared colors/spacing for the native chrome.

## Checks

```bash
npm run type-check
```

## Production Builds

```bash
npx eas login
npx eas build:configure
npm run build:ios
npm run build:android
```

For over-the-air updates after the app is in the stores:

```bash
npm run update
```
