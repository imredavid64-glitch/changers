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

export async function deleteMyData() {
  const jwt = await createUserDataJwt();
  const response = await fetch("/api/user-data", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ confirm: true }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as { ok: true; message: string; deleted: number; errors: string[] };
}

/** Admin-only: permanently erases another user's data and account. */
export async function eraseUserData(targetUserId: string) {
  const jwt = await createUserDataJwt();
  const response = await fetch("/api/user-data", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ confirm: true, targetUserId }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as { ok: true; message: string; targetUserId: string; deleted: number; errors: string[] };
}
