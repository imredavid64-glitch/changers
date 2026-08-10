/**
 * The Changers mobile app is a native WebView wrapper around the full platform.
 * It loads the same responsive web app the PWA installs, wrapped in native
 * chrome (safe areas, back/forward/reload controls, offline handling).
 *
 * Override the URL for local development against the web dev server:
 *   EXPO_PUBLIC_APP_URL=http://127.0.0.1:3000 npm run ios
 */
export const APP_URL =
  process.env.EXPO_PUBLIC_APP_URL?.trim() || "https://changers-three.vercel.app";

export const APP_NAME = "Changers";
