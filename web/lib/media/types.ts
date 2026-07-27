export const MEDIA_PURPOSES = ["avatar", "post", "attachment", "misc"] as const;

export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

export const MEDIA_VISIBILITIES = ["public", "private"] as const;

export type MediaVisibility = (typeof MEDIA_VISIBILITIES)[number];

export const MEDIA_VARIANTS = ["original", "preview", "thumbnail"] as const;

export type MediaVariant = (typeof MEDIA_VARIANTS)[number];

export const SUPPORTED_MEDIA_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export type SupportedMediaMimeType = (typeof SUPPORTED_MEDIA_MIME_TYPES)[number];

export interface MediaAssetRecord {
  id: string;
  ownerUserId: string;
  purpose: MediaPurpose;
  visibility: MediaVisibility;
  storageKey: string;
  originalFilename: string;
  mimeType: SupportedMediaMimeType;
  sizeBytes: number;
  widthPx: number;
  heightPx: number;
  sha256: string;
  createdAt: string;
  deletedAt: string | null;
}

export interface MediaUploadResponse {
  mediaId: string;
  storageKey: string;
  publicUrl: string;
  previewUrl: string;
  thumbnailUrl: string;
  originalUrl: string;
  purpose: MediaPurpose;
  visibility: MediaVisibility;
  originalFilename: string;
  mimeType: SupportedMediaMimeType;
  sizeBytes: number;
  widthPx: number;
  heightPx: number;
  sha256: string;
}

