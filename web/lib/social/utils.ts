import { AppBlock, AppCodeSnippet, AppComment, AppDesign, AppDocument, AppEvent, AppEventRsvp, AppFilm, AppNotification, AppPost, AppProfile, AppProject, AppRoom, AppSlideshow, AppTable, AppTask, AppThread, Strand, TimestampLike, AppBadge, BadgeCategory } from "@/lib/social/types";
import { appwriteConfig } from "@/lib/appwrite/config";

export const STRAND_OPTIONS: { value: Strand; label: string; description: string }[] = [
  { value: "N", label: "Nature", description: "Climate, conservation, regeneration" },
  { value: "E", label: "Economy", description: "Circular systems, jobs, access" },
  { value: "S", label: "Society", description: "Community, inclusion, justice" },
  { value: "W", label: "Wellbeing", description: "Health, safety, belonging" },
];

export const STRAND_LABELS: Record<Strand, string> = {
  N: "Nature",
  E: "Economy",
  S: "Society",
  W: "Wellbeing",
};

export function isStrand(value: unknown): value is Strand {
  return value === "N" || value === "E" || value === "S" || value === "W";
}

export function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function parseTagInput(value: string) {
  return uniqueStrings(
    value
      .split(",")
      .map((tag) => tag.replace(/^#/, "").trim().toLowerCase())
      .filter(Boolean),
  ).slice(0, 6);
}

export function buildSearchIndex(parts: Array<string | string[] | undefined>) {
  const flattened = parts.flatMap((part) => (Array.isArray(part) ? part : [part ?? ""]));
  return uniqueStrings(
    flattened
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((token) => token.length > 1),
  ).join(" ");
}

export function timestampToMillis(value: TimestampLike) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") {
    return value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1_000_000);
  }
  return 0;
}

function resolveDocumentTimestamp(data: Record<string, unknown>, key: "created_at" | "updated_at" | "earned_at") {
  const numericKey = `${key}_ms`;
  const systemKey = key === "created_at" ? "$createdAt" : "$updatedAt";

  if (typeof data[numericKey] === "number") return data[numericKey] as number;
  if (typeof data[key] === "number") return data[key] as number;
  if (typeof data[key] === "string") return data[key] as string;
  if (typeof data[systemKey] === "string") return data[systemKey] as string;

  return undefined;
}

export function buildAppwriteFileUrl(fileId: string, mode: "view" | "preview" = "view") {
  if (!fileId || !appwriteConfig.endpoint || !appwriteConfig.projectId || !appwriteConfig.mediaBucketId) {
    return "";
  }

  return `${appwriteConfig.endpoint}/storage/buckets/${appwriteConfig.mediaBucketId}/files/${fileId}/${mode}?project=${appwriteConfig.projectId}`;
}

export function buildMediaUrl(storageKey: string, variantFileName = "preview.webp") {
  if (!storageKey) return "";

  const safeStorageKey = storageKey
    .split("/")
    .filter(Boolean)
    .filter((segment) => segment !== "." && segment !== "..")
    .join("/");

  if (!safeStorageKey) return "";

  return `/media/${safeStorageKey}/${variantFileName}`.replace(/\/{2,}/g, "/");
}

export function formatRelativeTime(value: TimestampLike) {
  const ms = timestampToMillis(value);
  if (!ms) return "just now";

  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(ms);
}

export function getDisplayName(user: { name?: string | null; displayName?: string | null; email?: string | null }) {
  return user.name || user.displayName || user.email?.split("@")[0] || "Changemaker";
}

export function buildProfileSearchIndex(profile: {
  full_name: string;
  role?: string;
  headline?: string;
  bio?: string;
  location?: string;
  mentor_focus?: string;
  interests?: Strand[];
}) {
  return buildSearchIndex([
    profile.full_name,
    profile.role,
    profile.headline,
    profile.bio,
    profile.location,
    profile.mentor_focus,
    profile.interests?.map((value) => STRAND_LABELS[value]),
  ]);
}

export function buildPostSearchIndex(post: {
  title: string;
  body: string;
  author_name?: string;
  author_role?: string;
  tags?: string[];
  strand: Strand;
}) {
  return buildSearchIndex([
    post.title,
    post.body,
    post.author_name,
    post.author_role,
    post.tags,
    STRAND_LABELS[post.strand],
  ]);
}

export function buildRoomSearchIndex(room: {
  name: string;
  description: string;
  owner_name?: string;
  tags?: string[];
  strand: Strand;
}) {
  return buildSearchIndex([
    room.name,
    room.description,
    room.owner_name,
    room.tags,
    STRAND_LABELS[room.strand],
  ]);
}

