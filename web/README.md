# Bridge - Changemaker Social Platform

Bridge is a collaboration-first social platform for changemakers to share ideas,
launch projects, and track impact. This app is built with Next.js. Appwrite Cloud
currently handles auth, social records, permissions, and realtime updates, while
Postgres plus local disk handle uploaded website media.

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Add environment variables:

```bash
cp .env.example .env.local
```

3. Run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Dell PC Deployment

From the repository root:

```bash
cp .env.dell.example .env.dell
docker compose --env-file .env.dell up -d --build
```

The full Dell PC guide is in [DELL_PC_SETUP.md](/Users/imredavid/Documents/Changers/DELL_PC_SETUP.md).

## Appwrite Setup

Follow the detailed checklist in [APPWRITE_SETUP.md](/Users/imredavid/Documents/Changers/web/APPWRITE_SETUP.md).

At minimum:

1. Create an Appwrite project.
2. Add your website as an Appwrite Web Platform.
3. Enable Email/Password auth.
4. Create the `bridge` database and the `bridge-media` bucket.
5. Create the collections, attributes, indexes, and create permissions listed in `APPWRITE_SETUP.md`.
6. Copy your Appwrite website variables into `.env.local`:

```
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=...
NEXT_PUBLIC_APPWRITE_DATABASE_ID=bridge
NEXT_PUBLIC_APPWRITE_MEDIA_BUCKET_ID=bridge-media
DATABASE_URL=postgresql://bridge:bridge@127.0.0.1:5432/bridge
MEDIA_ROOT=/srv/bridge/media
MEDIA_PUBLIC_BASE_URL=https://your-domain.com
```

## Security Notes

- The website now relies on Appwrite document permissions for core records and Postgres for media metadata.
- Collection create access and document security must match the setup guide.
- Input validation uses Zod in the client flows.
- HTTP security headers are configured in `next.config.ts`.
- Uploaded images are normalized, stripped of EXIF, and served from `/media/*`.

## Vercel

Do not deploy this exact local-disk media stack to Vercel as production. Vercel functions do not provide persistent local disk for uploaded images. Use the Dell PC Docker stack for v1, or move media to S3/MinIO/object storage before using Vercel for production.

## Cross-Platform Clients

- `mobile/` is the Expo app for iPhone and Android.
- `desktop/` is the Electron shell for macOS, Windows, and Linux, designed to point at the live Vercel site.
