-- R1b · 6 · What the old site (changers-three.vercel.app) did well, made safe for clubs (Luke, 12 Oct: "bring over
-- everything you think we should"). Its kanban becomes a task board on every project; its Impact Score becomes impact
-- numbers on projects, each saying how it was counted; its Network becomes following a club (never a person); its
-- polls live inside club threads. Grants and policies follow 4 of 5: as narrow as each rule.

-- ── The task board: To do · Doing · Done ────────────────────────────────────────────────────────────────────────
alter table public.project_tasks add column state text not null default 'todo' check (state in ('todo', 'doing', 'done'));
update public.project_tasks set state = 'done' where done;
alter table public.project_tasks drop column done;
alter table public.project_tasks add column done boolean generated always as (state = 'done') stored; -- for readers that only ask "done?"
create index project_tasks_state on public.project_tasks (project_id, state, position);

-- ── Impact numbers: what a project changed, and how it was counted ──────────────────────────────────────────────
create table public.project_impacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  label text not null check (char_length(label) between 2 and 80),     -- "plastic bottles not thrown away"
  value numeric(12, 2) not null check (value >= 0),
  unit text not null default '' check (char_length(unit) <= 30),        -- "kg", "people", ""
  how text not null default '' check (char_length(how) <= 300),         -- "we weighed the bin every Friday"
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index project_impacts_project on public.project_impacts (project_id);

-- ── Links to the project's own files (a doc, slides, a video): members only, never on public pages ──────────────
create table public.project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  url text not null check (url ~ '^https://' and char_length(url) <= 500),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index project_links_project on public.project_links (project_id);

-- ── Following a club, never a person. Nobody sees who follows a club, not even the club ─────────────────────────
create table public.club_follows (
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, club_id)
);
create index club_follows_club on public.club_follows (club_id);

-- ── Polls inside club threads ("Which day works?"): members vote once, everyone sees counts, nobody sees who ─────
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  question text not null check (char_length(question) between 3 and 200),
  options text[] not null check (cardinality(options) between 2 and 6 and array_position(options, '') is null),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  closes_at timestamptz,
  created_at timestamptz not null default now()
);
create index polls_thread on public.polls (thread_id);

create table public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  choice smallint not null check (choice between 0 and 5),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

-- ── Helpers and guards ──────────────────────────────────────────────────────────────────────────────────────────
create or replace function app.poll_club(p_poll uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select t.club_id from public.polls p join public.threads t on t.id = p.thread_id where p.id = p_poll and t.deleted_at is null
$$;

create or replace function app.project_writer(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select app.on_team(j.id) or app.is_staff(j.club_id) or app.is_admin() from public.projects j where j.id = p_project and j.deleted_at is null), false)
$$;

-- A public project's numbers are a public claim: changing them takes the project off the public site until an advisor
-- approves it again (as edits to its text do, 07 §6).
create or replace function app.impacts_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_project uuid := coalesce(new.project_id, old.project_id);
begin
  if (select auth.uid()) is not null then
    update public.projects set approved_by = null, approved_at = null where id = v_project and visibility = 'public' and approved_at is not null;
  end if;
  return coalesce(new, old);
end $$;
create trigger impacts_guard after insert or update or delete on public.project_impacts for each row execute function app.impacts_guard();

-- Poll text follows the thread rule (Luke, 11 Oct: replies post at once): a link or a flagged word is refused here,
-- since a poll has no "waiting" state; every option is 1–80 characters.
create or replace function app.polls_guard() returns trigger language plpgsql set search_path = '' as $$
declare v_text text := new.question || ' ' || array_to_string(new.options, ' ');
begin
  if app.direct() then
    new.created_by := (select auth.uid());
    if exists (select 1 from unnest(new.options) o where char_length(o) not between 1 and 80) then raise exception 'each choice is 1 to 80 characters' using errcode = '22023'; end if;
    if app.has_link(v_text) or app.has_flagged_word(v_text) then raise exception 'a poll can''t carry a link or a flagged word' using errcode = '42501'; end if;
    if (select t.locked from public.threads t where t.id = new.thread_id) then raise exception 'this thread is locked' using errcode = '42501'; end if;
  end if;
  return new;