export function normalizeProfile(id: string, data: Record<string, unknown>): AppProfile {
  const interests = Array.isArray(data.interests)
    ? data.interests.filter(isStrand)
    : [];

  const fullName =
    typeof data.full_name === "string"
      ? data.full_name
      : typeof data.name === "string"
        ? data.name
        : "Anonymous Changemaker";

  const avatarMediaStorageKey =
    typeof data.avatar_media_storage_key === "string" ? data.avatar_media_storage_key : "";
  const avatarMediaUrl =
    typeof data.avatar_media_url === "string"
      ? data.avatar_media_url
      : avatarMediaStorageKey
        ? buildMediaUrl(avatarMediaStorageKey)
        : "";
  const legacyAvatarUrl =
    typeof data.avatar_file_id === "string"
      ? buildAppwriteFileUrl(data.avatar_file_id, "view")
      : typeof data.avatar_url === "string"
        ? data.avatar_url
        : "";

  const privacyValue = typeof data.privacy === "string" && ["public", "followers", "private"].includes(data.privacy)
    ? data.privacy as "public" | "followers" | "private"
    : "public";

  return {
    id,
    full_name: fullName,
    role: typeof data.role === "string" ? data.role : "Community member",
    headline: typeof data.headline === "string" ? data.headline : "",
    bio: typeof data.bio === "string" ? data.bio : "",
    location: typeof data.location === "string" ? data.location : "",
    avatar_file_id: typeof data.avatar_file_id === "string" ? data.avatar_file_id : "",
    avatar_media_id: typeof data.avatar_media_id === "string" ? data.avatar_media_id : "",
    avatar_media_storage_key: avatarMediaStorageKey,
    avatar_media_url: avatarMediaUrl,
    avatar_url: avatarMediaUrl || legacyAvatarUrl,
    interests: interests.length ? interests : ["S"],
    saved_project_ids: Array.isArray(data.saved_project_ids)
      ? data.saved_project_ids.filter((v): v is string => typeof v === "string")
      : [],
    is_mentor: Boolean(data.is_mentor),
    mentor_focus: typeof data.mentor_focus === "string" ? data.mentor_focus : "",
    is_admin: Boolean(data.is_admin),
    privacy: privacyValue,
    theme: ["moss", "ocean", "sunset", "rose"].includes(String(data.theme))
      ? String(data.theme) as AppProfile["theme"]
      : "moss",
    email_notifications: Boolean(data.email_notifications),
    push_subscription: typeof data.push_subscription === "string" ? data.push_subscription : "",
    search_index:
      typeof data.search_index === "string"
        ? data.search_index
        : buildProfileSearchIndex({
            full_name: fullName,
            role: typeof data.role === "string" ? data.role : "",
            headline: typeof data.headline === "string" ? data.headline : "",
            bio: typeof data.bio === "string" ? data.bio : "",
            location: typeof data.location === "string" ? data.location : "",
            mentor_focus: typeof data.mentor_focus === "string" ? data.mentor_focus : "",
            interests: interests.length ? interests : ["S"],
          }),
    created_at: resolveDocumentTimestamp(data, "created_at"),
    updated_at: resolveDocumentTimestamp(data, "updated_at"),
  };
}

