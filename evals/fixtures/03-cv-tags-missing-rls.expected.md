# 03 — новая таблица без RLS

Ревьюер обязан заметить: `public.cv_tags` создана без `alter table ... enable row level
security` и без единой политики — в отличие от `cvs`, `feedback` и `subscriptions`. Таблица
доступна через PostgREST под ключом `authenticated`, поэтому любой залогиненный пользователь
читает и пишет чужие теги; `.eq("user_id", userId)` в репозитории — это только
defense-in-depth, а не граница.

Требуемое действие: включить RLS + четыре per-operation политики `auth.uid() = user_id`
и добавить pgTAP-тест в `supabase/tests/database/`, который под чужим `user_id` реально
получает 0 строк.
