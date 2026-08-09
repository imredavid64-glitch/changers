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
  saved_project_ids: string[];
  is_mentor: boolean;
  mentor_focus: string;
  is_admin: boolean;
  privacy: "public" | "followers" | "private";
  theme: "moss" | "ocean" | "sunset" | "rose";
  email_notifications?: boolean;
  impact_score?: number;
  strand_counts?: Partial<Record<Strand, number>>;
  push_subscription?: string;
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

export type TaskStatus = "todo" | "in-progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface AppTask {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignee_id: string;
  assignee_name: string;
  priority: TaskPriority;
  created_by: string;
  created_at?: TimestampLike;
  updated_at?: TimestampLike;
}

export type BadgeCategory = "milestone" | "social" | "creation" | "impact" | "streak" | "special";

export interface AppBadge {
  id: string;
  user_id: string;
  badge_id: string;
  badge_name: string;
  badge_description: string;
  badge_icon: string;
  badge_category: BadgeCategory;
  earned_at?: TimestampLike;
  metadata?: Record<string, unknown>;
}

export interface UserStats {
  postsCount: number;
  projectsCount: number;
  documentsCount: number;
  slideshowsCount: number;
  followersCount: number;
  followingCount: number;
  likesReceived: number;
  commentsReceived: number;
  daysSinceJoin: number;
  currentStreak: number;
  longestStreak: number;
  tasksCompleted: number;
  eventsHosted: number;
  eventsAttended: number;
  impactScore: number;
  strandCounts: Partial<Record<Strand, number>>;
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  condition: (profile: AppProfile, stats: UserStats) => boolean;
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

export interface AppDocument {
  id: string;
  user_id: string;
  title: string;
  body: string;
  word_count: number;
  created_at?: TimestampLike;
  updated_at?: TimestampLike;
}

export interface AppSlideshow {
  id: string;
  user_id: string;
  title: string;
  template_id: string;
  slides: { layout: string; heading: string; body: string }[];
  slide_count: number;
  created_at?: TimestampLike;
  updated_at?: TimestampLike;
}

export interface AppTable {
  id: string;
  user_id: string;
  title: string;
  rows: number;
  cols: number;
  data: string[][];
  created_at?: TimestampLike;
  updated_at?: TimestampLike;
}

export interface AppCodeSnippet {
  id: string;
  user_id: string;
  title: string;
  language: string;
  code: string;
  created_at?: TimestampLike;
  updated_at?: TimestampLike;
}

export interface AppDesign {
  id: string;
  user_id: string;
  title: string;
  elements: DesignElement[];
  canvas_width: number;
  canvas_height: number;
  created_at?: TimestampLike;
  updated_at?: TimestampLike;
}

export interface DesignElement {
  id: string;
  type: "text" | "rect" | "circle" | "line";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  content: string;
  font_size: number;
}

export interface AppFilm {
  id: string;
  user_id: string;
  title: string;
  scenes: FilmScene[];
  scene_count: number;
  created_at?: TimestampLike;
  updated_at?: TimestampLike;
}

export interface FilmScene {
  id: string;
  number: number;
  setting: string;
  description: string;
  dialogue: string;
  shot_type: "wide" | "medium" | "close-up" | "pov" | "aerial";
  duration_secs: number;
}

export interface AppEventRsvp {
  id: string;
  event_id: string;
  user_id: string;
  user_name: string;
  status: "going" | "interested" | "not_going";
  created_at?: TimestampLike;
}
