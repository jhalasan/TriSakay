# Staged migrations

Files here are deliberately **not** in `supabase/migrations/`, so `supabase db push` can never apply them by accident.
Each one waits for a specific go-ahead; move it into `supabase/migrations/` (with the timestamp named in its header) only then.

