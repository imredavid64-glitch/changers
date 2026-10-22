-- The test world for the access-rule checks: one person per actor in docs/07-APP-SPEC.md §6 Tests, three clubs and
-- one row of every kind. Made-up people on example.test only. Loaded as the database owner (rules don't apply here).
--   Club A: verified and listed. advisor (verified adult), lead (16–17), member_1617, member_1415 (invited, consent on
--           file), and a 16–17 request still waiting.
--   Club B: verified and listed, with its own advisor and other_member.
--   Club C: pending, started by unverified_adult.

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'advisor@example.test'),
  ('a0000000-0000-4000-8000-000000000002', 'lead@example.test'),
  ('a0000000-0000-4000-8000-000000000003', 'member1617@example.test'),
  ('a0000000-0000-4000-8000-000000000004', 'member1415@example.test'),
  ('a0000000-0000-4000-8000-000000000005', 'unverified@school-c.example.test'),
  ('a0000000-0000-4000-8000-000000000006', 'other@example.test'),
  ('a0000000-0000-4000-8000-000000000007', 'admin@example.test'),
  ('a0000000-0000-4000-8000-000000000008', 'advisor-b@example.test'),
  ('a0000000-0000-4000-8000-000000000009', 'waiting@example.test'),
  ('a0000000-0000-4000-8000-00000000000a', 'new-adult@school-a.example.test'),
  ('a0000000-0000-4000-8000-00000000000b', 'new-student@example.test'),
  ('a0000000-0000-4000-8000-00000000000c', 'under13@example.test');

insert into public.profiles (id, display_name, age_band, country, is_verified_adult, verified_until, conduct_accepted_at) values
  ('a0000000-0000-4000-8000-000000000001', 'Ada A.', 'adult', 'HU', true, current_date + 300, now()),
  ('a0000000-0000-4000-8000-000000000002', 'Lea L.', '16-17', 'HU', false, null, now()),
  ('a0000000-0000-4000-8000-000000000003', 'Mia M.', '16-17', 'HU', false, null, now()),
  ('a0000000-0000-4000-8000-000000000004', 'Noa N.', '13-15', 'HU', false, null, now()),
  ('a0000000-0000-4000-8000-000000000005', 'Uma U.', 'adult', 'PL', false, null, now()),
  ('a0000000-0000-4000-8000-000000000006', 'Oto O.', '16-17', 'LT', false, null, now()),
  ('a0000000-0000-4000-8000-000000000007', 'Ari A.', 'adult', 'HU', true, current_date + 300, now()),
  ('a0000000-0000-4000-8000-000000000008', 'Bea B.', 'adult', 'LT', true, current_date + 300, now()),
  ('a0000000-0000-4000-8000-000000000009', 'Wil W.', '16-17', 'HU', false, null, now());

insert into public.network_admins (user_id) values ('a0000000-0000-4000-8000-000000000007');

insert into public.clubs (id, slug, name, school_name, city, country, lat, lng, tz, strands, languages, description, status, verified_at, pre_approval) values
  ('c0000000-0000-4000-8000-000000000001', 'test-club-a', 'Test Club A', 'Test School A', 'Budapest', 'HU', 47.50, 19.04, 'Europe/Budapest', '{nature,society}', '{English,Hungarian}', 'Club A', 'verified', now(), true),
  ('c0000000-0000-4000-8000-000000000002', 'test-club-b', 'Test Club B', 'Test School B', 'Kaunas', 'LT', 54.90, 23.89, 'Europe/Vilnius', '{economy}', '{English}', 'Club B', 'verified', now(), true),
  ('c0000000-0000-4000-8000-000000000003', 'test-club-c', 'Test Club C', 'Test School C', 'Kraków', 'PL', 50.06, 19.94, 'Europe/Warsaw', '{wellbeing}', '{English}', 'Club C', 'pending', null, true);

