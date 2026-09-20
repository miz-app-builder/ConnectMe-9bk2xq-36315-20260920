-- NexTalk security hardening
-- Fixes recursive RLS checks, tightens group administration and call transitions.

create or replace function public.is_conversation_member(p_conversation_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = p_user_id
  );
$$;

create or replace function public.is_conversation_admin(p_conversation_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = p_user_id
      and cp.role = 'admin'
  );
$$;

revoke all on function public.is_conversation_member(uuid, uuid) from public;
revoke all on function public.is_conversation_admin(uuid, uuid) from public;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated;
grant execute on function public.is_conversation_admin(uuid, uuid) to authenticated;

-- Conversations: members can read; group changes require admin.
drop policy if exists "conversation participants read" on public.conversations;
create policy "conversation members read"
on public.conversations for select
using (public.is_conversation_member(id));

drop policy if exists "conversation participants insert" on public.conversations;
create policy "authenticated create conversation"
on public.conversations for insert
with check (auth.uid() = created_by or created_by is null);

drop policy if exists "conversation participants update" on public.conversations;
create policy "conversation members update"
on public.conversations for update
using (
  public.is_conversation_member(id)
  and (
    not is_group
    or public.is_conversation_admin(id)
  )
)
with check (
  public.is_conversation_member(id)
  and (
    not is_group
    or public.is_conversation_admin(id)
  )
);

-- Participant RLS without self-referencing recursion.
drop policy if exists "conversation participants read members" on public.conversation_participants;
create policy "conversation members read participants"
on public.conversation_participants for select
using (public.is_conversation_member(conversation_id));

drop policy if exists "conversation participants add" on public.conversation_participants;
create policy "conversation admins or creator add participants"
on public.conversation_participants for insert
with check (
  public.is_conversation_admin(conversation_id)
  or exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and c.created_by = auth.uid()
  )
);

drop policy if exists "conversation participants remove" on public.conversation_participants;
create policy "conversation admins or self remove participants"
on public.conversation_participants for delete
using (
  auth.uid() = user_id
  or public.is_conversation_admin(conversation_id)
);

drop policy if exists "conversation participants update role" on public.conversation_participants;
create policy "conversation admins update roles"
on public.conversation_participants for update
using (public.is_conversation_admin(conversation_id))
with check (public.is_conversation_admin(conversation_id));

-- Messages: membership checks use the SECURITY DEFINER helper.
drop policy if exists "messages members read" on public.messages;
create policy "messages members read"
on public.messages for select
using (public.is_conversation_member(conversation_id));

drop policy if exists "messages members insert" on public.messages;
create policy "messages members insert"
on public.messages for insert
with check (
  auth.uid() = sender_id
  and public.is_conversation_member(conversation_id)
);

-- Prevent a sender from rewriting message ownership/location.
create or replace function public.validate_message_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.sender_id <> new.sender_id
     or old.conversation_id <> new.conversation_id
     or old.created_at <> new.created_at then
    raise exception 'message identity fields cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_message_update on public.messages;
create trigger validate_message_update
before update on public.messages
for each row execute function public.validate_message_update();

-- Reactions / pins / typing use the helper and avoid recursive participant RLS.
drop policy if exists "reactions conversation members" on public.message_reactions;
create policy "reactions conversation members"
on public.message_reactions for select
using (exists (
  select 1 from public.messages m
  where m.id = message_reactions.message_id
    and public.is_conversation_member(m.conversation_id)
));

drop policy if exists "reactions own write" on public.message_reactions;
create policy "reactions own write"
on public.message_reactions for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.messages m
    where m.id = message_reactions.message_id
      and public.is_conversation_member(m.conversation_id)
  )
);

drop policy if exists "pins members read" on public.pinned_messages;
create policy "pins members read"
on public.pinned_messages for select
using (public.is_conversation_member(conversation_id));

drop policy if exists "pins members insert" on public.pinned_messages;
create policy "pins admins insert"
on public.pinned_messages for insert
with check (
  auth.uid() = pinned_by
  and public.is_conversation_admin(conversation_id)
);

drop policy if exists "pins own delete" on public.pinned_messages;
create policy "pins admins delete"
on public.pinned_messages for delete
using (public.is_conversation_admin(conversation_id));

drop policy if exists "typing members access" on public.typing_indicators;
create policy "typing members access"
on public.typing_indicators for all
using (public.is_conversation_member(conversation_id))
with check (
  auth.uid() = user_id
  and public.is_conversation_member(conversation_id)
);

-- Tighten call state changes: caller creates/owns offer; callee accepts/rejects and owns answer.
create or replace function public.validate_call_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.caller_id <> new.caller_id
     or old.callee_id <> new.callee_id
     or old.call_type <> new.call_type
     or old.created_at <> new.created_at then
    raise exception 'immutable call fields cannot be changed';
  end if;

  if old.status in ('rejected','missed','ended') and new.status <> old.status then
    raise exception 'terminal call status cannot be reopened';
  end if;

  if auth.uid() = old.callee_id then
    if new.offer is distinct from old.offer then
      raise exception 'callee cannot change call offer';
    end if;
    if new.status not in ('ringing','accepted','rejected','ended') then
      raise exception 'invalid callee call status';
    end if;
  elsif auth.uid() = old.caller_id then
    if new.answer is distinct from old.answer then
      raise exception 'caller cannot change call answer';
    end if;
    if old.status = 'ringing' and new.status not in ('ringing','ended','missed','accepted') then
      raise exception 'invalid caller call status';
    end if;
  end if;

  return new;
end;
$$;

-- A caller may send an offer; a callee may send an answer.
drop policy if exists "call participants can send signals" on public.call_signals;
create policy "call participants can send signals"
on public.call_signals for insert
with check (
  auth.uid() = sender_id
  and exists (
    select 1 from public.calls c
    where c.id = call_signals.call_id
      and (
        (auth.uid() = c.caller_id and signal_type in ('offer','ice','hangup'))
        or
        (auth.uid() = c.callee_id and signal_type in ('answer','ice','hangup'))
      )
  )
);

-- Only authenticated users can call the helper functions.
