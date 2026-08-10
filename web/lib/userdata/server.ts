import { appwriteConfig, appwriteEnabled } from "@/lib/appwrite/config";
import { getMediaPool, getMediaRoot } from "@/lib/media/server";
import { removeMediaAssetFiles } from "@/lib/media/storage";
import { getContactPool } from "@/lib/contact/server";

/**
 * Collections where the user is the direct owner of a document, keyed by the
 * attribute(s) that store the user id. Used for both export and deletion.
 */
const OWNED_COLLECTIONS: Record<string, string[]> = {
  posts: ["author_id"],
  comments: ["author_id"],
  events: ["host_id"],
  eventRsvps: ["user_id"],
  documents: ["user_id"],
  slideshows: ["user_id"],
  tables: ["user_id"],
  codeSnippets: ["user_id"],
  designs: ["user_id"],
  films: ["user_id"],
  badges: ["user_id"],
  savedPosts: ["user_id"],
  notifications: ["user_id"],
  roomMessages: ["author_id"],
  threadMessages: ["sender_id"],
  tasks: ["assignee_id", "created_by"],
  follows: ["follower_id", "followee_id"],
  blocks: ["blocker_id", "blocked_id"],
};

// Collections the user participates in (array membership), not owns.
const MEMBERSHIP_COLLECTIONS: Record<string, string> = {
  rooms: "members",
  projects: "members",
  threads: "participants",
};

const OWNER_ID_COLLECTIONS: Record<string, string> = {
  rooms: "owner_id",
  projects: "owner_id",
};

interface AppwriteDoc {
  $id: string;
  [key: string]: unknown;
}

function getServerApiKey(): string | null {
  if (!appwriteEnabled) return null;
  // Server-only key: NEXT_PUBLIC_* values are public by convention and must
  // never guard privileged operations like export or account deletion.
  return process.env.APPWRITE_API_KEY?.trim() || null;
}

function collectionUrl(collectionId: string) {
  return `${appwriteConfig.endpoint}/databases/${appwriteConfig.databaseId}/collections/${collectionId}/documents`;
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const apiKey = getServerApiKey();
  if (!apiKey) {
    throw new Error("Appwrite API key is not configured on the server.");
  }

  const response = await fetch(`${appwriteConfig.endpoint}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": appwriteConfig.projectId,
      "X-Appwrite-Key": apiKey,
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Appwrite API error: ${response.status} ${body.slice(0, 300)}`);
  }

  return response;
}

function encodeQuery(query: string) {
  return `queries[]=${encodeURIComponent(query)}`;
}

async function listDocs(collectionId: string, queries: string[]): Promise<AppwriteDoc[]> {
  const params = [...queries.map(encodeQuery), "limit=5000"].join("&");
  const response = await apiFetch(`${collectionUrl(collectionId)}?${params}`);
  const payload = (await response.json()) as { documents?: AppwriteDoc[] };
  return payload.documents || [];
}

async function getDoc(collectionId: string, documentId: string): Promise<AppwriteDoc | null> {
  try {
    const response = await apiFetch(`${collectionUrl(collectionId)}/${documentId}`);
    return (await response.json()) as AppwriteDoc;
  } catch {
    return null;
  }
}

async function deleteDoc(collectionId: string, documentId: string) {
  await apiFetch(`${collectionUrl(collectionId)}/${documentId}`, { method: "DELETE" });
}

async function updateDoc(collectionId: string, documentId: string, data: Record<string, unknown>) {
  await apiFetch(`${collectionUrl(collectionId)}/${documentId}`, {
    method: "PATCH",
    body: JSON.stringify({ data }),
  });
}

async function deleteAccount(userId: string) {
  await apiFetch(`/users/${userId}`, { method: "DELETE" });
}

function dedupeByDocId(docs: AppwriteDoc[]) {
  const byId = new Map<string, AppwriteDoc>();
  for (const doc of docs) {
    if (typeof doc.$id === "string" && !byId.has(doc.$id)) {
      byId.set(doc.$id, doc);
    }
  }
  return [...byId.values()];
}

