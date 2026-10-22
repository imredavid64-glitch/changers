# Changers Platform — Full Execution Plan

**Target Launch:** December 2024  
**Team:** 1 developer + AI agents  
**Architecture:** Hybrid (VPS production + Dell PC staging)  
**Stack:** Cloudflare + Hetzner VPS + Coolify + Appwrite + Frontend

---

## 1. Infrastructure Costs (Recurring)

| Item | Provider | Spec | Cost | Frequency |
|------|----------|------|------|-----------|
| Domain | Cloudflare | `changers.dev` | ~$12 | Yearly |
| VPS (Production) | Hetzner | CX22: 2 vCPU, 4GB RAM, 40GB NVMe | €4.15 | Monthly |
| Backups | Hetzner | Automated daily snapshots | ~€1.50 | Monthly |
| DNS/CDN/Tunnel/DDoS | Cloudflare | Free tier | $0 | — |
| **Infra Total** | | | **~$6-8/mo** | **~$70-100/yr** |

## 1b. App Store Costs

| Item | Platform | Cost | Frequency |
|------|----------|------|-----------|
| Developer Account | Google Play | $25 | One-time |
| Developer Program | Apple App Store | $99 | Yearly |
| **Store Total** | | **$124** | **Year 1: $124, Year 2+: $99** |

## 1c. Combined First-Year Cost

| Category | Cost |
|----------|------|
| Infrastructure | ~$70-100 |
| App Stores | $124 |
| **Grand Total (Year 1)** | **~$194-224** |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ DNS         │  │ CDN/Cache   │  │ Tunnel (cloudflared)    │  │
│  │ changers.dev│  │ Static assets│  │ → VPS:8000 (Coolify)    │  │
│  │ api.changers│  │ DDoS/WAF    │  │ → Dell PC:8000 (Staging)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  HETZNER VPS  │    │   DELL PC     │    │   YOUR LAPTOP │
│  (Production) │    │  (Staging)    │    │  (Development)│
│               │    │               │    │               │
│ Ubuntu 24.04  │    │ Ubuntu 24.04  │    │ VS Code       │
│ Coolify       │    │ Coolify       │    │ Git           │
│ Appwrite      │    │ Appwrite      │    │ SSH to VPS    │
│               │    │               │    │               │
│ 2 vCPU        │    │ 8-16GB RAM    │    │               │
│ 4GB RAM       │    │ 500GB HDD     │    │               │
│ 40GB NVMe     │    │ Hyper-V VM    │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
```

---

## 3. Services Running on Coolify (Both VPS & Dell PC)

| Service | Purpose | Production Config | Staging Config |
|---------|---------|-------------------|----------------|
| **Appwrite** | Auth, Database, Storage, Functions, Realtime | 1 instance, 2GB RAM | 1 instance, 1GB RAM |
| **PostgreSQL** | Relational data (if needed beyond Appwrite) | 1 primary, 1 replica | Single instance |
| **Redis/Valkey** | Caching, sessions, rate limits, queues | 1 instance, 512MB | 1 instance, 256MB |
| **MinIO** | S3-compatible storage (backup target) | 4 nodes, 10GB each | Single node, 5GB |
| **Meilisearch** | Full-text search | 1 instance, 1GB | 1 instance, 512MB |
| **Nginx/Traefik** | Reverse proxy, SSL (Coolify managed) | Auto | Auto |
| **Uptime Kuma** | Monitoring/alerting | Enabled | Enabled |

---

## 4. Appwrite Configuration (Production)

### Auth
- Email/Password + OAuth (GitHub, Google, Apple)
- MFA (TOTP)
- Session management (JWT + cookies)
- Password reset flow

### Database (Collections)
| Collection | Attributes | Indexes | Permissions |
|------------|------------|---------|-------------|
| `users` | name, username, bio, avatar_id, created_at | username (unique), email (unique) | Read: any, Write: owner |
| `posts` | user_id, content, media_ids[], hashtags[], created_at | user_id, created_at, hashtags | Read: public, Write: owner |
| `follows` | follower_id, following_id, created_at | follower_id, following_id (unique composite) | Read: any, Write: owner |
| `notifications` | user_id, type, payload, read_at, created_at | user_id, read_at | Read: owner, Write: server |
| `conversations` | participant_ids[], last_message_at | participant_ids | Read: participants |
| `messages` | conversation_id, user_id, content, created_at | conversation_id, created_at | Read: participants |

### Storage (Buckets)
| Bucket | Purpose | Public | Max Size |
|--------|---------|--------|----------|
| `avatars` | User profile images | Yes | 5MB |
| `posts` | Post media (images, videos) | Yes | 50MB |
| `attachments` | DM attachments | No | 25MB |

### Functions (Custom Logic)
| Function | Trigger | Purpose |
|----------|---------|---------|
| `stripe-webhook` | HTTP POST | Handle subscription events |
| `feed-generator` | Schedule (cron) | Pre-compute user feeds |
| `notification-dispatch` | Database trigger | Push notifications |
| `media-process` | Storage upload | Generate thumbnails, blur hashes |

### Realtime
- Subscribe to: `posts`, `notifications`, `messages`, `conversations`
- Channels: `user:{userId}`, `conversation:{conversationId}`

---

## 5. Frontend Stack Recommendation

| Layer | Technology | Reason |
|-------|------------|--------|
| **Framework** | **Expo (React Native)** | iOS/Android/Web from single codebase |
| **Language** | TypeScript | Type safety, AI-friendly |
| **State** | Zustand + TanStack Query | Simple, performant |
| **Navigation** | Expo Router | File-based, type-safe |
| **UI** | NativeWind (Tailwind) + React Native Reusables | Consistent, fast |
| **Appwrite SDK** | `@appwrite.io/react-native` | Official, realtime support |
| **Forms** | React Hook Form + Zod | Validation shared with backend |
| **Testing** | Vitest + React Native Testing Library | Fast, reliable |

---

## 6. App Store Deployment (Personal Accounts)

### Developer Accounts
| Platform | Cost | Type | Setup Time | Developer Name |
|----------|------|------|------------|----------------|
| Google Play | $25 one-time | Personal | Minutes | Your legal name |
| Apple App Store | $99/year | Personal | Minutes | Your legal name |

### Build Process (Expo EAS)
```bash
# 1. Install EAS CLI
npm i -g eas-cli