export function normalizePost(id: string, data: Record<string, unknown>): AppPost {
  const likes = Array.isArray(data.likes)
    ? data.likes.filter((value): value is string => typeof value === "string")
    : [];
  const tags = Array.isArray(data.tags)
    ? data.tags.filter((value): value is string => typeof value === "string")
    : [];
  const strand = isStrand(data.strand) ? data.strand : "S";
  const authorAvatarMediaStorageKey =
    typeof data.author_avatar_media_storage_key === "string"
      ? data.author_avatar_media_storage_key
      : "";
  const authorAvatarMediaUrl =
    typeof data.author_avatar_media_url === "string"
      ? data.author_avatar_media_url
      : authorAvatarMediaStorageKey
        ? buildMediaUrl(authorAvatarMediaStorageKey)
        : "";
  const legacyAuthorAvatarUrl =
    typeof data.author_avatar_file_id === "string"
      ? buildAppwriteFileUrl(data.author_avatar_file_id, "view")
      : typeof data.author_avatar_url === "string"
        ? data.author_avatar_url
        : "";
  const imageMediaStorageKey =
    typeof data.image_media_storage_key === "string" ? data.image_media_storage_key : "";
  const imageMediaUrl =
    typeof data.image_media_url === "string"
      ? data.image_media_url
      : imageMediaStorageKey
        ? buildMediaUrl(imageMediaStorageKey)
        : "";
  const legacyImageUrl =
    typeof data.image_file_id === "string"
      ? buildAppwriteFileUrl(data.image_file_id, "view")
      : typeof data.image_url === "string"
        ? data.image_url
        : "";

  const videoMediaStorageKey =
    typeof data.video_media_storage_key === "string" ? data.video_media_storage_key : "";

  return {
    id,
    title: typeof data.title === "string" ? data.title : "Untitled post",
    body: typeof data.body === "string" ? data.body : "",
    strand,
    author_id: typeof data.author_id === "string" ? data.author_id : "",
    author_name: typeof data.author_name === "string" ? data.author_name : "Changemaker",
    author_role: typeof data.author_role === "string" ? data.author_role : "Community member",
    author_avatar_file_id:
      typeof data.author_avatar_file_id === "string" ? data.author_avatar_file_id : "",
    author_avatar_media_id:
      typeof data.author_avatar_media_id === "string" ? data.author_avatar_media_id : "",
    author_avatar_media_storage_key: authorAvatarMediaStorageKey,
    author_avatar_media_url: authorAvatarMediaUrl,
    author_avatar_url: authorAvatarMediaUrl || legacyAuthorAvatarUrl,
    image_file_id: typeof data.image_file_id === "string" ? data.image_file_id : "",
    image_media_id: typeof data.image_media_id === "string" ? data.image_media_id : "",
    image_media_storage_key: imageMediaStorageKey,
    image_media_url: imageMediaUrl,
    image_url: imageMediaUrl || legacyImageUrl,
    video_url: typeof data.video_url === "string" ? data.video_url : "",
    is_poll: Boolean(data.is_poll),
    poll_question: typeof data.poll_question === "string" ? data.poll_question : "",
    poll_options: Array.isArray(data.poll_options)
      ? data.poll_options.filter((v): v is string => typeof v === "string")
      : [],
    poll_votes: typeof data.poll_votes === "object" && data.poll_votes !== null
      ? Object.fromEntries(
          Object.entries(data.poll_votes).map(([k, v]) => [
            k,
            Array.isArray(v) ? v.filter((vi): vi is string => typeof vi === "string") : [],
          ])
        )
      : {},
    video_file_id: typeof data.video_file_id === "string" ? data.video_file_id : "",
    video_media_id: typeof data.video_media_id === "string" ? data.video_media_id : "",
    video_media_storage_key: videoMediaStorageKey,
    likes,
    likes_count:
      typeof data.likes_count === "number" && Number.isFinite(data.likes_count)
        ? data.likes_count
        : likes.length,
    comments_count:
      typeof data.comments_count === "number" && Number.isFinite(data.comments_count)
        ? data.comments_count
        : 0,
    tags,
    search_index:
      typeof data.search_index === "string"
        ? data.search_index
        : buildPostSearchIndex({
            title: typeof data.title === "string" ? data.title : "",
            body: typeof data.body === "string" ? data.body : "",
            author_name: typeof data.author_name === "string" ? data.author_name : "",
            author_role: typeof data.author_role === "string" ? data.author_role : "",
            tags,
            strand,
          }),
    created_at: resolveDocumentTimestamp(data, "created_at"),
    updated_at: resolveDocumentTimestamp(data, "updated_at"),
  };
}

export function normalizeComment(id: string, data: Record<string, unknown>): AppComment {
  const authorAvatarMediaStorageKey =
    typeof data.author_avatar_media_storage_key === "string"
      ? data.author_avatar_media_storage_key
      : "";
  const authorAvatarMediaUrl =
    typeof data.author_avatar_media_url === "string"
      ? data.author_avatar_media_url
      : authorAvatarMediaStorageKey
        ? buildMediaUrl(authorAvatarMediaStorageKey)
        : "";
  const legacyAuthorAvatarUrl =
    typeof data.author_avatar_file_id === "string"
      ? buildAppwriteFileUrl(data.author_avatar_file_id, "view")
      : typeof data.author_avatar_url === "string"
        ? data.author_avatar_url
        : "";

  return {
    id,
    author_id: typeof data.author_id === "string" ? data.author_id : "",
    author_name: typeof data.author_name === "string" ? data.author_name : "Changemaker",
    author_avatar_file_id:
      typeof data.author_avatar_file_id === "string" ? data.author_avatar_file_id : "",
    author_avatar_media_id:
      typeof data.author_avatar_media_id === "string" ? data.author_avatar_media_id : "",
    author_avatar_media_storage_key: authorAvatarMediaStorageKey,
    author_avatar_media_url: authorAvatarMediaUrl,
    author_avatar_url: authorAvatarMediaUrl || legacyAuthorAvatarUrl,
    text: typeof data.text === "string" ? data.text : "",
    created_at: resolveDocumentTimestamp(data, "created_at"),
  };
}

