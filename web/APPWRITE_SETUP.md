# Appwrite Cloud Setup For Bridge Web

This website expects **Appwrite Cloud** with:

- Auth provider: `Email / Password`
- Database ID: `bridge`
- Storage bucket ID: `bridge-media`
- Document security: `Enabled` on every collection
- Collection create permission: `Users`

Uploaded media now uses Postgres plus local disk, not the Appwrite storage bucket. Keep the bucket around only if you still need to migrate legacy files.

## 1. Create the project

1. Create an Appwrite project.
2. Add a **Web Platform** for every website origin you will use.
3. Add at least:
   - `http://localhost:3000`
   - your production website URL, for example `https://your-domain.com`
4. In **Auth**, enable `Email / Password`.

## 2. Add website environment variables

Put these in `/Users/imredavid/Documents/Changers/web/.env.local`:

```bash
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=YOUR_PROJECT_ID
NEXT_PUBLIC_APPWRITE_DATABASE_ID=bridge
NEXT_PUBLIC_APPWRITE_MEDIA_BUCKET_ID=bridge-media
DATABASE_URL=postgresql://bridge:bridge@127.0.0.1:5432/bridge
MEDIA_ROOT=/srv/bridge/media
MEDIA_PUBLIC_BASE_URL=https://your-domain.com

NEXT_PUBLIC_APPWRITE_COLLECTION_PROFILES=profiles
NEXT_PUBLIC_APPWRITE_COLLECTION_POSTS=posts
NEXT_PUBLIC_APPWRITE_COLLECTION_COMMENTS=comments
NEXT_PUBLIC_APPWRITE_COLLECTION_NOTIFICATIONS=notifications
NEXT_PUBLIC_APPWRITE_COLLECTION_FOLLOWS=follows
NEXT_PUBLIC_APPWRITE_COLLECTION_SAVED_POSTS=saved-posts
NEXT_PUBLIC_APPWRITE_COLLECTION_ROOMS=rooms
NEXT_PUBLIC_APPWRITE_COLLECTION_ROOM_MESSAGES=room-messages
NEXT_PUBLIC_APPWRITE_COLLECTION_THREADS=threads
NEXT_PUBLIC_APPWRITE_COLLECTION_THREAD_MESSAGES=thread-messages
```

## 3. Create the storage bucket

Create bucket `bridge-media`:

- File security: `Enabled`
- Create permission: `Users`
- Read/update/delete permissions: leave document-level access in place so the app can set per-file permissions

## 4. Create collections

Create these collections in database `bridge`.

### `profiles`

Attributes:

- `user_id` string
- `full_name` string
- `role` string
- `headline` string
- `bio` string
- `location` string
- `avatar_file_id` string
- `avatar_media_id` string
- `avatar_media_storage_key` string
- `avatar_media_url` string
- `interests` string[]
- `is_mentor` boolean
- `mentor_focus` string
- `search_index` string
- `created_at_ms` integer
- `updated_at_ms` integer

Indexes:

- `profiles_is_mentor` on `is_mentor`

### `posts`

Attributes:

- `title` string
- `body` string
- `strand` string
- `tags` string[]
- `search_index` string
- `image_file_id` string
- `image_media_id` string
- `image_media_storage_key` string
- `image_media_url` string
- `author_id` string
- `author_name` string
- `author_role` string
- `author_avatar_file_id` string
- `author_avatar_media_id` string
- `author_avatar_media_storage_key` string
- `author_avatar_media_url` string
- `likes` string[]
- `likes_count` integer
- `comments_count` integer
- `created_at_ms` integer
- `updated_at_ms` integer

Indexes:

- `posts_created_at_ms` on `created_at_ms` desc
- `posts_author_created` on `author_id` asc, `created_at_ms` desc

### `comments`

Attributes:

- `post_id` string
- `author_id` string
- `author_name` string
- `author_avatar_file_id` string
- `author_avatar_media_id` string
- `author_avatar_media_storage_key` string
- `author_avatar_media_url` string
- `text` string
- `created_at_ms` integer

Indexes:

- `comments_post_created` on `post_id` asc, `created_at_ms` asc

### `notifications`

Attributes:

- `user_id` string
- `type` string
- `actor_name` string
- `actor_id` string
- `post_id` string
- `room_id` string
- `read` boolean
- `message` string
- `created_at_ms` integer

Indexes:

- `notifications_user_created` on `user_id` asc, `created_at_ms` desc

### `follows`

Attributes:

- `follower_id` string
- `followee_id` string
- `created_at_ms` integer

Indexes:

- `follows_follower` on `follower_id`
- `follows_followee` on `followee_id`

Document ID rule:

- use `${follower_id}_${followee_id}`

### `saved-posts`

Attributes:

- `user_id` string
- `post_id` string
- `author_id` string
- `strand` string
- `created_at_ms` integer

Indexes:

- `saved_posts_user_created` on `user_id` asc, `created_at_ms` desc
- `saved_posts_user_post` on `user_id` asc, `post_id` asc

### `rooms`

Attributes:

- `name` string
- `description` string
- `strand` string
- `owner_id` string
- `owner_name` string
- `members` string[]
- `member_count` integer
- `tags` string[]
- `last_message` string
- `search_index` string
- `created_at_ms` integer
- `updated_at_ms` integer

Indexes:

- `rooms_updated_at_ms` on `updated_at_ms` desc

### `room-messages`

Attributes:

- `room_id` string
- `author_id` string
- `author_name` string
- `text` string
- `created_at_ms` integer

Indexes:

- `room_messages_room_created` on `room_id` asc, `created_at_ms` asc

### `threads`

Attributes:

- `participants` string[]
- `last_message` string
- `created_at_ms` integer
- `updated_at_ms` integer

Indexes:

- `threads_updated_at_ms` on `updated_at_ms` desc

Document ID rule:

- use `${sorted_user_id_a}_${sorted_user_id_b}`

### `thread-messages`

Attributes:

- `thread_id` string
- `sender_id` string
- `sender_name` string
- `text` string
- `created_at_ms` integer

Indexes:

- `thread_messages_thread_created` on `thread_id` asc, `created_at_ms` asc

## 5. Permissions model this website expects

The website sets document permissions from the client. Leave create access at the collection level as `Users`, and let the app assign document permissions:

- `profiles`: public read, owner update/delete
- `posts`: public read, authenticated update, owner delete
- `comments`: public read, author update/delete
- `notifications`: only the target user can read/update/delete
- `follows`: public read, owner update/delete
- `saved-posts`: only the owner can read/update/delete
- `rooms`: public read, authenticated update, owner delete
- `room-messages`: public read, author update/delete
- `threads`: only participants can read/update/delete
- `thread-messages`: only participants can read; sender keeps write control

## 6. Final website checks

After setup:

```bash
cd /Users/imredavid/Documents/Changers/web
npm install
npm run dev
```

Then verify:

1. Sign up creates an Appwrite account and profile.
2. Feed posts load and publish.
3. Comments, likes, and saves work.
4. Rooms and direct messages work end to end.
5. Images upload and render from Appwrite Storage.
