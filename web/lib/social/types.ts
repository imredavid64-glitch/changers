export type TimestampLike =
  | { toMillis?: () => number; seconds?: number; nanoseconds?: number }
  | Date
  | number
  | string
  | null
  | undefined;

export type Strand = "N" | "E" | "S" | "W";

export interface AppProfile {
  id: string;
  full_name: string;
  role: string;
  headline: string;
  bio: string;
  location: string;
  avatar_file_id: string;
  avatar_media_id: string;
  avatar_media_storage_key: string;
  avatar_media_url: string;
  avatar_url: string;
  interests: Strand[];
  is_mentor: boolean;
  mentor_focus: string;
  is_admin: boolean;
  privacy: "public" | "followers" | "private";
  search_index: string;
  created_at?: TimestampLike;
  updated_at?: TimestampLike;
}

export interface AppPost {
  id: string;
  title: string;
  body: string;
  strand: Strand;
  author_id: string;
  author_name: string;
  author_role: string;
  author_avatar_file_id: string;
  author_avatar_media_id: string;
  author_avatar_media_storage_key: string;
  author_avatar_media_url: string;
  author_avatar_url: string;
  image_file_id: string;
  image_media_id: string;
  image_media_storage_key: string;
  image_media_url: string;
  image_url: string;
  video_url: string;
  is_poll: boolean;
  poll_question: string;
  poll_options: string[];
  poll_votes: Record<string, string[]>;
  video_file_id: string;
  video_media_id: string;
  video_media_storage_key: string;
  likes: string[];
  likes_count: number;
  comments_count: number;
  tags: string[];
  search_index: string;
  created_at?: TimestampLike;
  updated_at?: TimestampLike;
}

export interface AppComment {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar_file_id: string;
  author_avatar_media_id: string;
  author_avatar_media_storage_key: string;
  author_avatar_media_url: string;
  author_avatar_url: string;
  text: string;
  created_at?: TimestampLike;
}

export interface AppRoom {
  id: string;
  name: string;
  description: string;
  strand: Strand;
  owner_id: string;
  owner_name: string;
  members: string[];
  member_count: number;
  tags: string[];
  last_message: string;
  search_index: string;
  created_at?: TimestampLike;
  updated_at?: TimestampLike;
}

export interface AppThread {
  id: string;
  participants: string[];
  last_message: string;
  updated_at?: TimestampLike;
}

export interface AppNotification {
  id: string;
  type: "like" | "comment" | "follow" | "system" | "bot" | "poll_vote" | "project_invite" | "event_reminder";
  actor_name: string;
  actor_id: string;
  post_id?: string;
  room_id?: string;
  project_id?: string;
  event_id?: string;
  read: boolean;
  message?: string;
  created_at?: TimestampLike;
}

export interface AppBlock {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at?: TimestampLike;
}

export interface AppPrivacySettings {
  id: string;
  user_id: string;
  profile_visibility: "public" | "followers" | "private";
  posts_visibility: "public" | "followers" | "private";
  dm_permission: "everyone" | "followers" | "none";
  show_saved_posts: boolean;
  created_at?: TimestampLike;
  updated_at?: TimestampLike;
}

export interface AppProject {
  id: string;
  name: string;
  description: string;
  strand: Strand;
  owner_id: string;
  owner_name: string;
  members: string[];
  member_count: number;
  status: "active" | "completed" | "paused";
  tags: string[];
  search_index: string;
  created_at?: TimestampLike;
  updated_at?: TimestampLike;
}

export interface AppProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: "owner" | "collaborator" | "viewer";
  joined_at?: TimestampLike;
}

export interface AppEvent {
  id: string;
  title: string;
  description: string;
  strand: Strand;
  host_id: string;
  host_name: string;
  date: string;
  time: string;
  location: string;
  is_online: boolean;
  online_url: string;
  rsvp_count: number;
  tags: string[];
  search_index: string;
  created_at?: TimestampLike;
  updated_at?: TimestampLike;
}

export interface AppEventRsvp {
  id: string;
  event_id: string;
  user_id: string;
  user_name: string;
  status: "going" | "interested" | "not_going";
  created_at?: TimestampLike;
}
