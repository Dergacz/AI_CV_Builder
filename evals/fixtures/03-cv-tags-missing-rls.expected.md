# 03 - New Table Without RLS

The reviewer must notice that `public.cv_tags` is created without
`alter table ... enable row level security` and without any policy, unlike `cvs`,
`feedback`, and `subscriptions`. The table is reachable through PostgREST with the
`authenticated` key, so any signed-in user can read and write someone else's tags.
`.eq("user_id", userId)` in the repository is defense in depth, not the access boundary.

Required action: enable RLS, add four per-operation `auth.uid() = user_id` policies, and
add a pgTAP test in `supabase/tests/database/` that impersonates another `user_id` and
really receives zero rows.
