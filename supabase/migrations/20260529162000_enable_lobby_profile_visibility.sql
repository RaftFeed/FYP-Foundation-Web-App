-- Allow authenticated users to read public profile names and active lobby membership rows.
-- This fixes lobby creator/member visibility and keeps counts consistent across accounts.

alter table public.profiles
add column if not exists image_url text;

update public.profiles as p
set email = nullif(btrim(coalesce(p.email, u.email)), ''),
    image_url = coalesce(
      nullif(btrim(p.image_url), ''),
      nullif(btrim(u.raw_user_meta_data ->> 'custom_avatar_url'), ''),
      nullif(btrim(u.raw_user_meta_data ->> 'avatar_url'), ''),
      nullif(btrim(u.raw_user_meta_data ->> 'picture'), '')
    )
from auth.users as u
where p.id = u.id
  and (p.email is null or btrim(p.email) = '');

update public.profiles
set full_name = coalesce(nullif(btrim(full_name), ''), nullif(btrim(email), ''), 'Unknown')
where full_name is null or btrim(full_name) = '';

update public.profiles as p
set image_url = coalesce(
  nullif(btrim(p.image_url), ''),
  nullif(btrim(u.raw_user_meta_data ->> 'custom_avatar_url'), ''),
  nullif(btrim(u.raw_user_meta_data ->> 'avatar_url'), ''),
  nullif(btrim(u.raw_user_meta_data ->> 'picture'), '')
)
from auth.users as u
where p.id = u.id
  and (p.image_url is null or btrim(p.image_url) = '');

alter table public.profiles enable row level security;

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = nullif(btrim(coalesce(email, new.email)), ''),
      full_name = coalesce(
        nullif(btrim(full_name), ''),
        nullif(btrim(coalesce(email, new.email)), ''),
        'Unknown'
      ),
      image_url = coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'custom_avatar_url'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'picture'), ''),
        nullif(btrim(image_url), '')
      )
  where id = new.id;

  if not found then
    insert into public.profiles (id, email, full_name, image_url, role)
    values (
      new.id,
      new.email,
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
        nullif(btrim(new.email), ''),
        'Unknown'
      ),
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'custom_avatar_url'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'picture'), '')
      ),
      coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'student'::user_role)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profiles on auth.users;
create trigger on_auth_user_created_profiles
after insert or update on auth.users
for each row
execute function public.sync_profile_from_auth_user();

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
on public.profiles
for select
to authenticated
using (true);

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.profiles as current_user_profile
    where current_user_profile.id = auth.uid()
      and current_user_profile.role = 'admin'
  )
)
with check (
  id = auth.uid()
  or exists (
    select 1
    from public.profiles as current_user_profile
    where current_user_profile.id = auth.uid()
      and current_user_profile.role = 'admin'
  )
);

alter table public.matchmaking_lobby_members enable row level security;

drop policy if exists matchmaking_lobby_members_select_authenticated on public.matchmaking_lobby_members;
create policy matchmaking_lobby_members_select_authenticated
on public.matchmaking_lobby_members
for select
to authenticated
using (status = 'active');

drop policy if exists matchmaking_lobby_members_update_own on public.matchmaking_lobby_members;
create policy matchmaking_lobby_members_update_own
on public.matchmaking_lobby_members
for update
to authenticated
using (student_id = auth.uid() and status = 'active')
with check (student_id = auth.uid());

create or replace function public.kick_matchmaking_lobby_member(
  p_lobby_id uuid,
  p_student_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.matchmaking_lobbies as lobby
    where lobby.id = p_lobby_id
      and lobby.creator_id = auth.uid()
  ) then
    raise exception 'Only the lobby creator can remove members';
  end if;

  if p_student_id = auth.uid() then
    raise exception 'You cannot remove yourself from your own lobby';
  end if;

  update public.matchmaking_lobby_members
  set status = 'left',
      left_at = coalesce(left_at, now()),
      updated_at = now()
  where lobby_id = p_lobby_id
    and student_id = p_student_id
    and status = 'active';

  if not found then
    raise exception 'Active lobby member not found';
  end if;
end;
$$;
