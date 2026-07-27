# Dell PC Production Setup

This setup runs the full Changers stack on the Dell PC with:
- **Appwrite** (self-hosted via Docker on port 8080) — database, auth, storage
- **Postgres** (sidecar for media metadata)
- **Next.js web app** (served via Docker)
- **Caddy** (public reverse proxy with automatic TLS)

## 1. Install the base tools

Install these on the Dell PC:

- Docker Desktop
- GitHub Desktop or Git CLI
- Node.js 22 LTS (only needed to run the setup script)

Docker Desktop settings:

- Start Docker Desktop when you sign in
- Use Docker Compose V2

## 2. Keep the PC awake

Open Windows Terminal as Administrator and run:

```powershell
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /change monitor-timeout-ac 15
```

Also check the BIOS/UEFI setting for power recovery. If the setting exists, set it to power the PC back on after AC power loss.

## 3. Start Appwrite (Docker-local)

From the project root:

```bash
docker compose -f appwrite/docker-compose.yml up -d
```

Wait about a minute for MariaDB and Redis health checks to pass. Verify:

```bash
curl http://localhost:8080/v1/health
```

You should get a JSON response with `{"status":"pass"}`.

Open the Appwrite Console:

```text
http://localhost:8080/console
```

## 4. Run the setup script

Install dependencies and run the automated setup:

```bash
npm install
node scripts/local-setup.mjs
```

This script will:

1. Wait for Appwrite to be ready.
2. Create the admin account (`admin@changers.app` / `changeme123`).
3. Create the "Changers" project.
4. Create a full-scope API key.
5. Update `web/.env.local` with the project ID.
6. Create the database, media bucket, and all 16 collections with their schemas and indexes.

After it finishes, note the **Appwrite API Key** printed at the end (it is shown only once).

> **Troubleshooting**: If Windows Defender or real-time scanning blocks `node scripts/local-setup.mjs`, add an exclusion for the repo folder in Windows Security > Virus & threat protection > Manage settings > Exclusions.

## 5. Prepare the production env file

```bash
cp .env.dell.example .env.dell
```

Edit `.env.dell`:

- Set `POSTGRES_PASSWORD` to a strong random password.
- Set `HOST_MEDIA_ROOT` to a persistent folder, e.g. `D:/changers/media`.
- Set `HOST_POSTGRES_DATA` to a persistent folder, e.g. `D:/changers/postgres`.
- Set `NEXT_PUBLIC_APPWRITE_PROJECT_ID` to the project ID from the setup script output.
- Set `NEXT_PUBLIC_APPWRITE_ENDPOINT` to `http://YOUR_DELL_LAN_IP:8080/v1` (use the actual LAN IP so the web container can reach Appwrite — `localhost` inside the container won't work).
- For local testing on the Dell PC itself, keep `CHANGERS_DOMAIN=:80`.
- For a real domain, set `CHANGERS_DOMAIN=your-domain.com`.

> **Finding your LAN IP**: Run `ipconfig` in PowerShell and look for the IPv4 Address of your active adapter (e.g. `192.168.1.100`). This is the address the web container uses to reach Appwrite on the host.

## 6. Start the production stack

```bash
docker compose --env-file .env.dell up -d --build
```

Then open:

```text
http://localhost
```

If you set a real domain, point that domain to the Dell PC and open `https://your-domain.com`.

## 7. Create the media table

The app creates the `media_assets` table automatically on first upload. You can also create it manually:

```bash
docker compose --env-file .env.dell exec -T postgres psql -U changers -d changers < web/db/migrations/001_media_assets.sql
```

## 8. Global access

- **Recommended**: Cloudflare Tunnel pointing to `http://caddy:80` or `http://localhost:80`.
- **Direct**: router port forwarding for ports `80` and `443` to the Dell PC, plus Caddy using your real domain.

Cloudflare Tunnel is safer for a home-hosted PC because you do not have to expose router ports directly.

## 9. Backups

Create a local backup folder:

```bash
mkdir -p backups
```

Back up Postgres:

```bash
docker compose --env-file .env.dell exec -T postgres pg_dump -U changers -d changers > backups/changers-postgres.sql
```

Back up media:

```bash
docker run --rm -v "$PWD/.changers-media:/media" -v "$PWD/backups:/backups" alpine tar -czf /backups/changers-media.tgz -C /media .
```

Restore Postgres:

```bash
docker compose --env-file .env.dell exec -T postgres psql -U changers -d changers < backups/changers-postgres.sql
```

Restore media:

```bash
docker run --rm -v "$PWD/.changers-media:/media" -v "$PWD/backups:/backups" alpine sh -c "rm -rf /media/* && tar -xzf /backups/changers-media.tgz -C /media"
```

## 10. Vercel note

This stack is designed for the Dell PC, not Vercel, because Vercel does not provide persistent local disk for uploaded images. A Vercel deployment becomes viable when media moves to S3, MinIO, or another object store that Vercel can reach.
