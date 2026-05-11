alter table public.matchmaking_lobby_members
add column if not exists updated_at timestamptz not null default now();
