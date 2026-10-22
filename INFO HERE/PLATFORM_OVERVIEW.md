# Changers Platform — Overview

**Changers** is a social platform built for changemakers — people who want to make a positive impact in their communities and the world. It brings together tools for connection, collaboration, and project-building in one place.

---

## What Is Changers?

Changers is a **changemaker social network**. Think of it as a purpose-driven alternative to mainstream social media: instead of endless scrolling, you find people working on real projects, join collaborative "rooms," start video calls, share progress, and build things together.

### Core Idea
- **Profiles with purpose** — Show what you care about, what you're building, and what help you need
- **Project-based collaboration** — Create or join projects with clear goals, tasks, and milestones
- **Live rooms** — Drop-in spaces for co-working, workshops, mentorship sessions, or casual hangouts
- **Video calls built in** — Start a call from any room with screen share, whiteboard, breakout groups, and timer
- **Direct messaging** — Private threads for 1:1 conversations and small-group coordination
- **Badges & recognition** — Earn visible badges for contributions, mentorship, completed projects, and community impact

---

## Who Is It For?

| Audience | How They Use Changers |
|----------|----------------------|
| **Students & young professionals** | Find mentors, join projects, build portfolios with real outcomes |
| **Nonprofit & community organizers** | Recruit volunteers, coordinate campaigns, share updates with supporters |
| **Educators & mentors** | Run office hours, host workshops, guide project teams |
| **Social entrepreneurs** | Validate ideas, find co-founders, showcase traction to funders |
| **Anyone wanting to contribute** | Discover causes, offer skills (design, code, writing, strategy), track impact |

---

## Key Features (Plain Language)

### 🏠 Home Feed
See updates from people you follow, projects you're part of, and rooms you've joined. No algorithm — just chronological updates from your network.

### 👤 Profiles
- **Strands/Tags** — Pick topics you care about (climate, education, tech for good, etc.)
- **Skills offered** — What you can help with (design, fundraising, research, coding…)
- **Projects showcase** — Your past and current work, with outcomes
- **Badges earned** — Verified recognition from the community

### 🚀 Projects
Create a project with:
- A clear mission statement
- Milestones and tasks (kanban-style board)
- Team roles (lead, contributor, advisor, supporter)
- Public or private visibility
- Progress updates that appear in followers' feeds

### 🏘️ Rooms (Collaborative Spaces)
- **Co-working rooms** — Silent focus time with optional check-ins
- **Workshop rooms** — Scheduled sessions with a host and agenda
- **Mentorship rooms** — Recurring office hours
- **Community rooms** — Open spaces for any topic

Each room has:
- Live participant list
- Shared timer (great for pomodoro or timed activities)
- Collaborative whiteboard
- In-room chat
- **One-click video call** — launches a full WebRTC call with screen share, breakout groups, reactions, and connection quality badges

### 💬 Messaging
- Direct messages (1:1)
- Group threads (per project, per room, or custom)
- Message requests from people you don't follow (with spam protection)
- Email digest of unanswered messages (opt-in, daily or weekly)

### 🔔 Notifications & Digest
- Real-time in-app notifications
- Optional daily email digest: unanswered messages + trending posts from your network
- Granular controls — choose what you get notified about

### 🛡️ Safety & Moderation
- Report content or users
- Block/mute controls
- Admin dashboard for community moderation
- Content filtering on upload
- Age-appropriate defaults (12+ or 17+ depending on region)

### 📊 Admin Tools (for community managers)
- User management (view, export, anonymize, or delete data on request)
- Message inbox (contact form submissions + reported content)
- Audit log of all admin actions
- Platform analytics (privacy-respecting, aggregated only)

---

## Platform Philosophy

| Principle | What It Means |
|-----------|---------------|
| **Purpose over engagement** | Features serve collaboration, not time-on-site |
| **Data ownership** | Export or delete your data anytime, no questions |
| **No surveillance capitalism** | No ad tracking, no selling data, no algorithmic manipulation |
| **Open by default** | Public projects and rooms are discoverable; private is opt-in |
| **Accessibility first** | WCAG AA target, screen-reader friendly, keyboard navigation |
| **International from day one** | Built for a global community (i18n-ready) |

---

## Technology Snapshot (Non-Technical)

- **Runs everywhere** — Web (installable as PWA), iOS, Android, macOS, Windows, Linux
- **Single codebase** — All platforms share the same features; no "lite" mobile version
- **Self-hosted backbone** — Core backend runs on independent infrastructure (not Big Tech cloud lock-in)
- **Privacy-respecting auth** — Email/password + social login (GitHub, Google, Apple), optional 2FA
- **Real-time everything** — Feeds, messages, calls, presence — all live without refreshing
- **Cost-efficient** — Designed to run on ~$7–10/month infrastructure at scale

---

## Current Status

> **Active development** — Core platform is functional with auth, feed, rooms, calls, messaging, projects, badges, admin tools, and privacy controls. Mobile and desktop apps are thin native shells around the full web experience.

**Next milestones:**
1. App Store / Play Store submission (Expo EAS builds)
2. SMTP/email integration (contact forms, digests, admin replies)
3. TURN server for reliable group calls behind restrictive networks
4. Public launch on `changers.dev`

---

## Get Involved

- **Try it** — Visit the web app (link TBD) and create an account
- **Contribute** — Code, design, docs, translation, testing — all welcome
- **Host a room** — Run a co-working session, workshop, or mentorship hour
- **Start a project** — Post a project idea and find collaborators
- **Spread the word** — Invite changemakers in your network

---

## Links

- **Planning doc** — `PLAN.md` (root of repo)
- **Technical README** — `changers/README.md`
- **Dell PC setup guide** — `changers/DELL_PC_SETUP.md`
- **Media storage architecture** — `changers/web/MEDIA_STORAGE.md`
- **Contact** — `30dimrekatai@student.aisb.hu` (partnerships) · `davidimrekatai@gmail.com` (general)

---

*Last updated: October 2026*