# 2. Login
eas login

# 3. Configure project
eas build:configure

# 4. Build for stores
eas build --platform android --profile production  # → .aab
eas build --platform ios --profile production      # → .ipa
```

### Required Store Assets
| Asset | Google Play | Apple App Store |
|-------|-------------|-----------------|
| App icon | 512x512 (no alpha) | 1024x1024 (no alpha, no rounded corners) |
| Feature graphic | 1024x500 | Not required |
| Screenshots | Phone (2-8), Tablet (optional) | iPhone 6.7", 6.5", 5.5", iPad Pro (required per device) |
| Short description | 80 chars | 30 chars (subtitle) |
| Full description | 4000 chars | 4000 chars |
| Privacy policy URL | Required | Required |
| Support URL | Optional | Required |

### Social App Requirements
- Content moderation system (reporting, filtering)
- Demo account for review team
- Push notifications: APNs (iOS) + FCM (Android) via Appwrite Functions
- Deep links: `changers://` scheme in `app.json` + OAuth redirects
- Age rating questionnaire (social = 12+ or 17+)

### Personal Account Notes
- Your legal name appears on store listings
- Can migrate to organization account later if needed
- Apple: 2FA required on trusted device
- Tax/banking: Personal SSN + bank account for payouts

---

## 7. Development Workflow

### Local Development
```bash
# 1. Clone repo
git clone https://github.com/your-org/changers.git
cd changers

# 2. Install deps
npm install

# 3. Start Expo
npx expo start

# 4. Connect to staging Appwrite (Dell PC)
#    Set EXPO_PUBLIC_APPWRITE_ENDPOINT=https://staging-api.changers.dev/v1
```

### Staging Deploy (Dell PC)
```bash
# Push to staging branch → GitHub Actions → Coolify (Dell PC) → staging.changers.dev
git push origin staging
```

### Production Deploy (VPS)
```bash
# Push to main branch → GitHub Actions → Coolify (Hetzner) → api.changers.dev
git push origin main
```

### CI/CD Pipeline (GitHub Actions)
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main, staging]
jobs:
  deploy:
    runs-on: self-hosted  # Dell PC runner
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci && npm run build
      - name: Deploy to Coolify
        uses: coollabsio/coolify-action@v1
        with:
          server: ${{ secrets.COOLIFY_URL }}
          token: ${{ secrets.COOLIFY_TOKEN }}
          application: ${{ github.ref_name == 'main' && 'production' || 'staging' }}
