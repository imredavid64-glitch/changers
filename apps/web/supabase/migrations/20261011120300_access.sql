-- R1b · 4 of 5 · Who can read and write what, enforced in the database (docs/07-APP-SPEC.md §6).
-- RLS is on for every table. Grants come first and are as narrow as the rule: a column people may not change has no
-- update grant at all, so even a policy bug can't open it. Writes that cross rules go through the functions in 3 of
-- 5 (they run as the table owner). Supabase grants everything on new tables by default, so every later migration
-- must set its own grants the same way.

-- Two more helpers the policies need.
create or replace function app.requested(p_club uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.club_members m where m.club_id = p_club and m.user_id = (select auth.uid()) and m.status = 'pending')
$$;

create or replace function app.thread_club(p_thread uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select t.club_id from public.threads t where t.id = p_thread and t.deleted_at is null
$$;
grant execute on function app.requested(uuid), app.thread_club(uuid) to anon, authenticated, service_role;

-- Editors of a conference hub change its text; only admins change its status, host or year.
create or replace function app.hubs_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if app.direct() and not app.is_admin() and (new.status, new.host_club_id, new.year) is distinct from (old.status, old.host_club_id, old.year) then
    raise exception 'only a network admin changes the hub''s status or host' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger hubs_guard before update on public.conference_hubs for each row execute function app.hubs_guard();

-- ── Grants ─────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on all tables in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated, service_role; -- §6: nobody
grant select on public.club_member_names to authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, locale, digest_opt_in, age_band) on public.profiles to authenticated;
grant select on public.network_admins, public.advisor_verifications, public.club_codes, public.club_members,
  public.invites, public.consents, public.rsvps, public.threads, public.thread_posts, public.reports,
  public.audit_log, public.notifications, public.contact_messages, public.flagged_words to authenticated;
grant select on public.clubs, public.projects, public.events, public.updates, public.media, public.resources, public.conference_hubs to anon, authenticated;

grant update (name, description, strands, languages, school_name, city, country, lat, lng, tz, pre_approval, cover_media_id) on public.clubs to authenticated;
grant insert (club_id, title, strand, problem, action, evidence, reflection, status, visibility, year) on public.projects to authenticated;
grant update (title, strand, problem, action, evidence, reflection, status, year, deleted_at) on public.projects to authenticated;
grant select, insert, update, delete on public.project_members, public.project_tasks to authenticated;
grant insert (club_id, hub_id, title, strand, description, starts_at, ends_at, tz, mode, city, capacity, visibility) on public.events to authenticated;
grant update (title, strand, description, starts_at, ends_at, tz, mode, city, capacity, visibility, status) on public.events to authenticated;
grant select, insert, update, delete on public.event_links to authenticated;
grant update (status) on public.rsvps to authenticated;
grant insert (club_id, project_id, body, visibility) on public.updates to authenticated;
grant update (body, visibility) on public.updates to authenticated;
grant delete on public.updates, public.media to authenticated;
grant insert (club_id, title) on public.threads to authenticated;
grant update (title, locked, deleted_at) on public.threads to authenticated;
grant insert (thread_id, body) on public.thread_posts to authenticated;
grant update (body) on public.thread_posts to authenticated;
grant insert, update, delete on public.resources to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;
grant insert (year, host_club_id, title, city, starts_on, ends_on, status) on public.conference_hubs to authenticated;
grant update (host_club_id, title, city, starts_on, ends_on, status) on public.conference_hubs to authenticated;
grant delete on public.conference_hubs to authenticated;
grant update (status) on public.contact_messages to authenticated;
grant insert, delete on public.flagged_words to authenticated;

-- ── Row-level security on every table ──────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.network_admins enable row level security;
alter table public.advisor_verifications enable row level security;
alter table public.clubs enable row level security;
alter table public.club_codes enable row level security;
alter table public.club_members enable row level security;
alter table public.consents enable row level security;
alter table public.invites enable row level security;
alter table public.conference_hubs enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_tasks enable row level security;
alter table public.events enable row level security;
alter table public.event_links enable row level security;
alter table public.rsvps enable row level security;
alter table public.updates enable row level security;
alter table public.media enable row level security;
alter table public.threads enable row level security;
alter table public.thread_posts enable row level security;
alter table public.resources enable row level security;
alter table public.reports enable row level security;
alter table public.audit_log enable row level security;
alter table public.notifications enable row level security;
alter table public.contact_messages enable row level security;
alter table public.flagged_words enable row level security;

