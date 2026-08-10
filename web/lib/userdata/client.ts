"use client";

import { account } from "@/lib/appwrite/client";

async function createUserDataJwt() {
  const jwt = await account.createJWT();
  return jwt.jwt;
}

async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string; message?: string };
    return payload.error || payload.message || `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

export async function downloadMyData() {
  const jwt = await createUserDataJwt();
  const response = await fetch("/api/user-data/export", {
    headers: { Authorization: `Bearer ${jwt}` },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const bundle = await response.json();
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `changers-my-data-${date}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  return bundle;
}

async function deleteUserDataRequest(body: Record<string, unknown>) {
  const jwt = await createUserDataJwt();
  const response = await fetch("/api/user-data", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ confirm: true, ...body }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response;
}

export async function deleteMyData() {
  const response = await deleteUserDataRequest({});
  return (await response.json()) as { ok: true; message: string; deleted: number; errors: string[] };
}

/** Admin-only: permanently erases another user's data and account. */
export async function eraseUserData(targetUserId: string) {
  const response = await deleteUserDataRequest({ targetUserId });
  return (await response.json()) as {
    ok: true;
    message: string;
    targetUserId: string;
    mode: "delete";
    deleted: number;
    errors: string[];
  };
}

/**
 * Admin-only: keeps the user's community content (posts, comments, projects)
 * but strips their identity and deletes personal data, instead of hard-deleting.
 */
export async function anonymizeUserData(targetUserId: string) {
  const response = await deleteUserDataRequest({ targetUserId, mode: "anonymize" });
  return (await response.json()) as {
    ok: true;
    message: string;
    targetUserId: string;
    mode: "anonymize";
    deleted: number;
    anonymized: number;
    errors: string[];
  };
}
