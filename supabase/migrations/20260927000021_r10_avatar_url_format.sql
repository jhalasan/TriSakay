-- R10 (existing-system audit, UAT panel Adrales): `users.avatar_url` accepts
-- any string — uploadAvatar() (packages/services/src/storage/index.ts)
-- always produces a `.../storage/v1/object/public/avatars/{userId}/avatar.*`
-- URL, and storage RLS already restricts uploads to a user's own
-- `{auth.uid()}/*` folder, but nothing stopped a client calling
-- updateAvatarUrl() directly (bypassing uploadAvatar entirely) with an
-- arbitrary external URL — shown as-is to every driver/passenger/PSO who
-- views that profile. The `avatars` bucket being public (needed so the app
-- can render pictures without signing URLs) is what makes this matter: nothing
-- else in front of that column ever validated what it points to.
--
-- Verified live before writing this: every existing avatar_url already
-- matches this exact shape, so the constraint applies with zero violations.
alter table public.users add constraint users_avatar_url_format check (
  avatar_url is null
  or avatar_url like ('https://%/storage/v1/object/public/avatars/' || id::text || '/avatar.%')
);