-- profiles: self; admins. Made only by complete_signup() / redeem_invite(); deleted only by delete_my_account().
create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()) or app.is_admin());
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- network_admins: rows by SQL only (Luke). A person may see their own row, so the app can ask for the second factor.
create policy network_admins_select on public.network_admins for select to authenticated using (user_id = (select auth.uid()) or app.is_admin());

create policy advisor_verifications_select on public.advisor_verifications for select to authenticated using (user_id = (select auth.uid()) or app.is_admin());

-- clubs: anyone sees a listed club; members (and people whose request is waiting) their own; admins all.
create policy clubs_select_listed on public.clubs for select to anon, authenticated using (app.club_listed(id));
create policy clubs_select_own on public.clubs for select to authenticated using (app.is_member(id) or app.requested(id) or app.is_admin());
create policy clubs_update on public.clubs for update to authenticated using (app.is_staff(id) or app.is_admin()) with check (app.is_staff(id) or app.is_admin());

create policy club_codes_select on public.club_codes for select to authenticated using (app.is_staff(club_id) or app.is_admin());

-- club_members: your own rows; the club's staff see all of its rows; members see the active members; admins all.
create policy club_members_select on public.club_members for select to authenticated using (
  user_id = (select auth.uid()) or app.is_staff(club_id) or app.is_admin() or (status = 'active' and app.is_member(club_id))
);

create policy invites_select on public.invites for select to authenticated using (app.is_advisor(club_id) or app.is_admin());
create policy consents_select on public.consents for select to authenticated using (
  subject_user_id = (select auth.uid()) or app.is_advisor(club_id) or app.is_admin()
);

-- projects (§6).
create policy projects_select_public on public.projects for select to anon, authenticated using (
  visibility = 'public' and status in ('active', 'completed') and approved_at is not null and deleted_at is null and app.club_listed(club_id)
);
create policy projects_select_member on public.projects for select to authenticated using (
  deleted_at is null and app.is_member(club_id) and (status <> 'draft' or created_by = (select auth.uid()))
);
create policy projects_select_staff on public.projects for select to authenticated using (app.is_staff(club_id) or app.is_admin());
create policy projects_insert on public.projects for insert to authenticated with check (app.is_member(club_id) or app.is_admin());
create policy projects_update on public.projects for update to authenticated using (
  deleted_at is null and (
    (created_by = (select auth.uid()) and status in ('draft', 'proposed') and app.is_member(club_id))
    or (status in ('active', 'completed') and app.on_team(id) and app.is_member(club_id))
    or app.is_staff(club_id) or app.is_admin()
  )
) with check (app.is_member(club_id) or app.is_admin());

-- A project's team and checklist: read by the club's members (never by the public: names stay off public pages,
-- §8), written by the team and the staff.
create policy project_members_select on public.project_members for select to authenticated using (
  exists (select 1 from public.projects j where j.id = project_id and (app.is_member(j.club_id) or app.is_admin()))
);
create policy project_members_insert on public.project_members for insert to authenticated with check (
  exists (select 1 from public.projects j where j.id = project_id and (app.on_team(j.id) or app.is_staff(j.club_id) or app.is_admin()))
);
create policy project_members_update on public.project_members for update to authenticated
  using (exists (select 1 from public.projects j where j.id = project_id and (app.on_team(j.id) or app.is_staff(j.club_id) or app.is_admin())))
  with check (exists (select 1 from public.projects j where j.id = project_id and (app.on_team(j.id) or app.is_staff(j.club_id) or app.is_admin())));