end $$;
create trigger polls_guard before insert on public.polls for each row execute function app.polls_guard();

-- A vote is for one of the poll's own choices, while it's open. The poll is read with the owner's rights, so someone
-- outside the club is refused by the rules (42501, "not allowed") rather than told the choice doesn't exist.
create or replace function app.poll_shape(p_poll uuid) returns table (options text[], closes_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.options, p.closes_at from public.polls p where p.id = p_poll
$$;

create or replace function app.poll_votes_guard() returns trigger language plpgsql set search_path = '' as $$
declare v_poll record;
begin
  select s.options, s.closes_at into v_poll from app.poll_shape(new.poll_id) s;
  if v_poll.options is null or new.choice >= cardinality(v_poll.options) then raise exception 'no such choice' using errcode = '22023'; end if;
  if v_poll.closes_at is not null and v_poll.closes_at <= now() then raise exception 'this poll has closed' using errcode = '42501'; end if;
  if app.direct() then new.user_id := (select auth.uid()); end if;
  return new;
end $$;
create trigger poll_votes_guard before insert or update on public.poll_votes for each row execute function app.poll_votes_guard();

-- The counts per choice, for the club's members: never who voted for what.
create or replace function public.poll_results(p_poll uuid)
returns table (choice smallint, votes integer)
language sql stable security definer set search_path = '' as $$
  select v.choice, count(*)::int from public.poll_votes v
  where v.poll_id = p_poll and (app.is_member(app.poll_club(p_poll)) or app.is_admin())
  group by v.choice
$$;

-- My data now includes the clubs I follow and my poll votes (07 §4).
create or replace function public.export_my_data()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v jsonb;
begin
  if v_uid is null then perform app.deny('sign in first'); end if;
  select jsonb_build_object(
    'exported_at', now(),
    'email', (select u.email from auth.users u where u.id = v_uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'memberships', (select coalesce(jsonb_agg(jsonb_build_object('club', c.name, 'role', m.role, 'status', m.status, 'joined', m.created_at)), '[]')
                    from public.club_members m join public.clubs c on c.id = m.club_id where m.user_id = v_uid),
    'follows', (select coalesce(jsonb_agg(jsonb_build_object('club', c.name, 'since', f.created_at)), '[]')
                from public.club_follows f join public.clubs c on c.id = f.club_id where f.user_id = v_uid),
    'rsvps', (select coalesce(jsonb_agg(jsonb_build_object('event', e.title, 'starts_at', e.starts_at, 'status', r.status)), '[]')
              from public.rsvps r join public.events e on e.id = r.event_id where r.user_id = v_uid),
    'updates', (select coalesce(jsonb_agg(jsonb_build_object('body', u.body, 'visibility', u.visibility, 'status', u.status, 'created_at', u.created_at)), '[]')
                from public.updates u where u.author_id = v_uid),
    'thread_posts', (select coalesce(jsonb_agg(jsonb_build_object('thread', t.title, 'body', tp.body, 'status', tp.status, 'created_at', tp.created_at)), '[]')
                     from public.thread_posts tp join public.threads t on t.id = tp.thread_id where tp.author_id = v_uid),
    'poll_votes', (select coalesce(jsonb_agg(jsonb_build_object('question', p.question, 'choice', p.options[v.choice + 1], 'at', v.created_at)), '[]')
                   from public.poll_votes v join public.polls p on p.id = v.poll_id where v.user_id = v_uid),
    'project_roles', (select coalesce(jsonb_agg(jsonb_build_object('project', j.title, 'role', pm.role)), '[]')
                      from public.project_members pm join public.projects j on j.id = pm.project_id where pm.user_id = v_uid),
    'consents', (select coalesce(jsonb_agg(jsonb_build_object('scope', k.scope, 'method', k.method, 'recorded_at', k.recorded_at, 'revoked_at', k.revoked_at)), '[]')
                 from public.consents k where k.subject_user_id = v_uid),
    'notifications', (select coalesce(jsonb_agg(jsonb_build_object('kind', n.kind, 'payload', n.payload, 'created_at', n.created_at, 'read_at', n.read_at)), '[]')
                      from public.notifications n where n.user_id = v_uid)
  ) into v;
  perform app.log('account.export', 'profile', v_uid, '{}');
  return v;
end $$;

-- ── Grants and rules ────────────────────────────────────────────────────────────────────────────────────────────
revoke all on public.project_impacts, public.project_links, public.club_follows, public.polls, public.poll_votes from anon, authenticated;
grant all on public.project_impacts, public.project_links, public.club_follows, public.polls, public.poll_votes to service_role;
grant select on public.project_impacts to anon, authenticated;
grant insert (project_id, label, value, unit, how), update (label, value, unit, how), delete on public.project_impacts to authenticated;
grant select, delete on public.project_links to authenticated;
grant insert (project_id, label, url), update (label, url) on public.project_links to authenticated;
grant select, insert (club_id), delete on public.club_follows to authenticated;
grant select, delete on public.polls to authenticated;
grant insert (thread_id, question, options, closes_at) on public.polls to authenticated;
grant select, delete on public.poll_votes to authenticated;
grant insert (poll_id, choice), update (choice) on public.poll_votes to authenticated;

alter table public.project_impacts enable row level security;
alter table public.project_links enable row level security;
alter table public.club_follows enable row level security;
alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;

-- Impact numbers: whoever can see the project sees them (a visitor sees an approved public project's); its team and
-- the club's staff write them.
create policy project_impacts_select on public.project_impacts for select to anon, authenticated using (exists (select 1 from public.projects j where j.id = project_id));
create policy project_impacts_insert on public.project_impacts for insert to authenticated with check (app.project_writer(project_id));
create policy project_impacts_update on public.project_impacts for update to authenticated using (app.project_writer(project_id)) with check (app.project_writer(project_id));
create policy project_impacts_delete on public.project_impacts for delete to authenticated using (app.project_writer(project_id));

-- Links: the club's members read them; the team and staff write them.
create policy project_links_select on public.project_links for select to authenticated using (
  exists (select 1 from public.projects j where j.id = project_id and (app.is_member(j.club_id) or app.is_admin()))
);
create policy project_links_insert on public.project_links for insert to authenticated with check (app.project_writer(project_id));
create policy project_links_update on public.project_links for update to authenticated using (app.project_writer(project_id)) with check (app.project_writer(project_id));
create policy project_links_delete on public.project_links for delete to authenticated using (app.project_writer(project_id));

-- Follows: your own only, and only clubs on the public site.
create policy club_follows_select on public.club_follows for select to authenticated using (user_id = (select auth.uid()));
create policy club_follows_insert on public.club_follows for insert to authenticated with check (user_id = (select auth.uid()) and app.club_listed(club_id) and app.band() is not null);
create policy club_follows_delete on public.club_follows for delete to authenticated using (user_id = (select auth.uid()));

-- Polls: the thread's club reads and starts them; the person who started one, or the club's staff, removes it.
create policy polls_select on public.polls for select to authenticated using (app.is_member(app.thread_club(thread_id)) or app.is_admin());
create policy polls_insert on public.polls for insert to authenticated with check (app.is_member(app.thread_club(thread_id)));
create policy polls_delete on public.polls for delete to authenticated using (created_by = (select auth.uid()) or app.is_staff(app.thread_club(thread_id)));

-- Votes: your own only; you can change or take back your vote.
create policy poll_votes_select on public.poll_votes for select to authenticated using (user_id = (select auth.uid()));
create policy poll_votes_insert on public.poll_votes for insert to authenticated with check (user_id = (select auth.uid()) and app.is_member(app.poll_club(poll_id)));
create policy poll_votes_update on public.poll_votes for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and app.is_member(app.poll_club(poll_id)));
create policy poll_votes_delete on public.poll_votes for delete to authenticated using (user_id = (select auth.uid()));

revoke all on function app.poll_club(uuid), app.project_writer(uuid), app.poll_shape(uuid), app.impacts_guard(), app.polls_guard(), app.poll_votes_guard() from public;
grant execute on function app.poll_club(uuid), app.project_writer(uuid), app.poll_shape(uuid) to anon, authenticated, service_role;
revoke all on function public.poll_results(uuid) from public, anon;
grant execute on function public.poll_results(uuid) to authenticated;
