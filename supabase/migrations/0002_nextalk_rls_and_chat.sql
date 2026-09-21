create or replace function public.is_conversation_member(p_conversation_id uuid,p_user_id uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.conversation_members where conversation_id=p_conversation_id and user_id=p_user_id); $$;
create policy "authenticated create conversations" on public.conversations for insert to authenticated with check(created_by=auth.uid());
create policy "creator add members" on public.conversation_members for insert to authenticated with check(exists(select 1 from public.conversations c where c.id=conversation_id and c.created_by=auth.uid()) or user_id=auth.uid());
create policy "members update read state" on public.messages for update to authenticated using(public.is_conversation_member(conversation_id)) with check(public.is_conversation_member(conversation_id));
create or replace function public.start_direct_conversation(p_other_user uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare v_conversation uuid;
begin
 if auth.uid() is null or p_other_user is null or p_other_user=auth.uid() then raise exception 'Invalid conversation users'; end if;
 select c.id into v_conversation from public.conversations c join public.conversation_members a on a.conversation_id=c.id and a.user_id=auth.uid() join public.conversation_members b on b.conversation_id=c.id and b.user_id=p_other_user where c.is_group=false limit 1;
 if v_conversation is not null then return v_conversation; end if;
 insert into public.conversations(created_by) values(auth.uid()) returning id into v_conversation;
 insert into public.conversation_members(conversation_id,user_id) values(v_conversation,auth.uid()),(v_conversation,p_other_user);
 return v_conversation;
end; $$;
grant execute on function public.start_direct_conversation(uuid) to authenticated;
create or replace function public.my_conversations() returns table(id uuid,title text,is_group boolean,created_at timestamptz,last_body text,last_message_at timestamptz) language sql stable security definer set search_path=public as $$ select c.id,c.title,c.is_group,c.created_at,m.body,m.created_at from public.conversations c join public.conversation_members cm on cm.conversation_id=c.id and cm.user_id=auth.uid() left join lateral (select body,created_at from public.messages where conversation_id=c.id order by created_at desc limit 1) m on true order by coalesce(m.created_at,c.created_at) desc; $$;
grant execute on function public.my_conversations() to authenticated;