async function listOwnedDocs(collectionId: string, userId: string) {
  const attributes = OWNED_COLLECTIONS[collectionId];
  if (!attributes) return [];

  const all: AppwriteDoc[] = [];
  for (const attribute of attributes) {
    const docs = await listDocs(collectionId, [`equal("${attribute}","${userId}")`]);
    all.push(...docs);
  }
  return dedupeByDocId(all);
}

async function listMembershipDocs(collectionId: string, userId: string) {
  const attribute = MEMBERSHIP_COLLECTIONS[collectionId];
  if (!attribute) return [];
  return listDocs(collectionId, [`equal("${attribute}","${userId}")`]);
}

async function listOwnedMembershipDocs(collectionId: string, userId: string) {
  const ownerAttribute = OWNER_ID_COLLECTIONS[collectionId];
  if (!ownerAttribute) return [];
  return listDocs(collectionId, [`equal("${ownerAttribute}","${userId}")`]);
}

async function listOwnedMedia(ownerUserId: string) {
  try {
    const { rows } = await getMediaPool().query<{
      id: string;
      storage_key: string;
      original_filename: string;
      mime_type: string;
      size_bytes: string | number;
      created_at: string | Date;
    }>(
      `SELECT id, storage_key, original_filename, mime_type, size_bytes, created_at
       FROM media_assets
       WHERE owner_user_id = $1
       ORDER BY created_at DESC`,
      [ownerUserId],
    );
    return rows.map((row) => ({
      id: row.id,
      storageKey: row.storage_key,
      originalFilename: row.original_filename,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes),
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    }));
  } catch {
    return [];
  }
}