export function normalizeRoom(id: string, data: Record<string, unknown>): AppRoom {
  const strand = isStrand(data.strand) ? data.strand : "S";
  const members = Array.isArray(data.members)
    ? data.members.filter((value): value is string => typeof value === "string")
    : [];
  const tags = Array.isArray(data.tags)
    ? data.tags.filter((value): value is string => typeof value === "string")
    : [];

  return {
    id,
    name: typeof data.name === "string" ? data.name : "Untitled room",
    description: typeof data.description === "string" ? data.description : "",
    strand,
    owner_id: typeof data.owner_id === "string" ? data.owner_id : "",
    owner_name: typeof data.owner_name === "string" ? data.owner_name : "Changemaker",
    members,
    member_count:
      typeof data.member_count === "number" && Number.isFinite(data.member_count)
        ? data.member_count
        : members.length,
    tags,
    last_message: typeof data.last_message === "string" ? data.last_message : "",
    search_index:
      typeof data.search_index === "string"
        ? data.search_index
        : buildRoomSearchIndex({
            name: typeof data.name === "string" ? data.name : "",
            description: typeof data.description === "string" ? data.description : "",
            owner_name: typeof data.owner_name === "string" ? data.owner_name : "",
            tags,
            strand,
          }),
    created_at: resolveDocumentTimestamp(data, "created_at"),
    updated_at: resolveDocumentTimestamp(data, "updated_at"),
  };
}

export function normalizeThread(id: string, data: Record<string, unknown>): AppThread {
  return {
    id,
    participants: Array.isArray(data.participants)
      ? data.participants.filter((value): value is string => typeof value === "string")
      : [],
    last_message: typeof data.last_message === "string" ? data.last_message : "",
    updated_at: resolveDocumentTimestamp(data, "updated_at"),
  };
}

export function normalizeNotification(id: string, data: Record<string, unknown>): AppNotification {
  const validTypes = ["like", "comment", "follow", "system", "bot", "poll_vote", "project_invite", "event_reminder"] as const;
  const type = validTypes.includes(data.type as typeof validTypes[number])
    ? (data.type as AppNotification["type"])
    : "system";

  return {
    id,
    type,
    actor_name: typeof data.actor_name === "string" ? data.actor_name : "Changers",
    actor_id: typeof data.actor_id === "string" ? data.actor_id : "",
    post_id: typeof data.post_id === "string" ? data.post_id : undefined,
    room_id: typeof data.room_id === "string" ? data.room_id : undefined,
    project_id: typeof data.project_id === "string" ? data.project_id : undefined,
    event_id: typeof data.event_id === "string" ? data.event_id : undefined,
    read: Boolean(data.read),
    message: typeof data.message === "string" ? data.message : undefined,
    created_at: resolveDocumentTimestamp(data, "created_at"),
  };
}

export function normalizeBlock(id: string, data: Record<string, unknown>): AppBlock {
  return {
    id,
    blocker_id: typeof data.blocker_id === "string" ? data.blocker_id : "",
    blocked_id: typeof data.blocked_id === "string" ? data.blocked_id : "",
    created_at: resolveDocumentTimestamp(data, "created_at"),
  };
}

export function normalizeProject(id: string, data: Record<string, unknown>): AppProject {
  const strand = isStrand(data.strand) ? data.strand : "S";
  const members = Array.isArray(data.members)
    ? data.members.filter((v): v is string => typeof v === "string")
    : [];
  const tags = Array.isArray(data.tags)
    ? data.tags.filter((v): v is string => typeof v === "string")
    : [];
  const statuses = ["active", "completed", "paused"] as const;
  const status = statuses.includes(data.status as typeof statuses[number])
    ? (data.status as AppProject["status"])
    : "active";

  return {
    id,
    name: typeof data.name === "string" ? data.name : "Untitled project",
    description: typeof data.description === "string" ? data.description : "",
    strand,
    owner_id: typeof data.owner_id === "string" ? data.owner_id : "",
    owner_name: typeof data.owner_name === "string" ? data.owner_name : "Changemaker",
    members,
    member_count: typeof data.member_count === "number" ? data.member_count : members.length,
    status,
    tags,
    search_index: typeof data.search_index === "string"
      ? data.search_index
      : buildSearchIndex([
          typeof data.name === "string" ? data.name : "",
          typeof data.description === "string" ? data.description : "",
          typeof data.owner_name === "string" ? data.owner_name : "",
          tags,
          STRAND_LABELS[strand],
        ]),
    created_at: resolveDocumentTimestamp(data, "created_at"),
    updated_at: resolveDocumentTimestamp(data, "updated_at"),
  };
}

