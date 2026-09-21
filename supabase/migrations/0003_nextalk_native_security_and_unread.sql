drop policy if exists "members update read state" on public.messages;
drop policy if exists "creator add members" on public.conversation_members;
drop policy if exists "authenticated create conversations" on public.conversations;

create or replace function public.mark_message_read(p_message_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.messages m
  set read_at=coalesce(m.read_at,now())
  where m.id=p_message_id
    and exists(
      select 1 from public.conversation_members cm
      where cm.conversation_id=m.conversation_id and cm.user_id=auth.uid()
    );
end;
$$;
grant execute on function public.mark_message_read(uuid) to authenticated;

drop function if exists public.my_conversations();
create function public.my_conversations()
returns table(
  id uuid,
  title text,
  is_group boolean,
  created_at timestamptz,
  last_body text,
  last_message_at timestamptz,
  peer_name text,
  peer_username text,
  unread_count bigint
) language sql stable security definer set search_path=public as $$
  select
    c.id,c.title,c.is_group,c.created_at,
    m.body,m.created_at,
    peer.display_name,peer.username,
    coalesce(unread.unread_count,0)
  from public.conversations c
  join public.conversation_members mine
    on mine.conversation_id=c.id and mine.user_id=auth.uid()
  left join lateral (
    select body,created_at
    from public.messages
    where conversation_id=c.id
    order by created_at desc
    limit 1
  ) m on true
  left join lateral (
    select p.display_name,p.username
    from public.conversation_members cm
    join public.profiles p on p.id=cm.user_id
    where cm.conversation_id=c.id and cm.user_id<>auth.uid()
    limit 1
  ) peer on true
  left join lateral (
    select count(*)::bigint as unread_count
    from public.messages um
    where um.conversation_id=c.id
      and um.sender_id<>auth.uid()
      and um.read_at is null
  ) unread on true
  order by coalesce(m.created_at,c.created_at) desc;
$$;
grant execute on function public.my_conversations() to authenticated;

create index if not exists idx_profiles_username_lower on public.profiles(lower(username));
create index if not exists idx_messages_conversation_created_at on public.messages(conversation_id,created_at desc);
create index if not exists idx_messages_unread on public.messages(conversation_id,read_at) where read_at is null;