async function listContactMessages(userId: string) {
  try {
    const { rows } = await getContactPool().query<{
      id: string;
      name: string;
      email: string;
      organization: string | null;
      subject: string | null;
      message: string;
      created_at: string | Date;
    }>(
      `SELECT id, name, email, organization, subject, message, created_at
       FROM contact_messages
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      organization: row.organization,
      subject: row.subject,
      message: row.message,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    }));
  } catch {
    return [];
  }
}

export interface ExportBundle {
  generatedAt: string;
  userId: string;
  profile: AppwriteDoc | null;
  collections: Record<string, AppwriteDoc[]>;
  memberships: Record<string, AppwriteDoc[]>;
  mediaAssets: Awaited<ReturnType<typeof listOwnedMedia>>;
  contactMessages: Awaited<ReturnType<typeof listContactMessages>>;
}

export async function exportUserData(userId: string): Promise<ExportBundle> {
  const collections: Record<string, AppwriteDoc[]> = {};
  const memberships: Record<string, AppwriteDoc[]> = {};

  let profile: AppwriteDoc | null = null;
  if (getServerApiKey()) {
    profile = await getDoc(appwriteConfig.collections.profiles, userId);

    for (const collectionId of Object.keys(OWNED_COLLECTIONS)) {
      collections[collectionId] = await listOwnedDocs(collectionId, userId);
    }
    for (const collectionId of Object.keys(MEMBERSHIP_COLLECTIONS)) {
      memberships[collectionId] = await listMembershipDocs(collectionId, userId);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    userId,
    profile,
    collections,
    memberships,
    mediaAssets: await listOwnedMedia(userId),
    contactMessages: await listContactMessages(userId),
  };
}

// Personal/relational collections deleted entirely in anonymize mode; the user's
// public community content is kept but stripped of identity.
const ANONYMIZE_DELETE_COLLECTIONS = [
  "notifications",
  "follows",
  "savedPosts",
  "blocks",
  "badges",
  "eventRsvps",
  "documents",
  "slideshows",
  "tables",
  "codeSnippets",
  "designs",
  "films",
  "tasks",
];

// Kept content, with identity fields replaced. search_index is rebuilt so the
// former name no longer surfaces in search.
const ANONYMIZE_FIELD_MAP: Record<string, Record<string, string>> = {
  posts: {
    author_name: "Former member",
    author_role: "",
    author_avatar_file_id: "",
    author_avatar_media_id: "",
    author_avatar_media_storage_key: "",
    author_avatar_media_url: "",
    author_avatar_url: "",
    search_index: "former member",
  },
  comments: {
    author_name: "Former member",
    author_avatar_file_id: "",
    author_avatar_media_id: "",
    author_avatar_media_storage_key: "",
    author_avatar_media_url: "",
    author_avatar_url: "",
  },
  events: { host_name: "Former member" },
  roomMessages: { author_name: "Former member" },
  threadMessages: { sender_name: "Former member" },
};

// Rooms/projects the user owns: anonymize the owner name and drop the user from
// the members array so the doc survives without pointing at a deleted profile.
const ANONYMIZE_OWNED_MAP: Record<string, { ownerNameField: string; memberField: string }> = {
  rooms: { ownerNameField: "owner_name", memberField: "members" },
  projects: { ownerNameField: "owner_name", memberField: "members" },
};

export async function anonymizeUserData(userId: string) {
  const deleted: string[] = [];
  const anonymized: string[] = [];
  const errors: string[] = [];

  const recordError = (label: string, error: unknown) => {
    errors.push(`${label}: ${error instanceof Error ? error.message : "error"}`);
  };

  if (getServerApiKey()) {
    // 1. Delete personal/relational collections (notifications, follows, saved
    //    posts, blocks, badges, RSVPs, private tool content, tasks).
    for (const collectionId of ANONYMIZE_DELETE_COLLECTIONS) {
      const docs = await listOwnedDocs(collectionId, userId);
      for (const doc of docs) {
        try {
          await deleteDoc(collectionId, doc.$id);
          deleted.push(`${collectionId}/${doc.$id}`);
        } catch (error) {
          recordError(`${collectionId}/${doc.$id}`, error);
        }
      }
    }

    // 2. Anonymize kept community content (posts, comments, events, messages).
    for (const [collectionId, fieldMap] of Object.entries(ANONYMIZE_FIELD_MAP)) {
      const docs = await listOwnedDocs(collectionId, userId);
      for (const doc of docs) {
        try {
          await updateDoc(collectionId, doc.$id, fieldMap);
          anonymized.push(`${collectionId}/${doc.$id}`);
        } catch (error) {
          recordError(`${collectionId}/${doc.$id}`, error);
        }
      }
    }

    // 3. Owned rooms/projects: anonymize the owner name, drop the user from members.
    for (const [collectionId, config] of Object.entries(ANONYMIZE_OWNED_MAP)) {
      const docs = await listOwnedMembershipDocs(collectionId, userId);
      for (const doc of docs) {
        try {
          const members = Array.isArray(doc[config.memberField]) ? (doc[config.memberField] as string[]) : [];
          await updateDoc(collectionId, doc.$id, {
            [config.ownerNameField]: "Former member",
            [config.memberField]: members.filter((memberId) => memberId !== userId),
          });
          anonymized.push(`${collectionId}/${doc.$id}`);
        } catch (error) {
          recordError(`${collectionId}/${doc.$id}`, error);
        }
      }
    }

    // 4. Remove the user from shared memberships.
    for (const [collectionId, attribute] of Object.entries(MEMBERSHIP_COLLECTIONS)) {
      const docs = await listMembershipDocs(collectionId, userId);
      for (const doc of docs) {
        try {
          const members = Array.isArray(doc[attribute]) ? (doc[attribute] as string[]) : [];
          const next = members.filter((memberId) => memberId !== userId);
          if (next.length !== members.length) {
            await updateDoc(collectionId, doc.$id, { [attribute]: next });
            anonymized.push(`${collectionId}/${doc.$id} (removed membership)`);
          }
        } catch (error) {
          recordError(`${collectionId}/${doc.$id}`, error);
        }
      }
    }

    // 5. Delete the profile document and the Appwrite account.
    try {
      await deleteDoc(appwriteConfig.collections.profiles, userId);
      deleted.push(`profiles/${userId}`);
    } catch (error) {
      recordError(`profiles/${userId}`, error);
    }

    try {
      await deleteAccount(userId);
      deleted.push(`account/${userId}`);
    } catch (error) {
      recordError(`account/${userId}`, error);
    }
  }

  // 6. Postgres: media rows + files, then contact messages.
  try {
    const media = await listOwnedMedia(userId);
    const mediaRoot = getMediaRoot();
    for (const asset of media) {
      try {
        await removeMediaAssetFiles(mediaRoot, asset.storageKey);
      } catch {
        // File may already be gone — continue with the row deletion.
      }
    }
    await getMediaPool().query(`DELETE FROM media_assets WHERE owner_user_id = $1`, [userId]);
    deleted.push(`media_assets (${media.length})`);
  } catch (error) {
    recordError(`media_assets`, error);
  }

  try {
    const { rowCount } = await getContactPool().query(`DELETE FROM contact_messages WHERE user_id = $1`, [userId]);
    deleted.push(`contact_messages (${rowCount ?? 0})`);
  } catch (error) {
    recordError(`contact_messages`, error);
  }

  return { deleted, anonymized, errors };
}

export async function deleteUserData(userId: string) {
  const deleted: string[] = [];
  const errors: string[] = [];

  if (getServerApiKey()) {
    // 1. Hard-delete documents the user owns.
    for (const collectionId of Object.keys(OWNED_COLLECTIONS)) {
      const docs = await listOwnedDocs(collectionId, userId);
      for (const doc of docs) {
        try {
          await deleteDoc(collectionId, doc.$id);
          deleted.push(`${collectionId}/${doc.$id}`);
        } catch (error) {
          errors.push(`${collectionId}/${doc.$id}: ${error instanceof Error ? error.message : "error"}`);
        }
      }
    }

    // 2. Delete rooms/projects the user owns (their messages are deleted with them).
    for (const collectionId of Object.keys(OWNER_ID_COLLECTIONS)) {
      const docs = await listOwnedMembershipDocs(collectionId, userId);
      for (const doc of docs) {
        try {
          await deleteDoc(collectionId, doc.$id);
          deleted.push(`${collectionId}/${doc.$id}`);
        } catch (error) {
          errors.push(`${collectionId}/${doc.$id}: ${error instanceof Error ? error.message : "error"}`);
        }
      }
    }

    // 3. Remove the user from shared memberships instead of deleting them.
    for (const [collectionId, attribute] of Object.entries(MEMBERSHIP_COLLECTIONS)) {
      const docs = await listMembershipDocs(collectionId, userId);
      for (const doc of docs) {
        try {
          const members = Array.isArray(doc[attribute]) ? (doc[attribute] as string[]) : [];
          const next = members.filter((memberId) => memberId !== userId);
          if (next.length !== members.length) {
            await updateDoc(collectionId, doc.$id, { [attribute]: next });
            deleted.push(`${collectionId}/${doc.$id} (removed membership)`);
          }
        } catch (error) {
          errors.push(`${collectionId}/${doc.$id}: ${error instanceof Error ? error.message : "error"}`);
        }
      }
    }

    // 4. Delete the profile document, then the Appwrite account itself.
    try {
      await deleteDoc(appwriteConfig.collections.profiles, userId);
      deleted.push(`profiles/${userId}`);
    } catch (error) {
      errors.push(`profiles/${userId}: ${error instanceof Error ? error.message : "error"}`);
    }

    try {
      await deleteAccount(userId);
      deleted.push(`account/${userId}`);
    } catch (error) {
      errors.push(`account/${userId}: ${error instanceof Error ? error.message : "error"}`);
    }
  }

  // 5. Postgres: delete media rows + files, then contact messages.
  try {
    const media = await listOwnedMedia(userId);
    const mediaRoot = getMediaRoot();
    for (const asset of media) {
      try {
        await removeMediaAssetFiles(mediaRoot, asset.storageKey);
      } catch {
        // File may already be gone — continue with the row deletion.
      }
    }
    await getMediaPool().query(`DELETE FROM media_assets WHERE owner_user_id = $1`, [userId]);
    deleted.push(`media_assets (${media.length})`);
  } catch (error) {
    errors.push(`media_assets: ${error instanceof Error ? error.message : "error"}`);
  }

  try {
    const { rowCount } = await getContactPool().query(`DELETE FROM contact_messages WHERE user_id = $1`, [userId]);
    deleted.push(`contact_messages (${rowCount ?? 0})`);
  } catch (error) {
    errors.push(`contact_messages: ${error instanceof Error ? error.message : "error"}`);
  }

  return { deleted, errors };
}
