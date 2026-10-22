-- R1b · 3 of 5 · Writes that cross rules, and the triggers that hold direct writes to the same rules
-- (docs/07-APP-SPEC.md §4, §6, §7). Every function is SECURITY DEFINER with an empty search_path, checks the caller
-- itself, and writes audit_log through app.log(). Direct inserts into the tables these functions own are denied by
-- the grants and policies in 4 of 5.

create table app.counters (name text primary key, n bigint not null default 0);
comment on table app.counters is 'Counts without personal data, e.g. under-13 sign-ins declined (07 §4: "only a count is logged").';

-- ── Small helpers ──────────────────────────────────────────────────────────────────────────────────────────────
create or replace function app.slugify(p text) returns text
language sql immutable set search_path = '' as $$
  select left(trim(both '-' from regexp_replace(lower(translate(p,
    'ÁÀÂÄÃÅáàâäãåČĆÇčćçĎďÉÈÊËĚéèêëěĘęÍÌÎÏíìîïĽĹŁľĺłŇŃÑňńñÓÒÔÖÕŐóòôöõőŘŔřŕŠŚšśŤťÚÙÛÜŮŰúùûüůűÝýÿŽŹŻžźżĞğŞşİıȘșȚțĖėĄąĮįŲųŪū',
    'AAAAAAaaaaaaCCCcccDdEEEEEeeeeeEeIIIIiiiiLLLlllNNNnnnOOOOOOooooooRRrrSSssTtUUUUUUuuuuuuYyyZZZzzzGgSsIiSsTtEeAaIiUuUu')),
    '[^a-z0-9]+', '-', 'g')), 60)
$$;

-- An 8-character join code ("K7QD-M2PX") from letters and digits that can't be mistaken for each other.
create or replace function app.new_join_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  a constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := extensions.gen_random_bytes(8);
  s text := '';
begin
  for i in 0..7 loop
    s := s || substr(a, (get_byte(b, i) % 32) + 1, 1);
    if i = 3 then s := s || '-'; end if;
  end loop;
  return s;
end $$;

create or replace function app.hash_code(p text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex')
$$;

create or replace function app.hash_token(p text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(coalesce(p, ''), 'sha256'), 'hex')
$$;

create or replace function app.band_of(p_user uuid) returns public.age_band
language sql stable security definer set search_path = '' as $$
  select p.age_band from public.profiles p where p.id = p_user
$$;

create or replace function app.notify(p_user uuid, p_kind text, p_payload jsonb) returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, payload) select p_user, p_kind, coalesce(p_payload, '{}') where p_user is not null
$$;

-- Who must approve a post: nobody (published) or a person (pending). §6 updates: students' posts wait, unless the
-- club's advisor has switched pre-approval off AND the post is club-only text with no link or flagged word. An
-- advisor's own post needs nobody.
create or replace function app.post_status(p_club uuid, p_author uuid, p_visibility public.visibility, p_body text, p_photo boolean)
returns public.content_status
language sql stable security definer set search_path = '' as $$
  select case
    when exists (
      select 1 from public.club_members m join public.profiles p on p.id = m.user_id
      where m.club_id = p_club and m.user_id = p_author and m.status = 'active' and m.role = 'advisor' and p.is_verified_adult
    ) then 'published'::public.content_status
    when not (select c.pre_approval from public.clubs c where c.id = p_club)
      and p_visibility = 'club' and not p_photo and not app.has_link(p_body) and not app.has_flagged_word(p_body)
      then 'published'::public.content_status
    else 'pending'::public.content_status
  end
$$;

create or replace function app.deny(p_message text) returns void
language plpgsql set search_path = '' as $$
begin
  raise exception '%', p_message using errcode = '42501';
end $$;

