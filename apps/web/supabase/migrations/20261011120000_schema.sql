-- R1b · 1 of 5 · The data model (docs/07-APP-SPEC.md §5).
-- Postgres, schema public, UUID keys, created_at on every table. Every column a policy filters on is indexed (§9).
-- Lengths are capped here as well as in the app's zod schemas (§10). Places are city-level only: a club's lat/lng is
-- numeric(5,2), so the database itself refuses anything finer than its city centroid (§8).

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions; -- digest(), gen_random_bytes(): code and invite hashes
create extension if not exists pg_trgm with schema extensions;  -- the directory's search (§5 clubs: trigram)

-- ── Enums (§5) ──────────────────────────────────────────────────────────────────────────────────────────────────
create type public.strand as enum ('nature', 'economy', 'society', 'wellbeing');
create type public.age_band as enum ('13-15', '16-17', 'adult');
create type public.club_status as enum ('pending', 'verified', 'suspended');
create type public.member_role as enum ('member', 'lead', 'advisor');
create type public.member_status as enum ('pending', 'active', 'left', 'removed');
create type public.visibility as enum ('public', 'club', 'network');
create type public.content_status as enum ('draft', 'pending', 'published', 'hidden');
create type public.project_status as enum ('draft', 'proposed', 'active', 'completed');
-- Not named in §5, chosen here: an event made public by a lead waits for an advisor (§3 "anything public needs the
-- advisor"), and staff cancel rather than delete (§6 events: "soft: cancelled").
create type public.event_status as enum ('pending', 'published', 'cancelled', 'hidden');

-- ── People ─────────────────────────────────────────────────────────────────────────────────────────────────────
-- One row per account, made by complete_signup() or redeem_invite() after the code sign-in. Email lives only in
-- auth.users and is never shown to anyone (§8). Not collected: birth date, phone, photo, school, gender, full name.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- First name and initial only ("Anna K."): one word, then optionally a space and a single letter with a dot.
  display_name text not null check (char_length(display_name) between 1 and 32 and display_name ~ '^[^ ]+( [^ ]\.?)?$' and display_name !~ '[0-9@/:]'),
  age_band public.age_band not null,
  country text not null check (country ~ '^[A-Z]{2}$'),
  locale text not null default 'en' check (locale in ('en')),
  is_verified_adult boolean not null default false,
  verified_until date,
  digest_opt_in boolean not null default false,
  conduct_accepted_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.network_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table public.network_admins is 'Rows are added by SQL only, by Luke (07 §5). Powers also need aal2.';

-- ── Clubs ──────────────────────────────────────────────────────────────────────────────────────────────────────
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(slug) <= 64 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 80),
  school_name text not null check (char_length(school_name) between 2 and 120),
  city text not null check (char_length(city) between 1 and 80),
  country text not null check (country ~ '^[A-Z]{2}$'),
  lat numeric(5, 2) not null check (lat between -90 and 90),
  lng numeric(5, 2) not null check (lng between -180 and 180),
  tz text not null default 'Europe/Budapest' check (char_length(tz) between 3 and 64),
  strands public.strand[] not null default '{}',
  languages text[] not null default '{English}' check (cardinality(languages) between 1 and 8),
  description text not null default '' check (char_length(description) <= 1200),
  status public.club_status not null default 'pending',
  pre_approval boolean not null default true, -- §7: on by default; an advisor may switch it off for club-only text
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  last_active_at timestamptz not null default now(),
  cover_media_id uuid,
  created_at timestamptz not null default now()
);
create index clubs_status on public.clubs (status);
create index clubs_country on public.clubs (country);
create index clubs_recent on public.clubs (last_active_at desc, id);
create index clubs_strands on public.clubs using gin (strands);
create index clubs_languages on public.clubs using gin (languages);
create index clubs_search on public.clubs using gin (name extensions.gin_trgm_ops, school_name extensions.gin_trgm_ops, city extensions.gin_trgm_ops);

create table public.advisor_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  club_id uuid references public.clubs (id) on delete set null,
  school_name text not null check (char_length(school_name) between 2 and 120),
  school_domain text not null check (school_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  second_contact_role text check (char_length(second_contact_role) <= 80),
  second_contact_email text check (char_length(second_contact_email) <= 254), -- deleted when verification ends (§5)
  -- §4: 1 school email · 2 second contact confirmed · 3 admin approved · 4 TOTP on
  step smallint not null default 1 check (step between 1 and 4),
  status text not null default 'open' check (status in ('open', 'approved', 'rejected', 'lapsed')),
  created_at timestamptz not null default now()
);
create index advisor_verifications_user on public.advisor_verifications (user_id);
create index advisor_verifications_status on public.advisor_verifications (status);