```

---

## 7. Step-by-Step Execution

### Phase 0: Foundation (Day 1) ✅
- [ ] Register `changers.dev` at Cloudflare
- [ ] Create Hetzner account, add payment method
- [ ] Spin up CX22 VPS in target region (US-East / EU-Central / APAC-Singapore)
- [ ] SSH to VPS, install Coolify
- [ ] Deploy Appwrite via Coolify (one-click)
- [ ] Create Cloudflare Tunnel → `api.changers.dev`
- [ ] Configure Appwrite project, API keys
- [ ] Test: Frontend → Appwrite SDK → Auth works

### Phase 1: Core Features (Weeks 1-4)
- [ ] **Auth**: Sign up, login, OAuth, MFA, password reset
- [ ] **Profiles**: Create/edit, avatar upload, username claim
- [ ] **Posts**: Create, media upload, hashtags, mentions
- [ ] **Feed**: Following feed, algorithmic feed (Function), pagination
- [ ] **Follows**: Follow/unfollow, followers/following lists
- [ ] **Notifications**: Like, comment, follow, mention → realtime + push

### Phase 2: Social Features (Weeks 5-8)
- [ ] **Direct Messages**: Conversations, realtime messages, media
- [ ] **Search**: Users, posts, hashtags (Meilisearch)
- [ ] **Explore**: Trending, suggested users, hashtags
- [ ] **Realtime**: Live updates across all surfaces
- [ ] **Settings**: Account, privacy, notifications, blocked users

### Phase 3: Monetization & Polish (Weeks 9-10)
- [ ] **Subscriptions**: Stripe integration, premium features
- [ ] **Analytics**: PostHog (self-hosted on Dell PC)
- [ ] **Moderation**: Reporting, content filtering, admin tools
- [ ] **Performance**: Query optimization, caching, CDN tuning
- [ ] **Accessibility**: WCAG AA, screen readers, keyboard nav

### Phase 4: App Store Submission (Week 11)
- [ ] Create Google Play + Apple Developer accounts (personal)
- [ ] Prepare assets: icons, screenshots, privacy policy, terms URLs
- [ ] `eas build --platform android` → upload to Play Console (internal testing)
- [ ] `eas build --platform ios` → upload to TestFlight (internal testing)
- [ ] Internal testing → fix crashes → submit for review

### Phase 5: Launch (Week 12)
- [ ] Monitor review status → respond to rejections if any
- [ ] Load test: 10k concurrent users, p99 < 200ms
- [ ] Backup restore drill
- [ ] Failover test (VPS → Dell PC staging)
- [ ] Legal: Terms, Privacy, GDPR, CCPA
- [ ] Marketing site: `changers.dev` (static on Cloudflare Pages)
- [ ] Approved builds → staged rollout (10% → 50% → 100%)
- [ ] Launch 🚀

---

## 8. Dell PC Setup (Staging Environment)

### Hardware Requirements Met
- ✅ 8-16GB RAM → Allocate 8GB to Ubuntu VM
- ✅ 500GB HDD → 200GB for VM, rest for backups
- ✅ Mid-2010s CPU → Sufficient for staging loads

### Installation
```bash
# 1. Download Ubuntu Server 24.04 LTS ISO
# 2. Create Hyper-V VM (Gen 2, 8GB RAM, 4 vCPU, 200GB dynamic VHDX)
# 3. Install Ubuntu (OpenSSH, Docker)
# 4. Inside VM:
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
curl -fsSL https://cdn.coolify.io/install.sh | bash

