-- Jalankan sekali di Supabase Dashboard -> SQL Editor.
create table if not exists public.reader_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.reader_interactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id text not null,
  title text not null,
  url text not null,
  date timestamptz not null,
  source text not null,
  topic text not null,
  rating smallint check (rating between 1 and 5),
  saved boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

alter table public.reader_settings enable row level security;
alter table public.reader_interactions enable row level security;

revoke all on public.reader_settings from anon, authenticated;
revoke all on public.reader_interactions from anon, authenticated;
grant select, insert, update, delete on public.reader_settings to authenticated;
grant select, insert, update, delete on public.reader_interactions to authenticated;

create policy "settings_select_own" on public.reader_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "settings_insert_own" on public.reader_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "settings_update_own" on public.reader_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "settings_delete_own" on public.reader_settings for delete to authenticated using ((select auth.uid()) = user_id);

create policy "interactions_select_own" on public.reader_interactions for select to authenticated using ((select auth.uid()) = user_id);
create policy "interactions_insert_own" on public.reader_interactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "interactions_update_own" on public.reader_interactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "interactions_delete_own" on public.reader_interactions for delete to authenticated using ((select auth.uid()) = user_id);