export function normalizeTask(id: string, data: Record<string, unknown>): AppTask {
  const statuses = ["todo", "in-progress", "done"] as const;
  const priorities = ["low", "medium", "high"] as const;
  const status = statuses.includes(data.status as typeof statuses[number])
    ? (data.status as AppTask["status"])
    : "todo";
  const priority = priorities.includes(data.priority as typeof priorities[number])
    ? (data.priority as AppTask["priority"])
    : "medium";

  return {
    id,
    project_id: typeof data.project_id === "string" ? data.project_id : "",
    title: typeof data.title === "string" ? data.title : "Untitled task",
    description: typeof data.description === "string" ? data.description : "",
    status,
    assignee_id: typeof data.assignee_id === "string" ? data.assignee_id : "",
    assignee_name: typeof data.assignee_name === "string" ? data.assignee_name : "",
    priority,
    created_by: typeof data.created_by === "string" ? data.created_by : "",
    created_at: resolveDocumentTimestamp(data, "created_at"),
    updated_at: resolveDocumentTimestamp(data, "updated_at"),
  };
}

export function normalizeBadge(id: string, data: Record<string, unknown>): AppBadge {
  let metadata: Record<string, unknown> = {};
  if (typeof data.metadata === "string") {
    try {
      const parsed = JSON.parse(data.metadata);
      if (typeof parsed === "object" && parsed !== null) metadata = parsed;
    } catch {}
  }
  return {
    id,
    user_id: typeof data.user_id === "string" ? data.user_id : "",
    badge_id: typeof data.badge_id === "string" ? data.badge_id : "",
    badge_name: typeof data.badge_name === "string" ? data.badge_name : "",
    badge_description: typeof data.badge_description === "string" ? data.badge_description : "",
    badge_icon: typeof data.badge_icon === "string" ? data.badge_icon : "🏅",
    badge_category: typeof data.badge_category === "string" ? data.badge_category as BadgeCategory : "milestone",
    earned_at: resolveDocumentTimestamp(data, "earned_at"),
    metadata,
  };
}

export function normalizeEvent(id: string, data: Record<string, unknown>): AppEvent {
  const strand = isStrand(data.strand) ? data.strand : "S";
  const tags = Array.isArray(data.tags)
    ? data.tags.filter((v): v is string => typeof v === "string")
    : [];

  return {
    id,
    title: typeof data.title === "string" ? data.title : "Untitled event",
    description: typeof data.description === "string" ? data.description : "",
    strand,
    host_id: typeof data.host_id === "string" ? data.host_id : "",
    host_name: typeof data.host_name === "string" ? data.host_name : "Changemaker",
    date: typeof data.date === "string" ? data.date : "",
    time: typeof data.time === "string" ? data.time : "",
    location: typeof data.location === "string" ? data.location : "",
    is_online: Boolean(data.is_online),
    online_url: typeof data.online_url === "string" ? data.online_url : "",
    rsvp_count: typeof data.rsvp_count === "number" ? data.rsvp_count : 0,
    tags,
    search_index: typeof data.search_index === "string"
      ? data.search_index
      : buildSearchIndex([
          typeof data.title === "string" ? data.title : "",
          typeof data.description === "string" ? data.description : "",
          typeof data.host_name === "string" ? data.host_name : "",
          typeof data.location === "string" ? data.location : "",
          tags,
          STRAND_LABELS[strand],
        ]),
    created_at: resolveDocumentTimestamp(data, "created_at"),
    updated_at: resolveDocumentTimestamp(data, "updated_at"),
  };
}

export function normalizeDocument(id: string, data: Record<string, unknown>): AppDocument {
  return {
    id,
    user_id: typeof data.user_id === "string" ? data.user_id : "",
    title: typeof data.title === "string" ? data.title : "",
    body: typeof data.body === "string" ? data.body : "",
    word_count: typeof data.word_count === "number" ? data.word_count : 0,
    created_at: resolveDocumentTimestamp(data, "created_at"),
    updated_at: resolveDocumentTimestamp(data, "updated_at"),
  };
}