insert into public.club_members (id, club_id, user_id, role, status, joined_via, approved_at) values
  ('24000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'advisor', 'active', 'creator', now()),
  ('24000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'lead', 'active', 'code', now()),
  ('24000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'member', 'active', 'code', now()),
  ('24000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'member', 'active', 'invite', now()),
  ('24000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000009', 'member', 'pending', 'code', null),
  ('24000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000008', 'advisor', 'active', 'creator', now()),
  ('24000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000006', 'member', 'active', 'code', now()),
  ('24000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000005', 'advisor', 'active', 'creator', now());

insert into public.club_codes (club_id, code_hash) values
  ('c0000000-0000-4000-8000-000000000001', app.hash_code('TEST-AAAA')),
  ('c0000000-0000-4000-8000-000000000003', app.hash_code('TEST-CCCC'));

insert into public.advisor_verifications (id, user_id, club_id, school_name, school_domain, second_contact_role, second_contact_email) values
  ('20000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000003', 'Test School C', 'school-c.example.test', 'Head', 'head@school-c.example.test');

insert into public.consents (id, subject_user_id, club_id, scope, method, recorded_by) values
  ('18000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'join', 'school_on_file', 'a0000000-0000-4000-8000-000000000001'),
  ('18000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'photos', 'parent_email', 'a0000000-0000-4000-8000-000000000001');

insert into public.invites (id, club_id, created_by, token_hash, intended_band) values
  ('19000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', app.hash_token('test-token-1617'), '16-17');

insert into public.conference_hubs (id, year, host_club_id, title, city, starts_on, ends_on, status) values
  ('16000000-0000-4000-8000-000000000001', 2027, 'c0000000-0000-4000-8000-000000000001', 'Test Conference 2027', 'Budapest', current_date + 60, current_date + 62, 'live'),
  ('16000000-0000-4000-8000-000000000002', 2028, 'c0000000-0000-4000-8000-000000000001', 'Test Conference 2028', 'Budapest', current_date + 400, current_date + 402, 'hidden');

insert into public.projects (id, club_id, title, strand, problem, status, visibility, approved_by, approved_at, created_by) values
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Public project', 'nature', 'Plastic', 'active', 'public', 'a0000000-0000-4000-8000-000000000001', now(), 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Club project', 'society', 'Lonely lunches', 'active', 'club', 'a0000000-0000-4000-8000-000000000001', now(), 'a0000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'Proposed project', 'nature', 'Paper', 'proposed', 'club', null, null, 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'Draft project', 'wellbeing', 'Exams', 'draft', 'club', null, null, 'a0000000-0000-4000-8000-000000000004'),
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002', 'Club B project', 'economy', 'Repair', 'active', 'club', 'a0000000-0000-4000-8000-000000000008', now(), 'a0000000-0000-4000-8000-000000000006');

insert into public.project_tasks (id, project_id, title) values
  ('22000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Ask the canteen');

insert into public.events (id, club_id, hub_id, title, strand, starts_at, ends_at, tz, mode, city, capacity, visibility, status, created_by, approved_by, approved_at) values
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', null, 'Public event', 'nature', now() + interval '10 days', now() + interval '10 days 2 hours', 'Europe/Budapest', 'in_person', 'Budapest', null, 'public', 'published', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', now()),
  ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', null, 'Club event', 'society', now() + interval '5 days', now() + interval '5 days 2 hours', 'Europe/Budapest', 'in_person', 'Budapest', 2, 'club', 'published', 'a0000000-0000-4000-8000-000000000002', null, null),
  ('e0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', null, 'Waiting public event', 'society', now() + interval '20 days', now() + interval '20 days 2 hours', 'Europe/Budapest', 'online', 'Budapest', null, 'public', 'pending', 'a0000000-0000-4000-8000-000000000002', null, null),
  ('e0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', null, 'Club B event', 'economy', now() + interval '6 days', now() + interval '6 days 2 hours', 'Europe/Vilnius', 'in_person', 'Kaunas', null, 'club', 'published', 'a0000000-0000-4000-8000-000000000008', null, null),
  ('e0000000-0000-4000-8000-000000000005', null, '16000000-0000-4000-8000-000000000001', 'Hub opening', null, now() + interval '60 days', now() + interval '60 days 3 hours', 'Europe/Budapest', 'in_person', 'Budapest', null, 'public', 'published', 'a0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000007', now());

insert into public.event_links (event_id, online_url, place_detail) values
  ('e0000000-0000-4000-8000-000000000002', 'https://meet.example.test/club-a', 'Room 12'),
  ('e0000000-0000-4000-8000-000000000003', 'https://meet.example.test/waiting', null);

insert into public.rsvps (id, event_id, user_id, status) values
  ('23000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', 'going');

insert into public.updates (id, club_id, author_id, body, visibility, status, approved_by, approved_at, created_at) values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'Public update', 'public', 'published', 'a0000000-0000-4000-8000-000000000001', now(), now() - interval '2 days'),
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'Club update', 'club', 'published', 'a0000000-0000-4000-8000-000000000002', now(), now() - interval '1 day'),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'Waiting update', 'club', 'pending', null, null, now()),
  ('d0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000006', 'Club B update', 'club', 'published', 'a0000000-0000-4000-8000-000000000008', now(), now()),
  ('d0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Advisor update', 'club', 'published', null, null, now());

insert into public.media (id, club_id, uploader_id, path_large, path_small, width, height, alt, status, is_public, approved_by) values
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003',
   'clubs/c0000000-0000-4000-8000-000000000001/f0000000-0000-4000-8000-000000000001-large.webp', 'clubs/c0000000-0000-4000-8000-000000000001/f0000000-0000-4000-8000-000000000001-small.webp',
   1600, 1200, 'The swap table', 'approved', false, 'a0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003',
   'clubs/c0000000-0000-4000-8000-000000000001/f0000000-0000-4000-8000-000000000002-large.webp', 'clubs/c0000000-0000-4000-8000-000000000001/f0000000-0000-4000-8000-000000000002-small.webp',
   1600, 1200, 'Boxes of bottles', 'approved', true, 'a0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003',
   'clubs/c0000000-0000-4000-8000-000000000001/f0000000-0000-4000-8000-000000000003-large.webp', 'clubs/c0000000-0000-4000-8000-000000000001/f0000000-0000-4000-8000-000000000003-small.webp',
   1600, 1200, '', 'pending', false, null);

insert into storage.buckets (id, name, public) values ('club-media', 'club-media', false), ('public-media', 'public-media', true) on conflict do nothing;
insert into storage.objects (bucket_id, name) values
  ('club-media', 'clubs/c0000000-0000-4000-8000-000000000001/f0000000-0000-4000-8000-000000000001-large.webp'),
  ('club-media', 'clubs/c0000000-0000-4000-8000-000000000001/f0000000-0000-4000-8000-000000000003-large.webp');

insert into public.threads (id, club_id, title, created_by, created_at) values
  ('10000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Swap table rota', 'a0000000-0000-4000-8000-000000000002', now() - interval '1 day'),
  ('10000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'Club B thread', 'a0000000-0000-4000-8000-000000000006', now() - interval '1 day');
insert into public.thread_posts (id, thread_id, author_id, body, status, created_at) values
  ('11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'Who can do Monday?', 'published', now() - interval '1 day'),
  ('11000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'I can!', 'pending', now());

insert into public.resources (id, strand, title, url, source_name, status) values
  ('12000000-0000-4000-8000-000000000001', 'nature', 'Waste audit guide', 'https://example.test/audit', 'Example', 'published'),
  ('12000000-0000-4000-8000-000000000002', 'nature', 'Draft guide', 'https://example.test/draft', 'Example', 'draft');

insert into public.reports (id, reporter_id, target_type, target_id, about_user_id, club_id, reason, priority, about_adult) values
  ('13000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'update', 'd0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'bullying', 'normal', false),
  ('13000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000004', 'update', 'd0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'child_safety', 'child_safety', true);

insert into public.audit_log (id, actor_id, action, target_type, target_id) values
  ('14000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000007', 'club.verify', 'club', 'c0000000-0000-4000-8000-000000000001');
insert into public.notifications (id, user_id, kind) values
  ('15000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'content.approved');
insert into public.contact_messages (id, club_id, sender_name, sender_email, body) values
  ('17000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'A parent', 'parent@example.test', 'Hello');
insert into public.flagged_words (word) values ('badword');

-- R1b · 6 (club features, 12 Oct): impact numbers, a project link, a follow, a poll and a vote.
insert into public.project_impacts (id, project_id, label, value, unit, how) values
  ('25000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'plastic bottles not thrown away', 412, '', 'counted at the swap table'),
  ('25000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'students at lunch', 30, 'people', 'a sign-in sheet');
insert into public.project_links (id, project_id, label, url) values
  ('26000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Our plan', 'https://docs.example.test/plan');
insert into public.club_follows (user_id, club_id) values ('a0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001');
insert into public.polls (id, thread_id, question, options) values
  ('27000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Which day works?', array['Monday', 'Wednesday']);
insert into public.poll_votes (poll_id, user_id, choice) values ('27000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 1);