create table public.club_codes (
  club_id uuid primary key references public.clubs (id) on delete cascade,
  code_hash text not null unique, -- sha256 of the normalised code; the code itself is shown once, when made
  rotated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'member',
  status public.member_status not null default 'pending',
  joined_via text not null check (joined_via in ('code', 'invite', 'creator')),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (club_id, user_id)
);
create index club_members_user on public.club_members (user_id, status);
create index club_members_club on public.club_members (club_id, status, role);

-- Consent records are append-only (§5): a revocation is a new row pointing at the one it revokes.
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid references public.profiles (id) on delete set null, -- null until the invite is redeemed
  club_id uuid not null references public.clubs (id) on delete cascade,
  scope text not null check (scope in ('join', 'photos', 'public_credit', 'digest')),
  method text not null check (method in ('school_on_file', 'parent_email', 'self')),
  recorded_by uuid references public.profiles (id) on delete set null,
  recorded_at timestamptz not null default now(),
  revoked_at timestamptz,
  revokes uuid references public.consents (id),
  created_at timestamptz not null default now()
);
create index consents_subject on public.consents (subject_user_id);
create index consents_club on public.consents (club_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  token_hash text not null unique,
  intended_band public.age_band not null,
  consent_id uuid references public.consents (id),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  -- Under 16: the parent's or school's authorisation is recorded before the invite exists (§4).
  constraint invites_consent_for_under_16 check (intended_band <> '13-15' or consent_id is not null)
);

-- ── Conference hubs (before events, which can belong to one) ───────────────────────────────────────────────────
create table public.conference_hubs (
  id uuid primary key default gen_random_uuid(),
  year smallint not null unique check (year between 2020 and 2100),
  host_club_id uuid references public.clubs (id) on delete set null, -- that club's verified advisors edit the hub
  title text not null check (char_length(title) between 3 and 120),
  city text not null check (char_length(city) between 1 and 80),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  status text not null default 'hidden' check (status in ('hidden', 'live', 'archived')),
  created_at timestamptz not null default now()
);
create index conference_hubs_status on public.conference_hubs (status);

-- ── Projects ───────────────────────────────────────────────────────────────────────────────────────────────────
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  strand public.strand not null,
  problem text not null default '' check (char_length(problem) <= 2000),
  action text not null default '' check (char_length(action) <= 2000),
  evidence text not null default '' check (char_length(evidence) <= 2000),
  reflection text not null default '' check (char_length(reflection) <= 2000),
  status public.project_status not null default 'draft',
  visibility public.visibility not null default 'club' check (visibility in ('club', 'public')),
  year smallint not null default extract(year from now())::smallint check (year between 2020 and 2100),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  deleted_at timestamptz, -- staff delete softly (§6)
  created_at timestamptz not null default now()
);
create index projects_club on public.projects (club_id, status);
create index projects_public on public.projects (visibility, status, created_at desc, id);
create index projects_strand on public.projects (strand);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);
create index project_members_user on public.project_members (user_id);

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  done boolean not null default false,
  position integer not null default 0,
  assignee_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index project_tasks_project on public.project_tasks (project_id, position);

