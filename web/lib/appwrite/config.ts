export const appwriteConfig = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT?.replace(/\/$/, "") || "",
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "",
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "changers",
  mediaBucketId: process.env.NEXT_PUBLIC_APPWRITE_MEDIA_BUCKET_ID || "changers-media",
  collections: {
    profiles: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_PROFILES || "profiles",
    posts: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_POSTS || "posts",
    comments: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_COMMENTS || "comments",
    notifications:
      process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_NOTIFICATIONS || "notifications",
    follows: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_FOLLOWS || "follows",
    savedPosts: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_SAVED_POSTS || "saved-posts",
    rooms: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ROOMS || "rooms",
    roomMessages:
      process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ROOM_MESSAGES || "room-messages",
    threads: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_THREADS || "threads",
    threadMessages:
      process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_THREAD_MESSAGES || "thread-messages",
    blocks: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_BLOCKS || "blocks",
    projects: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_PROJECTS || "projects",
    tasks: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_TASKS || "tasks",
    badges: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_BADGES || "badges",
    events: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_EVENTS || "events",
    eventRsvps: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_EVENT_RSVPS || "event-rsvps",
    documents: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_DOCUMENTS || "documents",
    slideshows: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_SLIDESHOWS || "slideshows",
    tables: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_TABLES || "tables",
    codeSnippets: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_CODE_SNIPPETS || "code-snippets",
    designs: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_DESIGNS || "designs",
    films: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_FILMS || "films",
  },
};

export const appwriteEnabled = Boolean(
  appwriteConfig.endpoint && appwriteConfig.projectId && appwriteConfig.databaseId,
);