-- ── Signing up (§4) ────────────────────────────────────────────────────────────────────────────────────────────
-- /welcome, after the code sign-in. Under 16 joins only through redeem_invite(); under 13 is decline_under_13().
create or replace function public.complete_signup(p_display_name text, p_age_band public.age_band, p_country text, p_accept_conduct boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then perform app.deny('sign in first'); end if;
  if exists (select 1 from public.profiles where id = v_uid) then perform app.deny('this account is already set up'); end if;
  if p_age_band = '13-15' then perform app.deny('under 16, an account starts from an advisor''s invite link'); end if;
  if not coalesce(p_accept_conduct, false) then raise exception 'the code of conduct must be accepted' using errcode = '22023'; end if;
  insert into public.profiles (id, display_name, age_band, country, conduct_accepted_at)
  values (v_uid, trim(p_display_name), p_age_band, upper(trim(p_country)), now());
  perform app.log('account.create', 'profile', v_uid, jsonb_build_object('band', p_age_band));
end $$;

-- "Under 13" on /welcome: the brand-new sign-in is deleted at once, and only a count is kept (§4).
create or replace function public.decline_under_13()
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then perform app.deny('sign in first'); end if;
  if exists (select 1 from public.profiles where id = v_uid) then perform app.deny('an existing account is deleted from the account page'); end if;
  insert into app.counters (name, n) values ('under_13_declined', 1) on conflict (name) do update set n = app.counters.n + 1;
  delete from auth.users where id = v_uid;
end $$;

-- 13–15 without an invite on /welcome: no account either (§4: under 16 joins only through an advisor's invite). The
-- brand-new sign-in is deleted and only a count is kept, as for under 13.
create or replace function public.decline_signup(p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if p_reason not in ('under_13', 'under_16_no_invite') then raise exception 'unknown reason' using errcode = '22023'; end if;
  if v_uid is null then perform app.deny('sign in first'); end if;
  if exists (select 1 from public.profiles where id = v_uid) then perform app.deny('an existing account is deleted from the account page'); end if;
  insert into app.counters (name, n) values ('signup_declined_' || p_reason, 1) on conflict (name) do update set n = app.counters.n + 1;
  delete from auth.users where id = v_uid;
end $$;

-- ── Clubs ──────────────────────────────────────────────────────────────────────────────────────────────────────
-- An adult becomes its advisor, a 16–17 student its lead; it stays pending until an admin verifies it (§3). Returns
-- the join code once; only its hash is stored.
create or replace function public.create_club(
  p_name text, p_school_name text, p_city text, p_country text, p_lat numeric, p_lng numeric,
  p_tz text default 'Europe/Budapest', p_strands public.strand[] default '{}', p_languages text[] default '{English}', p_description text default ''
) returns table (club_id uuid, slug text, join_code text)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_band public.age_band := app.band_of((select auth.uid()));
  v_role public.member_role;
  v_slug text := app.slugify(p_name);
  v_id uuid;
  v_code text := app.new_join_code();
  n int := 1;
begin
  if v_band is null then perform app.deny('finish signing up first'); end if;
  if v_band = '13-15' then perform app.deny('a club is started by a teacher, or by a student aged 16 or older'); end if;
  v_role := case when v_band = 'adult' then 'advisor' else 'lead' end;
  if v_slug = '' then v_slug := 'club'; end if;
  if exists (select 1 from public.clubs c where c.slug = v_slug) then v_slug := app.slugify(p_name || ' ' || p_city); end if;
  while exists (select 1 from public.clubs c where c.slug = v_slug) loop
    n := n + 1; v_slug := left(app.slugify(p_name || ' ' || p_city), 56) || '-' || n;
  end loop;
  insert into public.clubs (slug, name, school_name, city, country, lat, lng, tz, strands, languages, description)
  values (v_slug, trim(p_name), trim(p_school_name), trim(p_city), upper(trim(p_country)), round(p_lat, 2), round(p_lng, 2),
          coalesce(p_tz, 'Europe/Budapest'), coalesce(p_strands, '{}'), coalesce(p_languages, '{English}'), coalesce(p_description, ''))
  returning id into v_id;
  insert into public.club_members (club_id, user_id, role, status, joined_via, approved_at) values (v_id, v_uid, v_role, 'active', 'creator', now());
  insert into public.club_codes (club_id, code_hash) values (v_id, app.hash_code(v_code));
  perform app.log('club.create', 'club', v_id, jsonb_build_object('role', v_role));
  return query select v_id, v_slug, v_code;
end $$;

create or replace function public.rotate_join_code(p_club uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text := app.new_join_code();
begin
  if not coalesce(app.is_staff(p_club) or app.is_admin(), false) then perform app.deny('only the club''s lead or advisor can make a new code'); end if;
  insert into public.club_codes (club_id, code_hash, rotated_at) values (p_club, app.hash_code(v_code), now())
  on conflict (club_id) do update set code_hash = excluded.code_hash, rotated_at = now();
  perform app.log('club.code_rotate', 'club', p_club, '{}');
  return v_code;
end $$;

-- 16–17 only; the request waits for a lead or advisor (§3, §4). 13–15 join only by invite; adults by advisor invite.
create or replace function public.join_with_code(p_code text)
returns table (club_id uuid, club_slug text, status public.member_status)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_band public.age_band := app.band_of((select auth.uid()));
  v_club public.clubs%rowtype;
  v_member public.club_members%rowtype;
begin
  if v_band is null then perform app.deny('finish signing up first'); end if;
  if v_band <> '16-17' then perform app.deny('the club code is for students aged 16 or 17; others join through an invite'); end if;
  select c.* into v_club from public.clubs c join public.club_codes k on k.club_id = c.id where k.code_hash = app.hash_code(p_code);
  if v_club.id is null or v_club.status = 'suspended' then raise exception 'that code doesn''t match a club' using errcode = 'P0002'; end if;
  select * into v_member from public.club_members m where m.club_id = v_club.id and m.user_id = v_uid;
  if v_member.id is not null then
    if v_member.status = 'removed' then perform app.deny('this club has removed you; ask its advisor'); end if;
    if v_member.status in ('active', 'pending') then return query select v_club.id, v_club.slug, v_member.status; return; end if;
    update public.club_members m set status = 'pending', role = 'member', joined_via = 'code', approved_by = null, approved_at = null where m.id = v_member.id;
  else
    insert into public.club_members (club_id, user_id, role, status, joined_via) values (v_club.id, v_uid, 'member', 'pending', 'code');
  end if;
  perform app.notify(m.user_id, 'join.request', jsonb_build_object('club', v_club.slug))
  from public.club_members m where m.club_id = v_club.id and m.status = 'active' and m.role in ('lead', 'advisor');
  perform app.log('member.request', 'club', v_club.id, '{}');
  return query select v_club.id, v_club.slug, 'pending'::public.member_status;
end $$;

-- An advisor invites one student (or a co-advisor). Under 16, the parent's or school's authorisation is recorded
-- first (§4). Single use, bound to one club, 14 days. Returns the token once; only its hash is stored.
create or replace function public.create_invite(p_club uuid, p_band public.age_band, p_consent_method text default null)
returns table (invite_id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_consent uuid;
  v_id uuid;
  v_expires timestamptz;
begin
  if not coalesce(app.is_advisor(p_club) or app.is_admin(), false) then perform app.deny('only a verified advisor of this club can invite'); end if;
  if p_band = '13-15' then
    if p_consent_method is null or p_consent_method not in ('school_on_file', 'parent_email') then
      raise exception 'under 16: record how a parent or the school authorised this first' using errcode = '22023';
    end if;
    insert into public.consents (club_id, scope, method, recorded_by) values (p_club, 'join', p_consent_method, v_uid) returning id into v_consent;
  end if;
  insert into public.invites (club_id, created_by, token_hash, intended_band, consent_id)
  values (p_club, v_uid, app.hash_token(v_token), p_band, v_consent) returning id, invites.expires_at into v_id, v_expires;
  perform app.log('invite.create', 'invite', v_id, jsonb_build_object('band', p_band, 'consent', p_consent_method));
  return query select v_id, v_token, v_expires;
end $$;

create or replace function public.revoke_invite(p_invite uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_club uuid;
begin
  select club_id into v_club from public.invites where id = p_invite and used_at is null and revoked_at is null;
  if v_club is null then raise exception 'no open invite' using errcode = 'P0002'; end if;
  if not coalesce(app.is_advisor(v_club) or app.is_admin(), false) then perform app.deny('only a verified advisor of this club can cancel an invite'); end if;
  update public.invites set revoked_at = now() where id = p_invite;
  perform app.log('invite.revoke', 'invite', p_invite, '{}');
end $$;

-- Opening an invite link. A new account is made with the invite's age band (the profile fields come from the same
-- screen); an existing account must be in that band. The membership is active at once: the advisor already said yes.
create or replace function public.redeem_invite(p_token text, p_display_name text default null, p_country text default null, p_accept_conduct boolean default false)
returns table (club_id uuid, club_slug text)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.invites%rowtype;
  v_band public.age_band := app.band_of((select auth.uid()));
  v_role public.member_role;
  v_slug text;
begin
  if v_uid is null then perform app.deny('sign in first'); end if;
  select * into v_inv from public.invites i where i.token_hash = app.hash_token(p_token) for update;
  if v_inv.id is null or v_inv.used_at is not null or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception 'this invite link has expired or was already used; ask the advisor for a new one' using errcode = 'P0002';
  end if;
  if v_band is null then
    if not coalesce(p_accept_conduct, false) then raise exception 'the code of conduct must be accepted' using errcode = '22023'; end if;
    insert into public.profiles (id, display_name, age_band, country, conduct_accepted_at)
    values (v_uid, trim(p_display_name), v_inv.intended_band, upper(trim(p_country)), now());
    v_band := v_inv.intended_band;
    perform app.log('account.create', 'profile', v_uid, jsonb_build_object('band', v_band, 'via', 'invite'));
  elsif v_band <> v_inv.intended_band then
    perform app.deny('this invite is for a different age group; ask the advisor');
  end if;
  v_role := case when v_band = 'adult' then 'advisor' else 'member' end;
  insert into public.club_members (club_id, user_id, role, status, joined_via, approved_by, approved_at)
  values (v_inv.club_id, v_uid, v_role, 'active', 'invite', v_inv.created_by, now())
  on conflict on constraint club_members_club_id_user_id_key do update
    set status = 'active', role = excluded.role, joined_via = 'invite', approved_by = excluded.approved_by, approved_at = now()
    where public.club_members.status <> 'removed';
  if not exists (select 1 from public.club_members m where m.club_id = v_inv.club_id and m.user_id = v_uid and m.status = 'active') then
    perform app.deny('this club has removed you; ask its advisor');
  end if;
  update public.invites set used_by = v_uid, used_at = now() where id = v_inv.id;
  if v_inv.consent_id is not null then update public.consents set subject_user_id = v_uid where id = v_inv.consent_id and subject_user_id is null; end if;
  select c.slug into v_slug from public.clubs c where c.id = v_inv.club_id;
  perform app.log('invite.redeem', 'invite', v_inv.id, '{}');
  return query select v_inv.club_id, v_slug;
end $$;

-- Consent for the extras (§4): photos, public credit, the digest. Under 16 the advisor records the parent's or
-- school's authorisation; from 16 the student records their own.
create or replace function public.record_consent(p_club uuid, p_subject uuid, p_scope text, p_method text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_band public.age_band := app.band_of(p_subject);
  v_id uuid;
begin
  if p_scope not in ('photos', 'public_credit', 'digest') then raise exception 'unknown consent' using errcode = '22023'; end if;
  if not exists (select 1 from public.club_members m where m.club_id = p_club and m.user_id = p_subject and m.status = 'active') then
    perform app.deny('consent is recorded for a member of this club');
  end if;
  if p_subject = v_uid then
    if v_band = '13-15' or p_method <> 'self' then perform app.deny('under 16, the advisor records a parent''s or the school''s consent'); end if;
  else
    if not coalesce(app.is_advisor(p_club), false) then perform app.deny('only a verified advisor of this club records consent for a student'); end if;
    if v_band <> '13-15' or p_method not in ('school_on_file', 'parent_email') then perform app.deny('from 16, students give their own consent'); end if;
  end if;
  insert into public.consents (subject_user_id, club_id, scope, method, recorded_by) values (p_subject, p_club, p_scope, p_method, v_uid) returning id into v_id;
  perform app.log('consent.record', 'consent', v_id, jsonb_build_object('scope', p_scope, 'method', p_method));
  return v_id;
end $$;

create or replace function public.revoke_consent(p_consent uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_c public.consents%rowtype;
  v_id uuid;
begin
  select * into v_c from public.consents where id = p_consent;
  if v_c.id is null or v_c.revoked_at is not null or exists (select 1 from public.consents r where r.revokes = p_consent) then
    raise exception 'no consent to withdraw' using errcode = 'P0002';
  end if;
  if not coalesce(v_c.subject_user_id = v_uid or app.is_advisor(v_c.club_id) or app.is_admin(), false) then perform app.deny('not yours to withdraw'); end if;
  insert into public.consents (subject_user_id, club_id, scope, method, recorded_by, revoked_at, revokes)
  values (v_c.subject_user_id, v_c.club_id, v_c.scope, v_c.method, v_uid, now(), p_consent) returning id into v_id;
  perform app.log('consent.revoke', 'consent', p_consent, '{}');
  return v_id;
end $$;

-- ── Members (§3) ───────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.approve_member(p_member uuid, p_approve boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare v_m public.club_members%rowtype;
begin
  select * into v_m from public.club_members where id = p_member and status = 'pending' for update;
  if v_m.id is null then raise exception 'no request waiting' using errcode = 'P0002'; end if;
  if v_m.user_id = (select auth.uid()) then perform app.deny('nobody approves their own request'); end if;
  if not coalesce(app.is_advisor(v_m.club_id) or app.is_admin() or (app.role_in(v_m.club_id) = 'lead' and app.band_of(v_m.user_id) = '16-17'), false) then
    perform app.deny('a lead approves 16–17 requests; an advisor approves all');
  end if;
  if p_approve then
    update public.club_members set status = 'active', approved_by = (select auth.uid()), approved_at = now() where id = p_member;
  else
    update public.club_members set status = 'removed' where id = p_member;
  end if;
  perform app.notify(v_m.user_id, case when p_approve then 'join.approved' else 'join.declined' end, jsonb_build_object('club', v_m.club_id));
  perform app.log(case when p_approve then 'member.approve' else 'member.decline' end, 'club_member', p_member, '{}');
end $$;

-- Only advisors change roles or remove members (§3 note 1). Adults stay advisors; students are member or lead.
create or replace function public.set_member_role(p_member uuid, p_role public.member_role)
returns void language plpgsql security definer set search_path = '' as $$
declare v_m public.club_members%rowtype;
begin
  select * into v_m from public.club_members where id = p_member and status = 'active' for update;
  if v_m.id is null then raise exception 'no such member' using errcode = 'P0002'; end if;
  if not coalesce(app.is_advisor(v_m.club_id) or app.is_admin(), false) then perform app.deny('only an advisor changes roles'); end if;
  if v_m.user_id = (select auth.uid()) then perform app.deny('ask another advisor to change your own role'); end if;
  if p_role = 'advisor' or v_m.role = 'advisor' then perform app.deny('advisors are added by invite and verified'); end if;
  update public.club_members set role = p_role where id = p_member;
  perform app.notify(v_m.user_id, 'role.changed', jsonb_build_object('club', v_m.club_id, 'role', p_role));
  perform app.log('member.role', 'club_member', p_member, jsonb_build_object('role', p_role));
end $$;

create or replace function public.remove_member(p_member uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_m public.club_members%rowtype;
begin
  select * into v_m from public.club_members where id = p_member and status in ('active', 'pending') for update;
  if v_m.id is null then raise exception 'no such member' using errcode = 'P0002'; end if;
  if not coalesce(app.is_advisor(v_m.club_id) or app.is_admin(), false) then perform app.deny('only an advisor removes members'); end if;
  if v_m.user_id = (select auth.uid()) then perform app.deny('to leave, use Leave club'); end if;
  update public.club_members set status = 'removed' where id = p_member;
  perform app.log('member.remove', 'club_member', p_member, '{}');
end $$;

create or replace function public.leave_club(p_club uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.club_members set status = 'left' where club_id = p_club and user_id = (select auth.uid()) and status in ('active', 'pending');
  if not found then raise exception 'not a member' using errcode = 'P0002'; end if;
  perform app.log('member.leave', 'club', p_club, '{}');
end $$;

-- The settings and approvals pages' member list: the club's staff see names, roles and requests; only advisors and
-- admins also see age bands and countries (§8: "age band … the club's advisors, admins").
create or replace function public.club_roster(p_club uuid)
returns table (member_id uuid, user_id uuid, display_name text, role public.member_role, status public.member_status,
               joined_via text, joined_at timestamptz, age_band public.age_band, country text)
language sql stable security definer set search_path = '' as $$
  select m.id, m.user_id, p.display_name, m.role, m.status, m.joined_via, m.created_at,
    case when app.is_advisor(p_club) or app.is_admin() then p.age_band end,
    case when app.is_advisor(p_club) or app.is_admin() then p.country end
  from public.club_members m join public.profiles p on p.id = m.user_id
  where m.club_id = p_club and m.status in ('active', 'pending') and (app.is_staff(p_club) or app.is_admin())
  order by m.status desc, m.role desc, p.display_name
$$;

-- ── Approving content (§3, §7) ─────────────────────────────────────────────────────────────────────────────────
-- Leads approve club-only text and members' club-only proposals; advisors approve anything, every photo and
-- leads' own proposals; nobody approves their own.
create or replace function app.can_approve(p_club uuid, p_author uuid, p_club_only_text boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(p_author is distinct from (select auth.uid())
    and (app.is_advisor(p_club) or app.is_admin() or (p_club_only_text and app.role_in(p_club) = 'lead')), false)
$$;

create or replace function public.approve_content(p_kind text, p_id uuid, p_alt text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_club uuid; v_author uuid; v_ok boolean;
begin
  if p_kind = 'update' then
    select u.club_id, u.author_id, app.can_approve(u.club_id, u.author_id, u.visibility = 'club' and not u.has_photo)
      into v_club, v_author, v_ok from public.updates u where u.id = p_id and u.status = 'pending';
    if v_club is null then raise exception 'nothing waiting' using errcode = 'P0002'; end if;
    if not coalesce(v_ok, false) then perform app.deny('not yours to approve'); end if;
    update public.updates set status = 'published', approved_by = v_uid, approved_at = now() where id = p_id;
  elsif p_kind = 'thread_post' then
    select t.club_id, tp.author_id, app.can_approve(t.club_id, tp.author_id, true)
      into v_club, v_author, v_ok from public.thread_posts tp join public.threads t on t.id = tp.thread_id where tp.id = p_id and tp.status = 'pending';
    if v_club is null then raise exception 'nothing waiting' using errcode = 'P0002'; end if;
    if not coalesce(v_ok, false) then perform app.deny('not yours to approve'); end if;
    update public.thread_posts set status = 'published' where id = p_id;
  elsif p_kind = 'project' then
    -- A proposal, or an approved public project whose text was edited since (its approval was reset).
    select j.club_id, j.created_by,
           app.can_approve(j.club_id, j.created_by, j.visibility = 'club'
             and not exists (select 1 from public.club_members m where m.club_id = j.club_id and m.user_id = j.created_by and m.role = 'lead'))
      into v_club, v_author, v_ok
      from public.projects j where j.id = p_id and j.deleted_at is null and (j.status = 'proposed' or (j.status in ('active', 'completed') and j.approved_at is null));
    if v_club is null then raise exception 'nothing waiting' using errcode = 'P0002'; end if;
    if not coalesce(v_ok, false) then perform app.deny('not yours to approve'); end if;
    update public.projects set status = case when status = 'proposed' then 'active'::public.project_status else status end,
      approved_by = v_uid, approved_at = now() where id = p_id;
  elsif p_kind = 'event' then
    select e.club_id, e.created_by, app.can_approve(e.club_id, e.created_by, false)
      into v_club, v_author, v_ok from public.events e where e.id = p_id and e.status = 'pending';
    if v_author is null and v_club is null then raise exception 'nothing waiting' using errcode = 'P0002'; end if;
    if not coalesce(v_ok, false) then perform app.deny('only an advisor approves a public event'); end if;
    update public.events set status = 'published', approved_by = v_uid, approved_at = now() where id = p_id;
  elsif p_kind = 'media' then
    select m.club_id, m.uploader_id, app.can_approve(m.club_id, m.uploader_id, false)
      into v_club, v_author, v_ok from public.media m where m.id = p_id and m.status = 'pending';
    if v_club is null then raise exception 'nothing waiting' using errcode = 'P0002'; end if;
    if not coalesce(v_ok, false) then perform app.deny('only an advisor approves photos'); end if;
    update public.media set status = 'approved', approved_by = v_uid, alt = coalesce(nullif(trim(p_alt), ''), alt) where id = p_id;
  else
    raise exception 'unknown kind %', p_kind using errcode = '22023';
  end if;
  update public.clubs set last_active_at = now() where id = v_club;
  perform app.notify(v_author, 'content.approved', jsonb_build_object('kind', p_kind, 'id', p_id));
  perform app.log('content.approve', p_kind, p_id, '{}');
end $$;

-- "Send back with a note": the post or proposal goes back to its author as a draft, with the note.
create or replace function public.send_back(p_kind text, p_id uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_club uuid; v_author uuid; v_ok boolean;
begin
  if char_length(coalesce(p_note, '')) not between 1 and 500 then raise exception 'write a short note' using errcode = '22023'; end if;
  if p_kind = 'update' then
    select u.club_id, u.author_id, app.can_approve(u.club_id, u.author_id, u.visibility = 'club' and not u.has_photo)
      into v_club, v_author, v_ok from public.updates u where u.id = p_id and u.status = 'pending';
    if v_club is null then raise exception 'nothing waiting' using errcode = 'P0002'; end if;
    if not coalesce(v_ok, false) then perform app.deny('not yours to send back'); end if;
    update public.updates set status = 'draft' where id = p_id;
  elsif p_kind = 'project' then
    select j.club_id, j.created_by,
           app.can_approve(j.club_id, j.created_by, j.visibility = 'club'
             and not exists (select 1 from public.club_members m where m.club_id = j.club_id and m.user_id = j.created_by and m.role = 'lead'))
      into v_club, v_author, v_ok from public.projects j where j.id = p_id and j.status = 'proposed' and j.deleted_at is null;
    if v_club is null then raise exception 'nothing waiting' using errcode = 'P0002'; end if;
    if not coalesce(v_ok, false) then perform app.deny('not yours to send back'); end if;
    update public.projects set status = 'draft' where id = p_id;
  elsif p_kind = 'thread_post' then
    select t.club_id, tp.author_id, app.can_approve(t.club_id, tp.author_id, true)
      into v_club, v_author, v_ok from public.thread_posts tp join public.threads t on t.id = tp.thread_id where tp.id = p_id and tp.status = 'pending';
    if v_club is null then raise exception 'nothing waiting' using errcode = 'P0002'; end if;
    if not coalesce(v_ok, false) then perform app.deny('not yours to send back'); end if;
    update public.thread_posts set status = 'draft' where id = p_id;
  else
    raise exception 'unknown kind %', p_kind using errcode = '22023';
  end if;
  perform app.notify(v_author, 'content.sent_back', jsonb_build_object('kind', p_kind, 'id', p_id, 'note', p_note));
  perform app.log('content.send_back', p_kind, p_id, '{}');
end $$;

-- Hiding something: staff for their club, admins anywhere. The author gets the statement of reasons (§7; DSA Art. 17).
create or replace function public.hide_content(p_kind text, p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_club uuid; v_author uuid;
begin
  if char_length(coalesce(p_reason, '')) not between 1 and 1000 then raise exception 'give the reason' using errcode = '22023'; end if;
  if p_kind = 'update' then select club_id, author_id into v_club, v_author from public.updates where id = p_id;
  elsif p_kind = 'thread_post' then select t.club_id, tp.author_id into v_club, v_author from public.thread_posts tp join public.threads t on t.id = tp.thread_id where tp.id = p_id;
  elsif p_kind = 'thread' then select club_id, created_by into v_club, v_author from public.threads where id = p_id;
  elsif p_kind = 'project' then select club_id, created_by into v_club, v_author from public.projects where id = p_id;
  elsif p_kind = 'event' then select club_id, created_by into v_club, v_author from public.events where id = p_id;
  elsif p_kind = 'media' then select club_id, uploader_id into v_club, v_author from public.media where id = p_id;
  else raise exception 'unknown kind %', p_kind using errcode = '22023';
  end if;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  if not coalesce(app.is_admin() or (v_club is not null and app.is_staff(v_club)), false) then perform app.deny('only the club''s staff or an admin can hide this'); end if;
  if p_kind = 'update' then update public.updates set status = 'hidden' where id = p_id;
  elsif p_kind = 'thread_post' then update public.thread_posts set status = 'hidden' where id = p_id;
  elsif p_kind = 'thread' then update public.threads set deleted_at = now() where id = p_id;
  elsif p_kind = 'project' then update public.projects set deleted_at = now() where id = p_id;
  elsif p_kind = 'event' then update public.events set status = 'hidden' where id = p_id;
  else update public.media set status = 'hidden', is_public = false where id = p_id;
  end if;
  perform app.notify(v_author, 'content.hidden', jsonb_build_object('kind', p_kind, 'id', p_id, 'reason', p_reason));
  perform app.log('content.hide', p_kind, p_id, jsonb_build_object('reason', p_reason));
end $$;

-- Public, only by an advisor (§6 projects): making a project public is the advisor's approval of it for the public.
create or replace function public.set_project_visibility(p_project uuid, p_visibility public.visibility)
returns void language plpgsql security definer set search_path = '' as $$
declare v_j public.projects%rowtype;
begin
  select * into v_j from public.projects where id = p_project and deleted_at is null for update;
  if v_j.id is null then raise exception 'no such project' using errcode = 'P0002'; end if;
  if p_visibility = 'public' then
    if not coalesce(app.is_advisor(v_j.club_id) or app.is_admin(), false) then perform app.deny('only an advisor makes a project public'); end if;
    update public.projects set visibility = 'public',
      approved_by = case when status in ('active', 'completed') then (select auth.uid()) else approved_by end,
      approved_at = case when status in ('active', 'completed') then now() else approved_at end
    where id = p_project;
  elsif p_visibility = 'club' then
    if not coalesce(app.is_staff(v_j.club_id) or app.is_admin(), false) then perform app.deny('only the club''s staff change this'); end if;
    update public.projects set visibility = 'club' where id = p_project;
  else
    raise exception 'a project is public or club-only' using errcode = '22023';
  end if;
  perform app.log('project.visibility', 'project', p_project, jsonb_build_object('visibility', p_visibility));
end $$;

-- ── Events (§3, §6) ────────────────────────────────────────────────────────────────────────────────────────────
-- Going or not. Checks who may see the event and its capacity; past capacity, the RSVP joins the waitlist.
create or replace function public.rsvp(p_event uuid, p_going boolean default true)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_e public.events%rowtype;
  v_status text;
  v_going int;
begin
  if app.band_of(v_uid) is null then perform app.deny('sign in first'); end if;
  select * into v_e from public.events where id = p_event for update;
  if v_e.id is null or v_e.status <> 'published' or v_e.ends_at <= now() then raise exception 'this event isn''t open for RSVPs' using errcode = 'P0002'; end if;
  if not coalesce(
    (v_e.club_id is not null and app.is_member(v_e.club_id))
    or v_e.visibility = 'network'
    or (v_e.visibility = 'public' and ((v_e.club_id is not null and app.club_listed(v_e.club_id)) or (v_e.hub_id is not null and app.hub_live(v_e.hub_id))))
    or app.is_event_host(p_event), false
  ) then perform app.deny('this event is for its club''s members'); end if;
  if p_going then
    select count(*) into v_going from public.rsvps r where r.event_id = p_event and r.status = 'going' and r.user_id <> v_uid;
    v_status := case when v_e.capacity is not null and v_going >= v_e.capacity then 'waitlist' else 'going' end;
  else
    v_status := 'cancelled';
  end if;
  insert into public.rsvps (event_id, user_id, status) values (p_event, v_uid, v_status)
  on conflict on constraint rsvps_event_id_user_id_key do update set status = excluded.status;
  return v_status;
end $$;

-- How many are going (07 §6 rsvps: the list is for the hosts, never public; the count isn't personal and shows when an
-- event is full). Only for events the caller may see.
create or replace function public.going_counts(p_events uuid[])
returns table (event_id uuid, going integer)
language sql stable security definer set search_path = '' as $$
  select e.id, (select count(*)::int from public.rsvps r where r.event_id = e.id and r.status = 'going')
  from public.events e
  where e.id = any(p_events) and (
    (e.visibility = 'public' and e.status = 'published'
      and ((e.club_id is not null and app.club_listed(e.club_id)) or (e.hub_id is not null and app.hub_live(e.hub_id))))
    or (e.club_id is not null and app.is_member(e.club_id))
    or (e.visibility = 'network' and e.status = 'published' and app.band() is not null)
    or app.is_event_host(e.id) or app.is_admin()
  )
$$;

-- ── Network admins (§4) ────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.request_advisor_verification(p_club uuid, p_school_name text, p_school_domain text, p_second_role text, p_second_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  v_id uuid;
begin
  if app.band_of(v_uid) is distinct from 'adult' then perform app.deny('advisors are adults'); end if;
  if split_part(v_email, '@', 2) <> lower(p_school_domain) and split_part(v_email, '@', 2) not like '%.' || lower(p_school_domain) then
    perform app.deny('sign in with your school email address to be verified');
  end if;
  insert into public.advisor_verifications (user_id, club_id, school_name, school_domain, second_contact_role, second_contact_email)
  values (v_uid, p_club, trim(p_school_name), lower(p_school_domain), p_second_role, lower(p_second_email)) returning id into v_id;
  perform app.log('verification.request', 'advisor_verification', v_id, '{}');
  return v_id;
end $$;

-- Step 3: an admin approves. Verified for a year (§4 step 5); the second contact's email is deleted now (§5).
create or replace function public.verify_advisor(p_verification uuid, p_approve boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare v_v public.advisor_verifications%rowtype;
begin
  if not app.is_admin() then perform app.deny('network admins only, with the second factor'); end if;
  select * into v_v from public.advisor_verifications where id = p_verification and status = 'open' for update;
  if v_v.id is null then raise exception 'no open verification' using errcode = 'P0002'; end if;
  if p_approve then
    update public.profiles set is_verified_adult = true, verified_until = current_date + interval '1 year' where id = v_v.user_id;
    update public.advisor_verifications set status = 'approved', step = greatest(step, 3), second_contact_email = null where id = p_verification;
  else
    update public.advisor_verifications set status = 'rejected', second_contact_email = null where id = p_verification;
  end if;
  perform app.notify(v_v.user_id, case when p_approve then 'verification.approved' else 'verification.rejected' end, '{}');
  perform app.log(case when p_approve then 'verification.approve' else 'verification.reject' end, 'advisor_verification', p_verification, '{}');
end $$;

create or replace function public.verify_club(p_club uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_admin() then perform app.deny('network admins only, with the second factor'); end if;
  if not exists (
    select 1 from public.club_members m join public.profiles p on p.id = m.user_id
    where m.club_id = p_club and m.status = 'active' and m.role = 'advisor' and p.is_verified_adult
  ) then perform app.deny('a club is verified once its advisor is'); end if;
  update public.clubs set status = 'verified', verified_by = (select auth.uid()), verified_at = now() where id = p_club;
  if not found then raise exception 'no such club' using errcode = 'P0002'; end if;
  perform app.log('club.verify', 'club', p_club, '{}');
end $$;

create or replace function public.suspend_club(p_club uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_admin() then perform app.deny('network admins only, with the second factor'); end if;
  update public.clubs set status = 'suspended' where id = p_club;
  if not found then raise exception 'no such club' using errcode = 'P0002'; end if;
  perform app.log('club.suspend', 'club', p_club, jsonb_build_object('reason', p_reason));
end $$;

-- ── Reports (§7) ───────────────────────────────────────────────────────────────────────────────────────────────
-- Only the report route calls this (secret key, after Turnstile; it never fails closed). Finds the club and the
-- author, so advisors never handle a report about themselves, and child-safety reports reach the admins at once.
create or replace function public.file_report(p_target_type text, p_target_id uuid, p_reason text, p_details text, p_reporter uuid, p_unverified boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_club uuid; v_about uuid; v_adult boolean; v_id uuid; v_priority text := case when p_reason = 'child_safety' then 'child_safety' else 'normal' end;
begin
  case p_target_type
    when 'club' then v_club := p_target_id;
    when 'project' then select club_id, created_by into v_club, v_about from public.projects where id = p_target_id;
    when 'update' then select club_id, author_id into v_club, v_about from public.updates where id = p_target_id;
    when 'event' then select club_id, created_by into v_club, v_about from public.events where id = p_target_id;
    when 'thread' then select club_id, created_by into v_club, v_about from public.threads where id = p_target_id;
    when 'thread_post' then select t.club_id, tp.author_id into v_club, v_about from public.thread_posts tp join public.threads t on t.id = tp.thread_id where tp.id = p_target_id;
    when 'media' then select club_id, uploader_id into v_club, v_about from public.media where id = p_target_id;
    else null;
  end case;
  v_adult := coalesce(app.band_of(v_about) = 'adult', false);
  insert into public.reports (reporter_id, target_type, target_id, about_user_id, club_id, reason, details, priority, about_adult, unverified)
  values (p_reporter, p_target_type, p_target_id, v_about, v_club, p_reason, coalesce(p_details, ''), v_priority, v_adult, coalesce(p_unverified, false))
  returning id into v_id;
  if v_priority = 'child_safety' then
    perform app.notify(a.user_id, 'report.child_safety', jsonb_build_object('report', v_id)) from public.network_admins a;
  end if;
  return v_id;
end $$;

create or replace function public.handle_report(p_report uuid, p_status text, p_statement text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_r public.reports%rowtype;
begin
  if p_status not in ('triaged', 'actioned', 'dismissed') then raise exception 'unknown status' using errcode = '22023'; end if;
  select * into v_r from public.reports where id = p_report for update;
  if v_r.id is null then raise exception 'no such report' using errcode = 'P0002'; end if;
  if not coalesce(app.is_admin() or (v_r.club_id is not null and app.is_advisor(v_r.club_id) and not v_r.about_adult
          and v_r.about_user_id is distinct from (select auth.uid()) and v_r.priority = 'normal'), false) then
    perform app.deny('not yours to handle');
  end if;
  update public.reports set status = p_status, statement = coalesce(p_statement, statement), handled_by = (select auth.uid()), handled_at = now() where id = p_report;
  if p_status = 'actioned' then
    perform app.notify(v_r.about_user_id, 'report.statement', jsonb_build_object('report', p_report, 'statement', p_statement));
  end if;
  perform app.log('report.' || p_status, 'report', p_report, '{}');
end $$;

-- Admins read a club's threads only through here, so every read is logged (§3 "✓ (logged)").
create or replace function public.admin_read_threads(p_club uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_admin() then perform app.deny('network admins only, with the second factor'); end if;
  perform app.log('admin.read_threads', 'club', p_club, '{}');
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'locked', t.locked, 'created_at', t.created_at,
      'posts', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'author_id', p.author_id, 'body', p.body, 'status', p.status, 'created_at', p.created_at) order by p.created_at), '[]')
                from public.thread_posts p where p.thread_id = t.id)) order by t.created_at desc)
    from public.threads t where t.club_id = p_club), '[]');
end $$;

-- ── My data (§4) ───────────────────────────────────────────────────────────────────────────────────────────────
-- Immediate. Projects the user started stay with the club (created_by → null); reports they filed stay
-- (reporter → null); consent records stay for the retention period (subject → null); everything else of theirs goes
-- with the profile. Returns the storage paths of their photos, for the route to delete from the bucket.
create or replace function public.delete_my_account()
returns setof text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then perform app.deny('sign in first'); end if;
  return query select unnest(array[m.path_large, m.path_small]) from public.media m
    where m.uploader_id = v_uid or m.update_id in (select u.id from public.updates u where u.author_id = v_uid);
  delete from public.media m where m.uploader_id = v_uid or m.update_id in (select u.id from public.updates u where u.author_id = v_uid);
  perform app.log('account.delete', 'profile', v_uid, '{}');
  delete from auth.users where id = v_uid; -- cascades to the profile and everything that hangs from it
end $$;

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
    'rsvps', (select coalesce(jsonb_agg(jsonb_build_object('event', e.title, 'starts_at', e.starts_at, 'status', r.status)), '[]')
              from public.rsvps r join public.events e on e.id = r.event_id where r.user_id = v_uid),
    'updates', (select coalesce(jsonb_agg(jsonb_build_object('body', u.body, 'visibility', u.visibility, 'status', u.status, 'created_at', u.created_at)), '[]')
                from public.updates u where u.author_id = v_uid),
    'thread_posts', (select coalesce(jsonb_agg(jsonb_build_object('thread', t.title, 'body', tp.body, 'status', tp.status, 'created_at', tp.created_at)), '[]')
                     from public.thread_posts tp join public.threads t on t.id = tp.thread_id where tp.author_id = v_uid),
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

-- ── Triggers ───────────────────────────────────────────────────────────────────────────────────────────────────
-- They run as the person writing (not SECURITY DEFINER), so app.direct() tells a person's own write apart from the
-- functions above.

-- profiles: the age band only moves up; an adult band can't be taken while holding a student role.
create or replace function app.profiles_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if app.direct() then
    if new.age_band < old.age_band then raise exception 'the age band only moves up' using errcode = '42501'; end if;
    if new.age_band = 'adult' and old.age_band <> 'adult' and exists (
      select 1 from public.club_members m where m.user_id = new.id and m.status in ('active', 'pending') and m.role <> 'advisor'
    ) then raise exception 'leave your clubs as a student first, or ask your advisor' using errcode = '42501'; end if;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function app.profiles_guard();

-- clubs: a new school, city or country sends the club back to verification (§6). Only an advisor switches
-- pre-approval.
create or replace function app.clubs_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if app.direct() then
    if (new.school_name, new.city, new.country, new.lat, new.lng) is distinct from (old.school_name, old.city, old.country, old.lat, old.lng) then
      new.status := case when old.status = 'suspended' then 'suspended'::public.club_status else 'pending'::public.club_status end;
      new.verified_by := null; new.verified_at := null;
    end if;
    if new.pre_approval is distinct from old.pre_approval and not app.is_advisor(old.id) then
      raise exception 'only an advisor switches pre-approval' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger clubs_guard before update on public.clubs for each row execute function app.clubs_guard();

-- club_members: adults hold only the advisor role, students never (§3).
create or replace function app.members_guard() returns trigger language plpgsql set search_path = '' as $$
declare v_band public.age_band := app.band_of(new.user_id);
begin
  if v_band is null then raise exception 'a member needs an account profile' using errcode = '42501'; end if;
  if v_band = 'adult' and new.role <> 'advisor' then raise exception 'an adult joins only as an advisor' using errcode = '42501'; end if;
  if v_band <> 'adult' and new.role = 'advisor' then raise exception 'advisors are adults' using errcode = '42501'; end if;
  return new;
end $$;
create trigger members_guard before insert or update of role, user_id on public.club_members for each row execute function app.members_guard();

-- consents: append-only. The one change allowed is the subject being filled in when an invite is redeemed, or
-- cleared when that account is deleted.
create or replace function app.consents_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if app.outside() then raise exception 'consent records are append-only' using errcode = '42501'; end if;
  if tg_op = 'DELETE' then return old; end if; -- the retention job, or a club deleted by an admin in SQL
  if (new.club_id, new.scope, new.method, new.recorded_at, new.revoked_at, new.revokes) is distinct from
     (old.club_id, old.scope, old.method, old.recorded_at, old.revoked_at, old.revokes)
     or (new.subject_user_id is distinct from old.subject_user_id and old.subject_user_id is not null and new.subject_user_id is not null)
     or (new.recorded_by is distinct from old.recorded_by and new.recorded_by is not null)
  then raise exception 'consent records are append-only' using errcode = '42501'; end if;
  return new;
end $$;
create trigger consents_guard before update or delete on public.consents for each row execute function app.consents_guard();

-- audit_log: nobody edits it; rows go only after 24 months (§8 retention).
create or replace function app.audit_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and not app.outside() and old.at < now() - interval '24 months' then return old; end if;
  raise exception 'the audit log can''t be changed' using errcode = '42501';
end $$;
create trigger audit_guard before update or delete on public.audit_log for each row execute function app.audit_guard();

-- updates: who wrote it, whether it has a link, and whether it waits for a person (§6, §7).
create or replace function app.updates_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  new.has_link := app.has_link(new.body);
  if app.direct() then
    if tg_op = 'INSERT' then new.author_id := (select auth.uid()); new.has_photo := false; end if;
    new.approved_by := null; new.approved_at := null;
    new.status := app.post_status(new.club_id, new.author_id, new.visibility, new.body, new.has_photo);
    -- Only an advisor's post can be public at once: it is published by that advisor.
    if new.status = 'published' and new.visibility = 'public' then new.approved_by := new.author_id; new.approved_at := now(); end if;
  end if;
  return new;
end $$;
create trigger updates_guard before insert or update on public.updates for each row execute function app.updates_guard();

create or replace function app.thread_posts_guard() returns trigger language plpgsql set search_path = '' as $$
declare v_club uuid; v_locked boolean;
begin
  new.has_link := app.has_link(new.body);
  if app.direct() then
    select t.club_id, t.locked into v_club, v_locked from public.threads t where t.id = new.thread_id;
    if tg_op = 'INSERT' then
      if v_locked then raise exception 'this thread is locked' using errcode = '42501'; end if;
      new.author_id := (select auth.uid());
    end if;
    -- Luke, 11 Oct: club thread replies post at once; only a link or a flagged word waits for a person (§7).
    new.status := case
      when app.post_status(v_club, new.author_id, 'club', new.body, false) = 'published' then 'published'::public.content_status
      when app.has_link(new.body) or app.has_flagged_word(new.body) then 'pending'::public.content_status
      else 'published'::public.content_status
    end;
  end if;
  return new;
end $$;
create trigger thread_posts_guard before insert or update on public.thread_posts for each row execute function app.thread_posts_guard();

create or replace function app.threads_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if app.direct() and tg_op = 'INSERT' then new.created_by := (select auth.uid()); new.locked := false; new.deleted_at := null; end if;
  if app.direct() and tg_op = 'UPDATE' and (new.locked, new.deleted_at) is distinct from (old.locked, old.deleted_at) and not app.is_staff(old.club_id) then
    raise exception 'only the club''s staff lock or remove a thread' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger threads_guard before insert or update on public.threads for each row execute function app.threads_guard();

-- projects (§6): students start drafts and proposals; edits to an approved public project's text reset its
-- approval; only staff remove one (softly); approvals go through approve_content().
create or replace function app.projects_guard() returns trigger language plpgsql set search_path = '' as $$
declare v_advisor boolean;
begin
  if not app.direct() then return new; end if;
  v_advisor := app.is_advisor(new.club_id) or app.is_admin();
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid()); new.deleted_at := null;
    if new.status not in ('draft', 'proposed') and not v_advisor then raise exception 'a student''s project starts as a draft or proposal' using errcode = '42501'; end if;
    if v_advisor and new.status in ('active', 'completed') then new.approved_by := (select auth.uid()); new.approved_at := now();
    else new.approved_by := null; new.approved_at := null; end if;
    if new.visibility = 'public' and not v_advisor then new.approved_by := null; new.approved_at := null; end if;
    return new;
  end if;
  if new.status <> old.status and not v_advisor and not (
    (old.status in ('draft', 'proposed') and new.status in ('draft', 'proposed'))
    or (old.status in ('active', 'completed') and new.status in ('active', 'completed'))
  ) then raise exception 'approvals go through the approvals page' using errcode = '42501'; end if;
  if new.deleted_at is distinct from old.deleted_at and not (app.is_staff(old.club_id) or app.is_admin()) then
    raise exception 'only the club''s staff remove a project' using errcode = '42501';
  end if;
  if old.visibility = 'public' and old.approved_at is not null
     and (new.title, new.strand, new.problem, new.action, new.evidence, new.reflection) is distinct from (old.title, old.strand, old.problem, old.action, old.evidence, old.reflection)
  then new.approved_by := null; new.approved_at := null; end if;
  return new;
end $$;
create trigger projects_guard before insert or update on public.projects for each row execute function app.projects_guard();

-- The person who starts a project is on its team, as its owner.
create or replace function app.projects_owner() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null and exists (select 1 from public.club_members m where m.club_id = new.club_id and m.user_id = new.created_by and m.status = 'active') then
    insert into public.project_members (project_id, user_id, role) values (new.id, new.created_by, 'owner') on conflict do nothing;
  end if;
  update public.clubs set last_active_at = now() where id = new.club_id;
  return new;
end $$;
create trigger projects_owner after insert on public.projects for each row execute function app.projects_owner();

-- A team member must belong to the project's club.
create or replace function app.project_members_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.projects j join public.club_members m on m.club_id = j.club_id
    where j.id = new.project_id and m.user_id = new.user_id and m.status = 'active'
  ) then raise exception 'team members belong to the club' using errcode = '42501'; end if;
  return new;
end $$;
create trigger project_members_guard before insert or update on public.project_members for each row execute function app.project_members_guard();

-- events: a public event by a lead waits for an advisor (§3 "anything public needs the advisor"); staff cancel
-- rather than delete; only an approval publishes a waiting event.
create or replace function app.events_guard() returns trigger language plpgsql set search_path = '' as $$
declare v_advisor boolean;
begin
  if not app.direct() then return new; end if;
  v_advisor := app.is_admin() or (new.club_id is not null and app.is_advisor(new.club_id)) or (new.hub_id is not null and app.is_hub_editor(new.hub_id));
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.status := case when new.visibility = 'public' and not v_advisor then 'pending'::public.event_status else 'published'::public.event_status end;
    new.approved_by := case when new.status = 'published' and new.visibility = 'public' then (select auth.uid()) end;
    new.approved_at := case when new.status = 'published' and new.visibility = 'public' then now() end;
    return new;
  end if;
  if new.status <> old.status and not (
    new.status = 'cancelled' and old.status in ('published', 'pending')
    or (new.status = 'published' and old.status = 'cancelled' and (new.visibility <> 'public' or v_advisor))
    or (new.status = 'published' and old.status = 'pending' and v_advisor)
  ) then raise exception 'that change goes through an approval' using errcode = '42501'; end if;
  if new.visibility = 'public' and not v_advisor and new.status <> 'cancelled'
     and (old.visibility <> 'public' or (new.title, new.description, new.starts_at, new.ends_at, new.city, new.mode) is distinct from (old.title, old.description, old.starts_at, old.ends_at, old.city, old.mode))
  then new.status := 'pending'; new.approved_by := null; new.approved_at := null; end if;
  return new;
end $$;
create trigger events_guard before insert or update on public.events for each row execute function app.events_guard();

-- A cancelled place goes to the first person on the waitlist.
create or replace function app.rsvps_waitlist() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_next uuid;
begin
  if old.status = 'going' and new.status = 'cancelled' then
    select r.id into v_next from public.rsvps r where r.event_id = new.event_id and r.status = 'waitlist' order by r.created_at limit 1 for update;
    if v_next is not null then
      update public.rsvps set status = 'going' where id = v_next;
      perform app.notify((select r.user_id from public.rsvps r where r.id = v_next), 'rsvp.off_waitlist', jsonb_build_object('event', new.event_id));
    end if;
  end if;
  return new;
end $$;
create trigger rsvps_waitlist after update on public.rsvps for each row execute function app.rsvps_waitlist();

-- Club activity, for the directory's "recently active" order.
create or replace function app.touch_club() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.club_id is not null then update public.clubs set last_active_at = now() where id = new.club_id; end if;
  return new;
end $$;
create trigger updates_touch after insert on public.updates for each row execute function app.touch_club();
create trigger events_touch after insert on public.events for each row execute function app.touch_club();

-- ── Who may call what ──────────────────────────────────────────────────────────────────────────────────────────
revoke all on all functions in schema public from public, anon;
grant execute on function
  public.complete_signup(text, public.age_band, text, boolean), public.decline_under_13(), public.decline_signup(text),
  public.create_club(text, text, text, text, numeric, numeric, text, public.strand[], text[], text), public.rotate_join_code(uuid),
  public.join_with_code(text), public.create_invite(uuid, public.age_band, text), public.revoke_invite(uuid),
  public.redeem_invite(text, text, text, boolean), public.record_consent(uuid, uuid, text, text), public.revoke_consent(uuid),
  public.approve_member(uuid, boolean), public.set_member_role(uuid, public.member_role), public.remove_member(uuid), public.leave_club(uuid),
  public.approve_content(text, uuid, text), public.send_back(text, uuid, text), public.hide_content(text, uuid, text),
  public.set_project_visibility(uuid, public.visibility), public.rsvp(uuid, boolean),
  public.request_advisor_verification(uuid, text, text, text, text), public.verify_advisor(uuid, boolean), public.verify_club(uuid),
  public.suspend_club(uuid, text), public.handle_report(uuid, text, text), public.admin_read_threads(uuid),
  public.delete_my_account(), public.export_my_data(), public.club_roster(uuid)
to authenticated;
grant execute on function public.file_report(text, uuid, text, text, uuid, boolean) to service_role;
grant execute on function public.going_counts(uuid[]) to anon, authenticated;
revoke all on all functions in schema app from public;
grant execute on function app.aal2(), app.is_admin(), app.role_in(uuid), app.is_member(uuid), app.is_advisor(uuid), app.is_staff(uuid),
  app.club_listed(uuid), app.is_hub_editor(uuid), app.hub_live(uuid), app.is_event_host(uuid), app.on_team(uuid), app.band(),
  app.has_link(text), app.has_flagged_word(text), app.direct(), app.band_of(uuid), app.post_status(uuid, uuid, public.visibility, text, boolean)
to anon, authenticated, service_role;
