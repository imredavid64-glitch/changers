"use client";

import { Models } from "appwrite";
import { appwriteConfig, appwriteEnabled } from "@/lib/appwrite/config";
import { ID, Permission, Query, Role, client, databases, storage } from "@/lib/appwrite/client";

export type AppwriteDocument = Models.Document & Record<string, unknown>;

export const COLLECTIONS = appwriteConfig.collections;

export function nowMs() {
  return Date.now();
}

export function publicReadOwnerWritePermissions(userId: string) {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

export function publicReadAuthenticatedUpdatePermissions(ownerId: string) {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.users()),
    Permission.delete(Role.user(ownerId)),
  ];
}

export function privateReadWritePermissions(userId: string) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

export function sharedReadPermissions(userIds: string[], writerIds: string[] = userIds) {
  const readers = userIds.map((userId) => Permission.read(Role.user(userId)));
  const writers = writerIds.flatMap((userId) => [
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ]);

  return [...readers, ...writers];
}

export function buildCollectionChannel(collectionId: string) {
  return `databases.${appwriteConfig.databaseId}.collections.${collectionId}.documents`;
}

export async function listDocuments<T extends AppwriteDocument = AppwriteDocument>(
  collectionId: string,
  queries: string[] = [],
) {
  if (!appwriteEnabled) return [] as T[];

  const result = await databases.listDocuments(
    appwriteConfig.databaseId,
    collectionId,
    queries,
  );

  return result.documents as unknown as T[];
}

export async function countDocuments(collectionId: string, queries: string[] = []) {
  if (!appwriteEnabled) return 0;

  const result = await databases.listDocuments(
    appwriteConfig.databaseId,
    collectionId,
    [...queries, Query.limit(1)],
  );

  return result.total || 0;
}

export async function getDocument<T extends AppwriteDocument = AppwriteDocument>(
  collectionId: string,
  documentId: string,
) {
  if (!appwriteEnabled) return null;

  try {
    return (await databases.getDocument(
      appwriteConfig.databaseId,
      collectionId,
      documentId,
    )) as T;
  } catch {
    return null;
  }
}

export async function createDocument<T extends Record<string, unknown>>(
  collectionId: string,
  data: T,
  permissions?: string[],
  documentId = ID.unique(),
) {
  return databases.createDocument(
    appwriteConfig.databaseId,
    collectionId,
    documentId,
    data,
    permissions,
  );
}

export async function updateDocument<T extends Record<string, unknown>>(
  collectionId: string,
  documentId: string,
  data: T,
  permissions?: string[],
) {
  return databases.updateDocument(
    appwriteConfig.databaseId,
    collectionId,
    documentId,
    data,
    permissions,
  );
}

export async function deleteDocument(collectionId: string, documentId: string) {
  return databases.deleteDocument(
    appwriteConfig.databaseId,
    collectionId,
    documentId,
  );
}

export function subscribeToCollection(
  collectionId: string,
  onEvent: () => void,
) {
  if (!appwriteEnabled) return () => {};

  return client.subscribe(buildCollectionChannel(collectionId), () => {
    onEvent();
  });
}

export function watchDocuments<T>(
  collectionId: string,
  queries: string[],
  mapDocument: (document: AppwriteDocument) => T,
  onData: (documents: T[]) => void,
  onError?: (error: unknown) => void,
) {
  let active = true;

  const load = async () => {
    try {
      const documents = await listDocuments(collectionId, queries);
      if (active) {
        onData(documents.map((document) => mapDocument(document)));
      }
    } catch (error) {
      if (active) {
        onError?.(error);
      }
    }
  };

  void load();
  const unsubscribe = subscribeToCollection(collectionId, () => {
    void load();
  });

  return () => {
    active = false;
    unsubscribe();
  };
}

export function watchDocument<T>(
  collectionId: string,
  documentId: string,
  mapDocument: (document: AppwriteDocument) => T,
  onData: (document: T | null) => void,
  onError?: (error: unknown) => void,
) {
  let active = true;

  const load = async () => {
    try {
      const document = await getDocument(collectionId, documentId);
      if (active) {
        onData(document ? mapDocument(document) : null);
      }
    } catch (error) {
      if (active) {
        onError?.(error);
      }
    }
  };

  void load();
  const unsubscribe = subscribeToCollection(collectionId, () => {
    void load();
  });

  return () => {
    active = false;
    unsubscribe();
  };
}

export async function uploadMediaFile(
  userId: string,
  file: File,
  visibility: "public" | "private" = "public",
) {
  const permissions =
    visibility === "public"
      ? [
          Permission.read(Role.any()),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId)),
        ]
      : privateReadWritePermissions(userId);

  const created = await storage.createFile(
    appwriteConfig.mediaBucketId,
    ID.unique(),
    file,
    permissions,
  );

  return created;
}

export function buildDefaultProfileDocument(userId: string, fullName: string, role = "Community member") {
  return {
    user_id: userId,
    full_name: fullName,
    role,
    headline: "",
    bio: "",
    location: "",
    avatar_file_id: "",
    avatar_media_id: "",
    avatar_media_storage_key: "",
    avatar_media_url: "",
    interests: ["S"],
    saved_project_ids: [],
    is_mentor: false,
    mentor_focus: "",
    is_admin: false,
    privacy: "public",
    theme: "moss",
    search_index: `${fullName} ${role}`.toLowerCase(),
    created_at_ms: nowMs(),
    updated_at_ms: nowMs(),
  };
}