# 5. Access Coolify: https://<dell-vm-ip>:8000
# 6. Deploy Appwrite (staging config)
# 7. Cloudflare Tunnel → staging-api.changers.dev
```

### Ongoing Uses
| Use Case | Command/Tool |
|----------|--------------|
| CI/CD Runner | GitHub Actions self-hosted runner on Dell |
| Backup Target | `rsync -avz /var/lib/coolify/backups/ user@dell:/backups/` |
| Database GUI | pgAdmin / TablePlus via SSH tunnel |
| Log Aggregation | `ssh dell 'journalctl -u coolify -f'` |
| Experimentation | Test K8s, new services, migrations safely |

---

## 9. Monitoring & Alerting

| Metric | Tool | Alert Threshold |
|--------|------|-----------------|
| Uptime | Uptime Kuma | < 99.9% |
| API Latency | Appwrite + Grafana | p99 > 500ms |
| Error Rate | Appwrite logs | > 1% 5xx |
| Disk Usage | Coolify / Node Exporter | > 80% |
| Memory | Coolify / Node Exporter | > 85% |
| Backup Success | Hetzner + Custom | Any failure |

**Notifications:** Discord webhook + PagerDuty free tier

---

## 10. Security Checklist

- [ ] Cloudflare WAF: OWASP Top 10 rules enabled
- [ ] Appwrite: Rate limiting on auth endpoints
- [ ] API keys: Separate keys per environment (staging/prod)
- [ ] Database: Row-level permissions on all collections
- [ ] Storage: Signed URLs for private buckets
- [ ] Functions: Secrets in Coolify, not code
- [ ] Backups: Encrypted at rest (Hetzner) + in transit
- [ ] SSH: Key-only, non-standard port, fail2ban
- [ ] Dependencies: `npm audit` in CI, Dependabot alerts

---

## 11. Migration Path (Post-Launch)

| Trigger | Action |
|---------|--------|
| **CPU/RAM > 80% sustained** | Upgrade VPS to CX32 (4 vCPU, 8GB) or CX42 |
| **Multi-region needed** | Add 2nd VPS in another region, Cloudflare LB |
| **Appwrite limits hit** | Migrate hot collections to PostgreSQL on same VPS |
| **Team grows** | Move Coolify to dedicated management node |
| **Dell PC upgraded** | Promote to production, VPS becomes staging |

---

## 13. Key Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Domain registrar | Cloudflare | Wholesale pricing, API, unified DNS |
| Production host | Hetzner CX22 | Best $/perf, NVMe, global DCs |
| PaaS | Coolify | Self-hosted, Git deploy, Appwrite template |
| Backend | Appwrite | Auth+DB+Storage+Functions+Realtime in one |
| Frontend | Expo + React Native | Single codebase for iOS/Android/Web |
| Staging | Dell PC (Hyper-V Ubuntu) | Free, sustainable, realistic env |
| Tunnel | Cloudflare Tunnel | No port forwarding, free DDoS/CDN |
| CI/CD | GitHub Actions (self-hosted) | Free minutes, runs on Dell PC |
| App Store accounts | Personal (both) | Fast setup, no D-U-N-S wait, migrate later |
| Build pipeline | Expo EAS | Cloud builds, no Xcode needed, auto-signing |

---

## 13. Quick Reference Commands

```bash
# VPS Initial Setup
ssh root@<vps-ip>
curl -fsSL https://cdn.coolify.io/install.sh | bash

# Appwrite CLI (for migrations/functions)
npm i -g @appwrite/cli
appwrite login
appwrite init project

# Database Backup (manual)
docker exec -t <appwrite-db-container> pg_dump -U appwrite > backup.sql

# Cloudflare Tunnel Token Rotation
# Cloudflare Zero Trust → Networks → Tunnels → Regenerate token
# Update in Coolify → Services → cloudflared → Environment

# Scale VPS (Hetzner API)
hcloud server upgrade <server-id> --type cpx31
```

---

## 15. Resources & Links

- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **Hetzner Console**: https://console.hetzner.cloud
- **Coolify Docs**: https://coolify.io/docs
- **Appwrite Docs**: https://appwrite.io/docs
- **Expo Docs**: https://docs.expo.dev
- **Appwrite SDK (React Native)**: https://appwrite.io/docs/sdks/react-native
- **Expo EAS Build**: https://docs.expo.dev/build/introduction/
- **Google Play Console**: https://play.google.com/console
- **Apple App Store Connect**: https://appstoreconnect.apple.com
- **Apple Developer Enrollment**: https://developer.apple.com/programs/enroll/
- **Google Play Developer Signup**: https://play.google.com/console/signup

---

## 16. Next Immediate Action

> **Run these 3 commands in order:**
> ```bash
> # 1. Register domain (browser)
> #    → https://dash.cloudflare.com → Register Domain → changers.dev
> #
> # 2. Create VPS (browser)
> #    → https://console.hetzner.cloud → Add Server → CX22 → Ubuntu 24.04
> #
> # 3. Install Coolify (SSH to VPS)
> ssh root@<vps-ip>
> curl -fsSL https://cdn.coolify.io/install.sh | bash
> ```
>
> **Then open Coolify UI, deploy Appwrite, configure Cloudflare Tunnel.**
>
> **You'll be writing frontend code against a live backend in 30 minutes.**