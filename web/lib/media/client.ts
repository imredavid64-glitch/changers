"use client";

import { account } from "@/lib/appwrite/client";
import type { MediaUploadResponse, MediaPurpose, MediaVisibility } from "./types";

async function createMediaJwt() {
  const jwt = await account.createJWT();
  return jwt.jwt;
}

async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string; message?: string };
    return payload.error || payload.message || `Media request failed with status ${response.status}.`;
  } catch {
    return `Media request failed with status ${response.status}.`;
  }
}

export async function uploadMediaAsset(
  file: File,
  options: {
    purpose: MediaPurpose;
    visibility?: MediaVisibility;
  },
) {
  const jwt = await createMediaJwt();
  const formData = new FormData();

  formData.set("file", file);
  formData.set("purpose", options.purpose);
  formData.set("visibility", options.visibility || "public");

  const response = await fetch("/api/media/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as MediaUploadResponse;
}

export async function deleteMediaAsset(mediaId: string) {
  const jwt = await createMediaJwt();
  const response = await fetch(`/api/media/${encodeURIComponent(mediaId)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as { deleted: true; mediaId: string };
}