create policy project_members_delete on public.project_members for delete to authenticated using (
  exists (select 1 from public.projects j where j.id = project_id and (app.on_team(j.id) or app.is_staff(j.club_id) or app.is_admin()))
);
create policy project_tasks_select on public.project_tasks for select to authenticated using (
  exists (select 1 from public.projects j where j.id = project_id and (app.is_member(j.club_id) or app.is_admin()))
);
create policy project_tasks_insert on public.project_tasks for insert to authenticated with check (
  exists (select 1 from public.projects j where j.id = project_id and (app.on_team(j.id) or app.is_staff(j.club_id) or app.is_admin()))
);
create policy project_tasks_update on public.project_tasks for update to authenticated
  using (exists (select 1 from public.projects j where j.id = project_id and (app.on_team(j.id) or app.is_staff(j.club_id) or app.is_admin())))
  with check (exists (select 1 from public.projects j where j.id = project_id and (app.on_team(j.id) or app.is_staff(j.club_id) or app.is_admin())));
create policy project_tasks_delete on public.project_tasks for delete to authenticated using (
  exists (select 1 from public.projects j where j.id = project_id and (app.on_team(j.id) or app.is_staff(j.club_id) or app.is_admin()))
);

-- events (§6).
create policy events_select_public on public.events for select to anon, authenticated using (
  visibility = 'public' and status = 'published'
  and ((club_id is not null and app.club_listed(club_id)) or (hub_id is not null and app.hub_live(hub_id)))
);
create policy events_select_member on public.events for select to authenticated using (
  (club_id is not null and app.is_member(club_id) and status in ('published', 'cancelled'))
  or (visibility = 'network' and status = 'published' and app.band() is not null)
);
create policy events_select_staff on public.events for select to authenticated using (
  (club_id is not null and app.is_staff(club_id)) or (hub_id is not null and app.is_hub_editor(hub_id)) or app.is_admin()
);
create policy events_insert on public.events for insert to authenticated with check (
  (club_id is not null and app.is_staff(club_id)) or (hub_id is not null and app.is_hub_editor(hub_id)) or app.is_admin()
);
create policy events_update on public.events for update to authenticated
  using ((club_id is not null and app.is_staff(club_id)) or (hub_id is not null and app.is_hub_editor(hub_id)) or app.is_admin())
  with check ((club_id is not null and app.is_staff(club_id)) or (hub_id is not null and app.is_hub_editor(hub_id)) or app.is_admin());

-- event_links: only for people going, and the hosts (§6).
create policy event_links_select on public.event_links for select to authenticated using (
  app.is_event_host(event_id) or app.is_admin()
  or exists (select 1 from public.rsvps r where r.event_id = event_links.event_id and r.user_id = (select auth.uid()) and r.status = 'going')
);
create policy event_links_insert on public.event_links for insert to authenticated with check (app.is_event_host(event_id) or app.is_admin());
create policy event_links_update on public.event_links for update to authenticated using (app.is_event_host(event_id) or app.is_admin()) with check (app.is_event_host(event_id) or app.is_admin());
create policy event_links_delete on public.event_links for delete to authenticated using (app.is_event_host(event_id) or app.is_admin());

-- rsvps: made by rsvp(); a person cancels their own; hosts see the list, never the public.
create policy rsvps_select on public.rsvps for select to authenticated using (user_id = (select auth.uid()) or app.is_event_host(event_id) or app.is_admin());
create policy rsvps_cancel on public.rsvps for update to authenticated
  using (user_id = (select auth.uid()) and status <> 'cancelled') with check (user_id = (select auth.uid()) and status = 'cancelled');

-- updates (§6).
create policy updates_select_public on public.updates for select to anon, authenticated using (
  visibility = 'public' and status = 'published' and approved_at is not null and app.club_listed(club_id)
);
create policy updates_select_member on public.updates for select to authenticated using (
  app.is_member(club_id) and (status = 'published' or author_id = (select auth.uid()))
);
create policy updates_select_staff on public.updates for select to authenticated using (app.is_staff(club_id) or app.is_admin());
create policy updates_insert on public.updates for insert to authenticated with check (
  app.is_member(club_id)
  and (project_id is null or exists (select 1 from public.projects j where j.id = project_id and j.club_id = updates.club_id))
);
create policy updates_update on public.updates for update to authenticated
  using (author_id = (select auth.uid()) and status in ('draft', 'pending') and app.is_member(club_id))
  with check (author_id = (select auth.uid()));
