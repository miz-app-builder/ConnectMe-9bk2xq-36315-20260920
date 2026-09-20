-- NexTalk core database schema
-- Clean install for a new Supabase project.
-- Creates all tables used by the current app plus RLS, indexes and realtime.

create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text unique,
  display_name text,
  bio text,
  avatar_url text,
  push_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_online boolean not null default false,
  last_seen timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, contact_id),
  check (user_id <> contact_id)
);

create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  name text,
  avatar_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text,
  message_type text not null default 'text' check (message_type in ('text','image','audio','voice')),
  image_url text,
  audio_url text,
  duration_secs integer,
  reply_to_id uuid references public.messages(id) on delete set null,
  forwarded_from_id uuid references public.messages(id) on delete set null,
  deleted_for_everyone boolean not null default false,
  is_edited boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.message_deletes (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create table if not exists public.starred_messages (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create table if not exists public.pinned_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  pinned_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (conversation_id, message_id)
);

create table if not exists public.typing_indicators (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- Call tables are included here so a fresh database needs only this migration.
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references auth.users(id) on delete cascade,
  callee_id uuid not null references auth.users(id) on delete cascade,
  call_type text not null check (call_type in ('audio','video')),
  status text not null default 'ringing' check (status in ('ringing','accepted','rejected','missed','ended')),
  offer jsonb,
  answer jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (caller_id <> callee_id)
);

create table if not exists public.call_signals (
  id bigint generated by default as identity primary key,
  call_id uuid not null references public.calls(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  signal_type text not null check (signal_type in ('offer','answer','ice','hangup')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists contacts_user_idx on public.contacts(user_id);
create index if not exists blocked_users_blocker_idx on public.blocked_users(blocker_id);
create index if not exists participants_user_idx on public.conversation_participants(user_id);
create index if not exists participants_conversation_idx on public.conversation_participants(conversation_id);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at desc);
create index if not exists messages_sender_idx on public.messages(sender_id);
create index if not exists message_deletes_user_idx on public.message_deletes(user_id);
create index if not exists message_reads_user_idx on public.message_reads(user_id);
create index if not exists message_reactions_message_idx on public.message_reactions(message_id);
create index if not exists starred_messages_user_idx on public.starred_messages(user_id);
create index if not exists pinned_messages_conversation_idx on public.pinned_messages(conversation_id);
create index if not exists typing_updated_idx on public.typing_indicators(conversation_id, updated_at desc);
create index if not exists calls_caller_idx on public.calls(caller_id, created_at desc);
create index if not exists calls_callee_idx on public.calls(callee_id, created_at desc);
create index if not exists call_signals_call_idx on public.call_signals(call_id, created_at);

-- Generic updated_at helper.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_updated_at on public.user_profiles;
create trigger user_profiles_updated_at before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists conversations_updated_at on public.conversations;
create trigger conversations_updated_at before update on public.conversations
for each row execute function public.set_updated_at();

drop trigger if exists presence_updated_at on public.user_presence;
create trigger presence_updated_at before update on public.user_presence
for each row execute function public.set_updated_at();

-- Auto-create a profile when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, username, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'username', ''),
    nullif(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name'), '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- RLS
alter table public.user_profiles enable row level security;
alter table public.user_presence enable row level security;
alter table public.contacts enable row level security;
alter table public.blocked_users enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_deletes enable row level security;
alter table public.message_reads enable row level security;
alter table public.message_reactions enable row level security;
alter table public.starred_messages enable row level security;
alter table public.pinned_messages enable row level security;
alter table public.typing_indicators enable row level security;
alter table public.calls enable row level security;
alter table public.call_signals enable row level security;

-- Profiles / presence
drop policy if exists "profiles authenticated read" on public.user_profiles;
create policy "profiles authenticated read" on public.user_profiles for select
using (auth.uid() is not null);

drop policy if exists "profiles own insert" on public.user_profiles;
create policy "profiles own insert" on public.user_profiles for insert
with check (auth.uid() = id);

drop policy if exists "profiles own update" on public.user_profiles;
create policy "profiles own update" on public.user_profiles for update
using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles own delete" on public.user_profiles;
create policy "profiles own delete" on public.user_profiles for delete
using (auth.uid() = id);

drop policy if exists "presence authenticated read" on public.user_presence;
create policy "presence authenticated read" on public.user_presence for select
using (auth.uid() is not null);

drop policy if exists "presence own write" on public.user_presence;
create policy "presence own write" on public.user_presence for insert
with check (auth.uid() = user_id);
create policy "presence own update" on public.user_presence for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Contacts / blocks
drop policy if exists "contacts own access" on public.contacts;
create policy "contacts own access" on public.contacts for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "blocks own access" on public.blocked_users;
create policy "blocks own access" on public.blocked_users for all
using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

-- Conversations and participants
drop policy if exists "conversation participants read" on public.conversations;
create policy "conversation participants read" on public.conversations for select
using (exists (
  select 1 from public.conversation_participants p
  where p.conversation_id = conversations.id and p.user_id = auth.uid()
));

drop policy if exists "conversation participants insert" on public.conversations;
create policy "conversation participants insert" on public.conversations for insert
with check (auth.uid() = created_by or created_by is null);

drop policy if exists "conversation participants update" on public.conversations;
create policy "conversation participants update" on public.conversations for update
using (exists (
  select 1 from public.conversation_participants p
  where p.conversation_id = conversations.id and p.user_id = auth.uid()
))
with check (exists (
  select 1 from public.conversation_participants p
  where p.conversation_id = conversations.id and p.user_id = auth.uid()
));

drop policy if exists "conversation participants read members" on public.conversation_participants;
create policy "conversation participants read members" on public.conversation_participants for select
using (exists (
  select 1 from public.conversation_participants me
  where me.conversation_id = conversation_participants.conversation_id
    and me.user_id = auth.uid()
));

drop policy if exists "conversation participants add" on public.conversation_participants;
create policy "conversation participants add" on public.conversation_participants for insert
with check (auth.uid() = user_id or exists (
  select 1 from public.conversation_participants me
  where me.conversation_id = conversation_participants.conversation_id
    and me.user_id = auth.uid()
    and me.role = 'admin'
));

drop policy if exists "conversation participants remove" on public.conversation_participants;
create policy "conversation participants remove" on public.conversation_participants for delete
using (auth.uid() = user_id or exists (
  select 1 from public.conversation_participants me
  where me.conversation_id = conversation_participants.conversation_id
    and me.user_id = auth.uid()
    and me.role = 'admin'
));

drop policy if exists "conversation participants update role" on public.conversation_participants;
create policy "conversation participants update role" on public.conversation_participants for update
using (exists (
  select 1 from public.conversation_participants me
  where me.conversation_id = conversation_participants.conversation_id
    and me.user_id = auth.uid() and me.role = 'admin'
));

-- Messages
drop policy if exists "messages members read" on public.messages;
create policy "messages members read" on public.messages for select
using (exists (
  select 1 from public.conversation_participants p
  where p.conversation_id = messages.conversation_id and p.user_id = auth.uid()
));

drop policy if exists "messages members insert" on public.messages;
create policy "messages members insert" on public.messages for insert
with check (
  auth.uid() = sender_id and exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = messages.conversation_id and p.user_id = auth.uid()
  )
);

drop policy if exists "messages sender update" on public.messages;
create policy "messages sender update" on public.messages for update
using (auth.uid() = sender_id)
with check (auth.uid() = sender_id);

drop policy if exists "messages sender delete" on public.messages;
create policy "messages sender delete" on public.messages for delete
using (auth.uid() = sender_id);

-- Per-user message state
drop policy if exists "message deletes own" on public.message_deletes;
create policy "message deletes own" on public.message_deletes for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "message reads own" on public.message_reads;
create policy "message reads own" on public.message_reads for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reactions conversation members" on public.message_reactions;
create policy "reactions conversation members" on public.message_reactions for select
using (exists (
  select 1 from public.messages m
  join public.conversation_participants p on p.conversation_id = m.conversation_id
  where m.id = message_reactions.message_id and p.user_id = auth.uid()
));
create policy "reactions own write" on public.message_reactions for insert
with check (auth.uid() = user_id and exists (
  select 1 from public.messages m
  join public.conversation_participants p on p.conversation_id = m.conversation_id
  where m.id = message_reactions.message_id and p.user_id = auth.uid()
));
create policy "reactions own delete" on public.message_reactions for delete
using (auth.uid() = user_id);

drop policy if exists "stars own" on public.starred_messages;
create policy "stars own" on public.starred_messages for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "pins members read" on public.pinned_messages;
create policy "pins members read" on public.pinned_messages for select
using (exists (
  select 1 from public.conversation_participants p
  where p.conversation_id = pinned_messages.conversation_id and p.user_id = auth.uid()
));
create policy "pins members insert" on public.pinned_messages for insert
with check (auth.uid() = pinned_by and exists (
  select 1 from public.conversation_participants p
  where p.conversation_id = pinned_messages.conversation_id and p.user_id = auth.uid()
));
create policy "pins own delete" on public.pinned_messages for delete
using (auth.uid() = pinned_by);

drop policy if exists "typing members access" on public.typing_indicators;
create policy "typing members access" on public.typing_indicators for all
using (exists (
  select 1 from public.conversation_participants p
  where p.conversation_id = typing_indicators.conversation_id and p.user_id = auth.uid()
))
with check (auth.uid() = user_id and exists (
  select 1 from public.conversation_participants p
  where p.conversation_id = typing_indicators.conversation_id and p.user_id = auth.uid()
));

-- Calls
drop policy if exists "calls participants can read" on public.calls;
create policy "calls participants can read" on public.calls for select
using (auth.uid() = caller_id or auth.uid() = callee_id);
drop policy if exists "callers can create calls" on public.calls;
create policy "callers can create calls" on public.calls for insert
with check (auth.uid() = caller_id);
drop policy if exists "call participants can update calls" on public.calls;
create policy "call participants can update calls" on public.calls for update
using (auth.uid() = caller_id or auth.uid() = callee_id)
with check (auth.uid() = caller_id or auth.uid() = callee_id);

drop policy if exists "call participants can read signals" on public.call_signals;
create policy "call participants can read signals" on public.call_signals for select
using (exists (
  select 1 from public.calls c
  where c.id = call_signals.call_id
    and (auth.uid() = c.caller_id or auth.uid() = c.callee_id)
));
drop policy if exists "call participants can send signals" on public.call_signals;
create policy "call participants can send signals" on public.call_signals for insert
with check (
  auth.uid() = sender_id and exists (
    select 1 from public.calls c
    where c.id = call_signals.call_id
      and (
        (auth.uid() = c.caller_id and signal_type in ('offer','ice','hangup'))
        or (auth.uid() = c.callee_id and signal_type in ('answer','ice','hangup'))
      )
  )
);

-- Protect immutable call identity/type and terminal states.
create or replace function public.validate_call_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.caller_id <> new.caller_id or old.callee_id <> new.callee_id
     or old.call_type <> new.call_type or old.created_at <> new.created_at then
    raise exception 'immutable call fields cannot be changed';
  end if;
  if old.status in ('rejected','missed','ended') and new.status <> old.status then
    raise exception 'terminal call status cannot be reopened';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_call_update on public.calls;
create trigger validate_call_update before update on public.calls
for each row execute function public.validate_call_update();

-- Realtime
alter table public.conversations replica identity full;
alter table public.messages replica identity full;
alter table public.calls replica identity full;
alter table public.call_signals replica identity full;

do $$ begin alter publication supabase_realtime add table public.conversations; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.typing_indicators; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.user_presence; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.calls; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.call_signals; exception when duplicate_object then null; end $$;

-- Storage buckets used by the app.
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('chat-images', 'chat-images', true),
  ('voice-messages', 'voice-messages', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public avatar read" on storage.objects;
create policy "public avatar read" on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "public chat image read" on storage.objects;
create policy "public chat image read" on storage.objects for select
using (bucket_id = 'chat-images');

drop policy if exists "public voice read" on storage.objects;
create policy "public voice read" on storage.objects for select
using (bucket_id = 'voice-messages');

drop policy if exists "users upload own files" on storage.objects;
create policy "users upload own files" on storage.objects for insert
with check (
  auth.uid() is not null
  and (
    (bucket_id = 'avatars' and (name like auth.uid()::text || '/%' or name like 'groups/%'))
    or (bucket_id in ('chat-images','voice-messages') and name like auth.uid()::text || '/%')
  )
);

drop policy if exists "users update own files" on storage.objects;
create policy "users update own files" on storage.objects for update
using (auth.uid() is not null and owner_id = auth.uid()::text);

drop policy if exists "users delete own files" on storage.objects;
create policy "users delete own files" on storage.objects for delete
using (auth.uid() is not null and owner_id = auth.uid()::text);
