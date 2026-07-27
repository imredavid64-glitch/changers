# Bridge Mobile

React Native (Expo) companion app for the Bridge platform.

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Add Firebase environment variables:

```bash
cp .env.example .env
```

3. Run the app:

```bash
npm run ios
# or
npm run android
# or
npm run web
```

## Structure

- Expo Router screens live in `app/`.
- Firebase auth and data helpers live in `src/lib/`.
- Shared tokens and supporting data live in `src/`.

## Firebase

Bridge mobile uses the same Firebase Authentication, Firestore, and Storage project as the website.

## Production Builds

```bash
npx eas login
npx eas build:configure
npm run build:ios
npm run build:android
```

For over-the-air updates after the app is in production:

```bash
npm run update
```
