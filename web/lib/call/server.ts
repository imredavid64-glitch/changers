import { appwriteConfig, appwriteEnabled } from "@/lib/appwrite/config";
import type { CallSignalDoc } from "./types";

function getServerApiKey(): string | null {
  if (!appwriteEnabled) return null;
  // Server-only key: NEXT_PUBLIC_* values are public by convention and must
  // never guard server-side writes.
  return process.env.APPWRITE_API_KEY?.trim() || null;
}

export interface CreateCallSignalInput {
  roomId: string;
  senderId: string;
  kind: CallSignalDoc["kind"];
  payload: string;
}

/**
 * Publishes a signal document to the callSignals collection using the server
 * API key (bypasses client permissions; the collection itself only needs read
 * access for signed-in users so their realtime subscriptions receive events).
 */
export async function createCallSignal(input: CreateCallSignalInput) {
  const apiKey = getServerApiKey();
  if (!apiKey) {
    throw new Error("Appwrite API key is not configured on the server.");
  }

  const url = `${appwriteConfig.endpoint}/databases/${appwriteConfig.databaseId}/collections/${appwriteConfig.collections.callSignals}/documents`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": appwriteConfig.projectId,
      "X-Appwrite-Key": apiKey,
    },
    body: JSON.stringify({
      documentId: "unique()",
      data: {
        room_id: input.roomId,
        sender_id: input.senderId,
        kind: input.kind,
        payload: input.payload,
        created_at_ms: Date.now(),
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const message = body.includes("collection")
      ? "The call-signals collection is not configured. Create a 'call-signals' collection in Appwrite (fields: room_id, sender_id, kind, payload, created_at_ms) with read access for signed-in users."
      : `Appwrite API error: ${response.status} ${body.slice(0, 200)}`;
    throw new Error(message);
  }

  return (await response.json()) as CallSignalDoc;
}
