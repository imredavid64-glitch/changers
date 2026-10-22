-- R1b · 5 of 5 · Photo storage (docs/07-APP-SPEC.md §6 Storage, §8 Images).
-- club-media is private: paths are clubs/{club_id}/{media_id}-{large|small}.webp and members get signed URLs.
-- public-media gets a copy only after an advisor approves the photo for public use.
-- Nobody uploads from the browser: there is no insert, update or delete policy on storage.objects for anon or
-- authenticated. The upload route does it with the secret key, after sign-in, the rate limit and Turnstile, re-encoding
-- with sharp (which drops EXIF and GPS) into two WebP sizes.

insert into storage.buckets (id, name, public) values ('club-media', 'club-media', false), ('public-media', 'public-media', true)
on conflict (id) do nothing;

-- A signed URL needs read access to the object: the club's members for approved photos, the uploader for their own,
-- the club's staff and admins for all (the same people who can read the media row).
create policy club_media_read on storage.objects for select to authenticated using (
  bucket_id = 'club-media' and exists (
    select 1 from public.media m
    where (m.path_large = storage.objects.name or m.path_small = storage.objects.name)
      and ((m.status = 'approved' and app.is_member(m.club_id)) or m.uploader_id = (select auth.uid()) or app.is_staff(m.club_id) or app.is_admin())
  )
);
