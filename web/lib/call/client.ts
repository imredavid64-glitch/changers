"use client";

import { account, client } from "@/lib/appwrite/client";
import { appwriteConfig, appwriteEnabled } from "@/lib/appwrite/config";
import type { CallSignalDoc, CallSignalKind } from "./types";

/**
 * Subscribes to every signal document and forwards those for the given room.
 * Returns an unsubscribe function. Inert when Appwrite is disabled.
 */
export function subscribeToCallRoom(
  roomId: string,
  onSignal: (signal: CallSignalDoc) => void,
): () => void {
  if (!appwriteEnabled) return () => {};

  const channel = `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.collections.callSignals}.documents`;
  const unsubscribe = client.subscribe(channel, (response) => {
    const payload = response.payload as CallSignalDoc;
    if (payload.room_id === roomId) {
      onSignal(payload);
    }
  });

  return () => unsubscribe();
}

/** Publishes a signal through the signed-in API route. */
export async function publishCallSignal(input: {
  roomId: string;
  kind: CallSignalKind;
  payload: string;
}) {
  const jwt = await account.createJWT();
  const response = await fetch("/api/call/signal", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt.jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    let message = `Signal publish failed (${response.status}).`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // fall through with the status-based message
    }
    throw new Error(message);
  }
}
