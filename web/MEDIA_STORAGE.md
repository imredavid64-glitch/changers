# Bridge Media Storage

This project now stores uploaded image bytes on disk and keeps media metadata in Postgres.

## Runtime layout

- `MEDIA_ROOT/public/avatars` for avatar assets
- `MEDIA_ROOT/public/posts` for post images
- `MEDIA_ROOT/tmp` for short-lived staging data

Recommended Dell PC settings:

- Set `MEDIA_ROOT=/srv/bridge/media`
- Set `DATABASE_URL=postgresql://...`
- Set `MEDIA_PUBLIC_BASE_URL=https://your-domain.com` if you want absolute URLs in the API response
- Keep the Dell PC awake, or at least disable sleep while the bridge stack is serving users

## Upload flow

1. The browser requests an Appwrite JWT from the signed-in session.
2. The client sends the JWT and file to `POST /api/media/upload`.
3. The server verifies the JWT, checks free disk space, validates the image, writes normalized variants, and inserts the `media_assets` row.
4. The response returns `mediaId`, `storageKey`, and public URLs for the image variants.

## Delete flow

`DELETE /api/media/:id` soft-deletes the database row first and then removes the on-disk files.

## Migration

Run `npm run media:migrate` from `web/` after setting:

- `APPWRITE_API_KEY`
- `DATABASE_URL`
- `MEDIA_ROOT`

The migration script is intentionally one-way: it copies legacy Appwrite images into the new folder tree and rewrites profile records to the new media fields.

