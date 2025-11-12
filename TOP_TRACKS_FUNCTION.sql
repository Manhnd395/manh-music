-- Create a SECURITY DEFINER function to return global top tracks (bypasses RLS for history)
-- Run this in Supabase SQL editor as a superuser or the table owner.
-- It aggregates total play counts across all users safely and returns track details.

create or replace function public.get_top_tracks(limit_count integer default 10)
returns table (
  track_id uuid,
  total_play bigint,
  title text,
  artist text,
  cover_url text,
  file_url text
)
language sql
security definer
set search_path = public
as $$
  select t.id as track_id,
         coalesce(sum(h.play_count), 0) as total_play,
         t.title,
         t.artist,
         t.cover_url,
         t.file_url
  from public.tracks t
  left join public.history h on h.track_id = t.id
  group by t.id, t.title, t.artist, t.cover_url, t.file_url
  order by total_play desc
  limit limit_count;
$$;

-- Grant execute to authenticated and anon (read-only)
grant execute on function public.get_top_tracks(integer) to anon, authenticated;