-- ── Events ─────────────────────────────────────────────────────────────────────────────────────────────────────
create table public.events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references public.clubs (id) on delete cascade, -- null for hub events
  hub_id uuid references public.conference_hubs (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  strand public.strand,
  description text not null default '' check (char_length(description) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  tz text not null check (char_length(tz) between 3 and 64), -- the event's IANA zone (§12)
  mode text not null check (mode in ('in_person', 'online', 'hybrid')),
  city text not null check (char_length(city) between 1 and 80), -- the public place: city-level only
  capacity integer check (capacity is null or capacity between 1 and 5000),
  visibility public.visibility not null default 'club',
  status public.event_status not null default 'published',
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint events_belong check (club_id is not null or hub_id is not null),
  constraint events_order check (ends_at > starts_at)
);
create index events_public on public.events (visibility, starts_at, id);
create index events_club on public.events (club_id, starts_at);
create index events_hub on public.events (hub_id);

-- The exact place and the online link: only for people going, and the hosts (§6; brief rule 1).
create table public.event_links (
  event_id uuid primary key references public.events (id) on delete cascade,
  online_url text check (online_url ~ '^https://' and char_length(online_url) <= 500),
  place_detail text check (char_length(place_detail) <= 300),
  created_at timestamptz not null default now()
);

create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'going' check (status in ('going', 'cancelled', 'waitlist')),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index rsvps_user on public.rsvps (user_id);

-- ── Posts ──────────────────────────────────────────────────────────────────────────────────────────────────────
create table public.updates (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  author_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body text not null check (char_length(body) between 1 and 2000),
  visibility public.visibility not null default 'club' check (visibility in ('club', 'public')),
  status public.content_status not null default 'pending',
  has_link boolean not null default false,  -- set by a trigger from the text
  has_photo boolean not null default false, -- set by the upload route
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index updates_club on public.updates (club_id, status, created_at desc, id);
create index updates_author on public.updates (author_id);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  update_id uuid references public.updates (id) on delete cascade,
  uploader_id uuid references public.profiles (id) on delete set null,
  path_large text not null check (path_large ~ '^clubs/[0-9a-f-]{36}/[0-9a-f-]{36}-large\.webp$'),
  path_small text not null check (path_small ~ '^clubs/[0-9a-f-]{36}/[0-9a-f-]{36}-small\.webp$'),
  width integer not null check (width between 1 and 4000),
  height integer not null check (height between 1 and 4000),
  alt text not null default '' check (char_length(alt) <= 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  approved_by uuid references public.profiles (id) on delete set null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  constraint media_alt_when_approved check (status <> 'approved' or char_length(alt) > 0), -- §12
  constraint media_public_needs_approval check (not is_public or status = 'approved')
);
create index media_club on public.media (club_id, status);
alter table public.clubs add constraint clubs_cover foreign key (cover_media_id) references public.media (id) on delete set null;

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  locked boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index threads_club on public.threads (club_id, created_at desc);

create table public.thread_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body text not null check (char_length(body) between 1 and 2000),
  status public.content_status not null default 'pending',
  has_link boolean not null default false,
  created_at timestamptz not null default now()
);
create index thread_posts_thread on public.thread_posts (thread_id, created_at);
create index thread_posts_author on public.thread_posts (author_id);

-- ── The network ────────────────────────────────────────────────────────────────────────────────────────────────
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  strand public.strand not null,
  title text not null check (char_length(title) between 3 and 160),
  url text not null check (url ~ '^https://' and char_length(url) <= 500),
  source_name text not null check (char_length(source_name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 600),
  status public.content_status not null default 'draft',
  added_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index resources_strand on public.resources (strand, status);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null, -- null for visitors
  target_type text not null check (target_type in ('club', 'project', 'update', 'event', 'thread', 'thread_post', 'media', 'resource')),
  target_id uuid not null,
  about_user_id uuid references public.profiles (id) on delete set null, -- who wrote it: advisors never handle reports about themselves
  club_id uuid references public.clubs (id) on delete set null,
  reason text not null check (reason in ('child_safety', 'bullying', 'personal_info', 'spam', 'wrong_info', 'other')),
  details text not null default '' check (char_length(details) <= 2000),
  priority text not null default 'normal' check (priority in ('child_safety', 'normal')),
  status text not null default 'open' check (status in ('open', 'triaged', 'actioned', 'dismissed')),
  about_adult boolean not null default false,
  unverified boolean not null default false, -- Turnstile failed: kept anyway, never fail closed (§7)
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  statement text check (char_length(statement) <= 2000), -- the statement of reasons (DSA Art. 17)
  created_at timestamptz not null default now()
);
create index reports_queue on public.reports (status, priority, created_at);
create index reports_club on public.reports (club_id);

-- Append-only (§6): no foreign keys, so deleting an account never has to touch a row here.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor_id uuid,
  action text not null check (char_length(action) between 2 and 64),
  target_type text,
  target_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_at on public.audit_log (at desc);
create index audit_log_target on public.audit_log (target_type, target_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (char_length(kind) between 2 and 64),
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications (user_id, read_at, created_at desc);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  sender_name text not null check (char_length(sender_name) between 1 and 80),
  sender_email text not null check (char_length(sender_email) <= 254 and sender_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'new' check (status in ('new', 'read', 'closed')),
  created_at timestamptz not null default now() -- deleted after 90 days (default, for an adult to confirm)
);
create index contact_messages_club on public.contact_messages (club_id, created_at desc);

-- §7: the flagged-word list lives in the database, editable by admins. A post with one is always held.
create table public.flagged_words (
  word text primary key check (char_length(word) between 2 and 60 and word = lower(word)),
  created_at timestamptz not null default now()
);
