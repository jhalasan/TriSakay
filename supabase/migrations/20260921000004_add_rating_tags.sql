-- UAT P16: Rate Driver only had a star rating + free-text comment, no
-- predefined feedback categories a passenger can tap instead of typing.
-- A fixed enum (not free-form text[]) keeps this reportable/filterable —
-- the whole point of "categories" over a comment field — and RLS is
-- unaffected: ratings_passenger_insert already checks only
-- passenger_id = auth.uid(), with no per-column restriction, so a
-- passenger inserting tags alongside stars/comment needs no policy change.
create type rating_tag as enum (
  'friendly',
  'safe_driving',
  'clean_vehicle',
  'on_time',
  'late',
  'rude',
  'unsafe_driving',
  'poor_vehicle_condition'
);

alter table public.ratings add column tags rating_tag[] not null default '{}';

comment on column public.ratings.tags is
  'Predefined feedback categories the passenger tapped (UAT P16) — independent of the free-text comment column, which stays optional either way.';
