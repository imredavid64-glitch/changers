"use client";

import { useEffect } from "react";

/**
 * Registers the app service worker once per session so the platform is
 * installable (PWA) and keeps working offline. Registration is idempotent and
 * best-effort — an unsupported browser or blocked storage is not an error.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Best-effort: some browsers/contexts (e.g. private mode) refuse SWs.
    });
  }, []);

  return null;
}
