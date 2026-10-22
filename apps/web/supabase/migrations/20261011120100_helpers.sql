-- R1b · 2 of 5 · The helpers every access rule calls (docs/07-APP-SPEC.md §6).
-- SECURITY DEFINER, STABLE, search_path '' and in schema app, each reading (select auth.uid()) once: the policies
-- stay short, and a helper reads club_members without itself being filtered by club_members' own policies.
-- Every yes/no helper answers true or false, never NULL: inside a function, "if not (NULL) then deny" never denies
-- (found by the supabase-js suite, 11 Oct: a non-member could rotate a club's code). Functions also wrap their own
-- checks in coalesce(…, false).

create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

-- Advisor and admin powers need the second factor (§4: TOTP, "the policies check aal2").
create or replace function app.aal2() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
$$;

create or replace function app.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.aal2() and exists (select 1 from public.network_admins a where a.user_id = (select auth.uid()))
$$;

-- The caller's active role in a club, or null. "Own club" means an active membership (§3).
create or replace function app.role_in(p_club uuid) returns public.member_role
language sql stable security definer set search_path = '' as $$
  select m.role from public.club_members m
  where m.club_id = p_club and m.user_id = (select auth.uid()) and m.status = 'active'
$$;

-- A member reads their club. An adult (the advisor role) needs the second factor even to read: their account can see
-- minors' posts, so a stolen email code alone must not be enough (§4, §10 "admin and advisor powers require aal2").
create or replace function app.is_member(p_club uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case r when 'advisor' then app.aal2() else r is not null end from (select app.role_in(p_club) as r) x
$$;

-- An active advisor who is a verified adult, still within the yearly re-check, signed in with the second factor.
create or replace function app.is_advisor(p_club uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.aal2() and exists (
    select 1 from public.club_members m join public.profiles p on p.id = m.user_id
    where m.club_id = p_club and m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'advisor'
      and p.is_verified_adult and (p.verified_until is null or p.verified_until >= current_date)
  )
$$;

-- Staff = a lead, or an advisor whose powers work. An adult has no power before verification and aal2 (§3), so an
-- advisor who isn't verified yet counts as staff nowhere.
create or replace function app.is_staff(p_club uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.role_in(p_club) = 'lead', false) or app.is_advisor(p_club)
$$;

-- Listed = verified, an active student member, an approved project or an upcoming event (§3 note 2), and an advisor
-- whose yearly re-check hasn't lapsed (§4 step 5: "when it lapses, the club is unlisted").
create or replace function app.club_listed(p_club uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.clubs c where c.id = p_club and c.status = 'verified')
    and exists (select 1 from public.club_members m where m.club_id = p_club and m.status = 'active' and m.role in ('member', 'lead'))
    and exists (
      select 1 from public.club_members m join public.profiles p on p.id = m.user_id
      where m.club_id = p_club and m.status = 'active' and m.role = 'advisor' and p.is_verified_adult
        and (p.verified_until is null or p.verified_until >= current_date)
    )
    and (
      exists (select 1 from public.projects j where j.club_id = p_club and j.approved_at is not null and j.status in ('active', 'completed') and j.deleted_at is null)
      or exists (select 1 from public.events e where e.club_id = p_club and e.ends_at > now() and e.status = 'published')
    )
$$;

-- The conference hub's editors: the host club's verified advisors, once the hub has a host (§3).
create or replace function app.is_hub_editor(p_hub uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conference_hubs h where h.id = p_hub and h.host_club_id is not null and app.is_advisor(h.host_club_id))
$$;

create or replace function app.hub_live(p_hub uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conference_hubs h where h.id = p_hub and h.status = 'live')
$$;

-- An event's hosts: its club's staff, or the hub's editors.
create or replace function app.is_event_host(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event and ((e.club_id is not null and app.is_staff(e.club_id)) or (e.hub_id is not null and app.is_hub_editor(e.hub_id)))
  )
$$;

create or replace function app.on_team(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.project_members pm where pm.project_id = p_project and pm.user_id = (select auth.uid()))
$$;

create or replace function app.band() returns public.age_band
language sql stable security definer set search_path = '' as $$
  select p.age_band from public.profiles p where p.id = (select auth.uid())
$$;

-- The audit log's only way in (§6: "app.log() only"). Writes the caller as the actor.
create or replace function app.log(p_action text, p_target_type text, p_target_id uuid, p_details jsonb default '{}')
returns void language sql volatile security definer set search_path = '' as $$
  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'))
$$;

-- A post that must always wait for a person (§7): it has a link, or a word on the admins' list. Erring towards
-- holding: "word.word" counts as a link.
create or replace function app.has_link(p_text text) returns boolean
language sql immutable set search_path = '' as $$
  select p_text ~* '(https?://|www\.|\m[a-z0-9-]{2,}\.[a-z]{2,6}\M)'
$$;

create or replace function app.has_flagged_word(p_text text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.flagged_words w
    where lower(p_text) ~ ('(^|[^[:alnum:]])' || regexp_replace(w.word, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '($|[^[:alnum:]])')
  )
$$;

-- True when a person's own request is changing a row, false inside the SECURITY DEFINER functions below (they run
-- as the table owner). Guard triggers use it to hold people to the rules the functions apply for them. current_user
-- can't be faked from a session the way a setting could.
create or replace function app.direct() returns boolean
language sql stable set search_path = '' as $$
  select current_user in ('anon', 'authenticated')
$$;

-- For the append-only tables: any request from outside the database (a person, or the server's secret key) is
-- refused; only the owner's own jobs (retention, a cascade) may touch them.
create or replace function app.outside() returns boolean
language sql stable set search_path = '' as $$
  select current_user in ('anon', 'authenticated', 'service_role')
$$;

revoke all on all functions in schema app from public;
grant execute on function app.aal2(), app.is_admin(), app.role_in(uuid), app.is_member(uuid), app.is_advisor(uuid), app.is_staff(uuid),
  app.club_listed(uuid), app.is_hub_editor(uuid), app.hub_live(uuid), app.is_event_host(uuid), app.on_team(uuid), app.band(),
  app.has_link(text), app.has_flagged_word(text), app.direct(), app.outside() to anon, authenticated, service_role;
grant execute on function app.log(text, text, uuid, jsonb) to service_role;

-- Co-members see each other's display name only, and only through this view (§5 profiles).
create view public.club_member_names as
  select m.club_id, m.user_id, p.display_name, m.role
  from public.club_members m join public.profiles p on p.id = m.user_id
  where m.status = 'active' and (app.is_member(m.club_id) or app.is_admin());
comment on view public.club_member_names is
  'Runs with its owner''s rights on purpose: profiles stay private, and the where clause limits rows to the caller''s own clubs (07 §5).';
revoke all on public.club_member_names from public, anon;
grant select on public.club_member_names to authenticated;