export function normalizeSlideshow(id: string, data: Record<string, unknown>): AppSlideshow {
  let slides: AppSlideshow["slides"] = [];
  if (typeof data.slides_json === "string") {
    try {
      const parsed = JSON.parse(data.slides_json);
      if (Array.isArray(parsed)) slides = parsed;
    } catch {}
  }
  return {
    id,
    user_id: typeof data.user_id === "string" ? data.user_id : "",
    title: typeof data.title === "string" ? data.title : "",
    template_id: typeof data.template_id === "string" ? data.template_id : "",
    slides,
    slide_count: typeof data.slide_count === "number" ? data.slide_count : slides.length,
    created_at: resolveDocumentTimestamp(data, "created_at"),
    updated_at: resolveDocumentTimestamp(data, "updated_at"),
  };
}

export function normalizeTable(id: string, data: Record<string, unknown>): AppTable {
  let data_grid: string[][] = [];
  if (typeof data.data_json === "string") {
    try {
      const parsed = JSON.parse(data.data_json);
      if (Array.isArray(parsed)) data_grid = parsed;
    } catch {}
  }
  return {
    id,
    user_id: typeof data.user_id === "string" ? data.user_id : "",
    title: typeof data.title === "string" ? data.title : "",
    rows: typeof data.rows === "number" ? data.rows : 0,
    cols: typeof data.cols === "number" ? data.cols : 0,
    data: data_grid,
    created_at: resolveDocumentTimestamp(data, "created_at"),
    updated_at: resolveDocumentTimestamp(data, "updated_at"),
  };
}

export function normalizeCodeSnippet(id: string, data: Record<string, unknown>): AppCodeSnippet {
  return {
    id,
    user_id: typeof data.user_id === "string" ? data.user_id : "",
    title: typeof data.title === "string" ? data.title : "",
    language: typeof data.language === "string" ? data.language : "plaintext",
    code: typeof data.code === "string" ? data.code : "",
    created_at: resolveDocumentTimestamp(data, "created_at"),
    updated_at: resolveDocumentTimestamp(data, "updated_at"),
  };
}

export function normalizeDesign(id: string, data: Record<string, unknown>): AppDesign {
  let elements: AppDesign["elements"] = [];
  if (typeof data.elements_json === "string") {
    try {
      const parsed = JSON.parse(data.elements_json);
      if (Array.isArray(parsed)) elements = parsed;
    } catch {}
  }
  return {
    id,
    user_id: typeof data.user_id === "string" ? data.user_id : "",
    title: typeof data.title === "string" ? data.title : "",
    elements,
    canvas_width: typeof data.canvas_width === "number" ? data.canvas_width : 800,
    canvas_height: typeof data.canvas_height === "number" ? data.canvas_height : 600,
    created_at: resolveDocumentTimestamp(data, "created_at"),
    updated_at: resolveDocumentTimestamp(data, "updated_at"),
  };
}

export function normalizeFilm(id: string, data: Record<string, unknown>): AppFilm {
  let scenes: AppFilm["scenes"] = [];
  if (typeof data.scenes_json === "string") {
    try {
      const parsed = JSON.parse(data.scenes_json);
      if (Array.isArray(parsed)) scenes = parsed;
    } catch {}
  }
  return {
    id,
    user_id: typeof data.user_id === "string" ? data.user_id : "",
    title: typeof data.title === "string" ? data.title : "",
    scenes,
    scene_count: typeof data.scene_count === "number" ? data.scene_count : scenes.length,
    created_at: resolveDocumentTimestamp(data, "created_at"),
    updated_at: resolveDocumentTimestamp(data, "updated_at"),
  };
}

export function normalizeEventRsvp(id: string, data: Record<string, unknown>): AppEventRsvp {
  const statuses = ["going", "interested", "not_going"] as const;
  const status = statuses.includes(data.status as typeof statuses[number])
    ? (data.status as AppEventRsvp["status"])
    : "interested";

  return {
    id,
    event_id: typeof data.event_id === "string" ? data.event_id : "",
    user_id: typeof data.user_id === "string" ? data.user_id : "",
    user_name: typeof data.user_name === "string" ? data.user_name : "Changemaker",
    status,
    created_at: resolveDocumentTimestamp(data, "created_at"),
  };
}