create policy updates_delete on public.updates for delete to authenticated using (author_id = (select auth.uid()));

-- media: written only by the upload route (secret key, after re-encoding); approved by advisors through
-- approve_content(); public only once an advisor approved it for public use.
create policy media_select_public on public.media for select to anon, authenticated using (is_public and status = 'approved' and app.club_listed(club_id));
create policy media_select_member on public.media for select to authenticated using (
  (status = 'approved' and app.is_member(club_id)) or uploader_id = (select auth.uid()) or app.is_staff(club_id) or app.is_admin()
);
create policy media_delete on public.media for delete to authenticated using (app.is_staff(club_id) or app.is_admin());

-- threads and posts: the club's members and its advisors (the advisor always sees). Admins read them only
-- through admin_read_threads(), which logs each read.
create policy threads_select on public.threads for select to authenticated using (app.is_member(club_id) and (deleted_at is null or app.is_staff(club_id)));
create policy threads_insert on public.threads for insert to authenticated with check (app.is_member(club_id));
create policy threads_update on public.threads for update to authenticated
  using (app.is_staff(club_id) or (created_by = (select auth.uid()) and created_at > now() - interval '15 minutes' and app.is_member(club_id)))
  with check (app.is_member(club_id));
create policy thread_posts_select on public.thread_posts for select to authenticated using (
  app.is_member(app.thread_club(thread_id))
  and (status = 'published' or author_id = (select auth.uid()) or app.is_staff(app.thread_club(thread_id)))
);
create policy thread_posts_insert on public.thread_posts for insert to authenticated with check (app.is_member(app.thread_club(thread_id)));
create policy thread_posts_update on public.thread_posts for update to authenticated
  using (author_id = (select auth.uid()) and created_at > now() - interval '15 minutes' and status <> 'hidden' and app.is_member(app.thread_club(thread_id)))
  with check (author_id = (select auth.uid()));

-- resources: everyone reads the published ones; admins curate.
create policy resources_select on public.resources for select to anon, authenticated using (status = 'published' or app.is_admin());
create policy resources_insert on public.resources for insert to authenticated with check (app.is_admin());
create policy resources_update on public.resources for update to authenticated using (app.is_admin()) with check (app.is_admin());
create policy resources_delete on public.resources for delete to authenticated using (app.is_admin());

-- reports: filed by the report route (file_report, secret key). The reporter sees their own; the club's advisors see
-- their club's, unless it's about an adult or about themselves; admins see all.
create policy reports_select on public.reports for select to authenticated using (
  reporter_id = (select auth.uid()) or app.is_admin()
  or (club_id is not null and app.is_advisor(club_id) and not about_adult and about_user_id is distinct from (select auth.uid()))
);

-- audit_log: admins read; nobody writes except app.log(); nobody changes or deletes (grants revoked, trigger raises).
create policy audit_log_select on public.audit_log for select to authenticated using (app.is_admin());

create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

-- conference_hubs: public when live; editors and admins see all; admins create and delete.
create policy hubs_select_live on public.conference_hubs for select to anon, authenticated using (status = 'live');
create policy hubs_select_editors on public.conference_hubs for select to authenticated using (app.is_hub_editor(id) or app.is_admin());
create policy hubs_insert on public.conference_hubs for insert to authenticated with check (app.is_admin());
create policy hubs_update on public.conference_hubs for update to authenticated using (app.is_hub_editor(id) or app.is_admin()) with check (app.is_hub_editor(id) or app.is_admin());
create policy hubs_delete on public.conference_hubs for delete to authenticated using (app.is_admin());

-- contact_messages: written by the contact route (secret key, after Turnstile); read by the club's advisors.
create policy contact_messages_select on public.contact_messages for select to authenticated using (app.is_advisor(club_id) or app.is_admin());
create policy contact_messages_update on public.contact_messages for update to authenticated using (app.is_advisor(club_id) or app.is_admin()) with check (app.is_advisor(club_id) or app.is_admin());

create policy flagged_words_admin on public.flagged_words for all to authenticated using (app.is_admin()) with check (app.is_admin());
