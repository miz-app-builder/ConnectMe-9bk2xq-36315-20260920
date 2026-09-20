import { getSupabaseClient } from '@/template';
import { Conversation, Message, UserProfile, GroupMember } from '@/types';

// ── Conversations ──────────────────────────────────────────────

export const getOrCreateConversation = async (
  userId: string,
  otherUserId: string
): Promise<{ data: string | null; error: string | null }> => {
  const supabase = getSupabaseClient();

  const { data: mine } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId);

  const { data: theirs } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', otherUserId);

  if (mine && theirs) {
    const mySet = new Set(mine.map((r: any) => r.conversation_id));
    // Find shared conversation that is NOT a group
    for (const r of theirs) {
      if (mySet.has(r.conversation_id)) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('id, is_group')
          .eq('id', r.conversation_id)
          .single();
        if (conv && !conv.is_group) return { data: conv.id, error: null };
      }
    }
  }

  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .insert({ updated_at: new Date().toISOString(), is_group: false })
    .select()
    .single();

  if (convErr || !conv) return { data: null, error: convErr?.message || 'Failed to create conversation' };

  await supabase.from('conversation_participants').insert([
    { conversation_id: conv.id, user_id: userId, role: 'member' },
    { conversation_id: conv.id, user_id: otherUserId, role: 'member' },
  ]);

  return { data: conv.id, error: null };
};

export const createGroupConversation = async (
  creatorId: string,
  name: string,
  memberIds: string[]
): Promise<{ data: string | null; error: string | null }> => {
  const supabase = getSupabaseClient();

  const allIds = Array.from(new Set([creatorId, ...memberIds]));
  if (allIds.length > 50) return { data: null, error: 'Maximum 50 members allowed' };

  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .insert({ is_group: true, name, created_by: creatorId, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (convErr || !conv) return { data: null, error: convErr?.message || 'Failed to create group' };

  const participants = allIds.map(uid => ({
    conversation_id: conv.id,
    user_id: uid,
    role: uid === creatorId ? 'admin' : 'member',
  }));

  await supabase.from('conversation_participants').insert(participants);
  return { data: conv.id, error: null };
};

export const getGroupMembers = async (
  conversationId: string
): Promise<{ data: GroupMember[]; error: string | null }> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('user_id, role, joined_at, profile:user_id(id, display_name, username, avatar_url, email)')
    .eq('conversation_id', conversationId)
    .order('role', { ascending: true });

  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((r: any) => ({
      user_id: r.user_id,
      role: r.role,
      joined_at: r.joined_at,
      profile: r.profile as UserProfile,
    })),
    error: null,
  };
};

export const addGroupMember = async (
  conversationId: string,
  userId: string
): Promise<{ error: string | null }> => {
  const supabase = getSupabaseClient();
  const { count } = await supabase
    .from('conversation_participants')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', conversationId);
  if ((count || 0) >= 50) return { error: 'Group is full (50 members max)' };
  const { error } = await supabase
    .from('conversation_participants')
    .insert({ conversation_id: conversationId, user_id: userId, role: 'member' });
  return { error: error?.message || null };
};

export const removeGroupMember = async (
  conversationId: string,
  userId: string
): Promise<{ error: string | null }> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('conversation_participants')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
  return { error: error?.message || null };
};

export const updateGroupInfo = async (
  conversationId: string,
  updates: { name?: string; avatar_url?: string }
): Promise<{ error: string | null }> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', conversationId);
  return { error: error?.message || null };
};

export const getConversations = async (
  userId: string
): Promise<{ data: Conversation[]; error: string | null }> => {
  const supabase = getSupabaseClient();

  const { data: myParts, error: partsErr } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId);

  if (partsErr || !myParts?.length) return { data: [], error: partsErr?.message || null };
  const convIds = myParts.map((p: any) => p.conversation_id);

  const [{ data: allParts }, { data: msgs }, { data: convRows }] = await Promise.all([
    supabase
      .from('conversation_participants')
      .select('conversation_id, user_id, user_profiles:user_id(id, display_name, username, avatar_url, email)')
      .in('conversation_id', convIds),
    supabase
      .from('messages')
      .select('id, conversation_id, content, message_type, image_url, audio_url, created_at, sender_id, deleted_for_everyone')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
      .limit(convIds.length * 5),
    supabase
      .from('conversations')
      .select('id, created_at, updated_at, is_group, name, avatar_url, created_by')
      .in('id', convIds),
  ]);

  const conversations: Conversation[] = convIds
    .map((cid: string) => {
      const convRow = convRows?.find((c: any) => c.id === cid);
      const isGroup = convRow?.is_group || false;
      const lastMessage = msgs?.find((m: any) => m.conversation_id === cid && !m.deleted_for_everyone);

      if (isGroup) {
        const participants = (allParts || [])
          .filter((p: any) => p.conversation_id === cid)
          .map((p: any) => p.user_profiles as UserProfile)
          .filter(Boolean);
        return {
          id: cid,
          created_at: convRow?.created_at || '',
          updated_at: lastMessage?.created_at || convRow?.updated_at || '',
          is_group: true,
          name: convRow?.name || 'Group',
          avatar_url: convRow?.avatar_url,
          created_by: convRow?.created_by,
          participants,
          lastMessage: lastMessage as Message | undefined,
        } as Conversation;
      } else {
        const otherPart = (allParts || []).find((p: any) => p.conversation_id === cid && p.user_id !== userId);
        const otherUser = otherPart?.user_profiles as UserProfile | null;
        if (!otherUser) return null;
        return {
          id: cid,
          created_at: convRow?.created_at || '',
          updated_at: lastMessage?.created_at || convRow?.updated_at || '',
          is_group: false,
          otherUser,
          lastMessage: lastMessage as Message | undefined,
        } as Conversation;
      }
    })
    .filter(Boolean) as Conversation[];

  conversations.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return { data: conversations, error: null };
};

export const getConversationParticipant = async (
  conversationId: string,
  currentUserId: string
): Promise<{ data: UserProfile | null; error: string | null }> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('user_id, user_profiles:user_id(id, display_name, username, avatar_url, email, bio)')
    .eq('conversation_id', conversationId)
    .neq('user_id', currentUserId)
    .limit(1)
    .single();

  if (error || !data) return { data: null, error: error?.message || null };
  return { data: (data as any).user_profiles as UserProfile, error: null };
};

// ── Messages ───────────────────────────────────────────────────

export const getMessages = async (
  conversationId: string,
  currentUserId: string
): Promise<{ data: Message[]; error: string | null }> => {
  const supabase = getSupabaseClient();

  const [{ data, error }, { data: myDeletes }] = await Promise.all([
    supabase
      .from('messages')
      .select('*, sender:sender_id(id, display_name, username, avatar_url), reply_msg:reply_to_id(id, content, message_type, sender:sender_id(display_name, username))')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(100),
    supabase
      .from('message_deletes')
      .select('message_id')
      .eq('user_id', currentUserId),
  ]);

  const deletedForMe = new Set((myDeletes || []).map((d: any) => d.message_id));

  const messages: Message[] = (data || []).map((m: any) => {
    const replyMsg = m.reply_msg;
    const replyTo: any = replyMsg
      ? {
          id: replyMsg.id,
          content: replyMsg.content,
          message_type: replyMsg.message_type,
          sender_name: replyMsg.sender?.display_name || replyMsg.sender?.username || '',
        }
      : undefined;

    return {
      ...m,
      reply_to: replyTo,
      is_deleted_for_me: deletedForMe.has(m.id),
    };
  });

  return { data: messages, error: error?.message || null };
};

export const sendTextMessage = async (
  conversationId: string,
  senderId: string,
  content: string,
  replyToId?: string
): Promise<{ data: Message | null; error: string | null }> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content, message_type: 'text', reply_to_id: replyToId || null })
    .select()
    .single();
  if (!error) {
    supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
  }
  return { data: data as Message | null, error: error?.message || null };
};

export const sendImageMessage = async (
  conversationId: string,
  senderId: string,
  imageUrl: string,
  replyToId?: string
): Promise<{ data: Message | null; error: string | null }> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, message_type: 'image', image_url: imageUrl, content: '📷 Photo', reply_to_id: replyToId || null })
    .select()
    .single();
  if (!error) {
    supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
  }
  return { data: data as Message | null, error: error?.message || null };
};

export const sendVoiceMessage = async (
  conversationId: string,
  senderId: string,
  audioUrl: string,
  durationSecs: number,
  replyToId?: string
): Promise<{ data: Message | null; error: string | null }> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, message_type: 'voice', audio_url: audioUrl, duration_secs: durationSecs, content: '🎤 Voice message', reply_to_id: replyToId || null })
    .select()
    .single();
  if (!error) {
    supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
  }
  return { data: data as Message | null, error: error?.message || null };
};

export const forwardMessage = async (
  message: Message,
  targetConversationId: string,
  senderId: string
): Promise<{ error: string | null }> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('messages')
    .insert({
      conversation_id: targetConversationId,
      sender_id: senderId,
      message_type: message.message_type,
      content: message.content,
      image_url: message.image_url,
      audio_url: message.audio_url,
      duration_secs: message.duration_secs,
      forwarded_from_id: message.id,
    });
  if (!error) {
    supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', targetConversationId);
  }
  return { error: error?.message || null };
};

export const deleteMessageForMe = async (
  messageId: string,
  userId: string
): Promise<{ error: string | null }> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('message_deletes')
    .insert({ message_id: messageId, user_id: userId });
  return { error: error?.message || null };
};

export const deleteMessageForEveryone = async (
  messageId: string
): Promise<{ error: string | null }> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('messages')
    .update({ deleted_for_everyone: true, content: 'This message was deleted' })
    .eq('id', messageId);
  return { error: error?.message || null };
};

// ── Read Receipts ──────────────────────────────────────────────

export const markMessagesRead = async (
  conversationId: string,
  userId: string,
  messageIds: string[]
): Promise<void> => {
  if (!messageIds.length) return;
  const supabase = getSupabaseClient();
  const inserts = messageIds.map(mid => ({ message_id: mid, user_id: userId }));
  await supabase.from('message_reads').upsert(inserts, { onConflict: 'message_id,user_id' });
};

export const getReadStatuses = async (
  messageIds: string[],
  conversationId: string,
  senderId: string
): Promise<Map<string, 'sent' | 'delivered' | 'read'>> => {
  if (!messageIds.length) return new Map();
  const supabase = getSupabaseClient();
  const { data: reads } = await supabase
    .from('message_reads')
    .select('message_id, user_id')
    .in('message_id', messageIds);

  const { data: participants } = await supabase
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .neq('user_id', senderId);

  const participantIds = new Set((participants || []).map((p: any) => p.user_id));
  const statusMap = new Map<string, 'sent' | 'delivered' | 'read'>();

  for (const mid of messageIds) {
    const readBy = new Set((reads || []).filter((r: any) => r.message_id === mid).map((r: any) => r.user_id));
    const othersRead = [...participantIds].every(pid => readBy.has(pid));
    const someRead = [...participantIds].some(pid => readBy.has(pid));
    statusMap.set(mid, othersRead ? 'read' : someRead ? 'delivered' : 'sent');
  }
  return statusMap;
};

// ── Typing Indicators ──────────────────────────────────────────

export const setTyping = async (conversationId: string, userId: string, isTyping: boolean): Promise<void> => {
  const supabase = getSupabaseClient();
  if (isTyping) {
    await supabase.from('typing_indicators').upsert(
      { conversation_id: conversationId, user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: 'conversation_id,user_id' }
    );
  } else {
    await supabase.from('typing_indicators').delete()
      .eq('conversation_id', conversationId).eq('user_id', userId);
  }
};

export const getTypingUsers = async (
  conversationId: string,
  currentUserId: string
): Promise<string[]> => {
  const supabase = getSupabaseClient();
  const cutoff = new Date(Date.now() - 5000).toISOString();
  const { data } = await supabase
    .from('typing_indicators')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .neq('user_id', currentUserId)
    .gte('updated_at', cutoff);
  return (data || []).map((d: any) => d.user_id);
};

// ── Presence ───────────────────────────────────────────────────

export const updatePresence = async (userId: string, isOnline: boolean): Promise<void> => {
  const supabase = getSupabaseClient();
  await supabase.from('user_presence').upsert(
    { user_id: userId, is_online: isOnline, last_seen: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
};

export const getUserPresence = async (userId: string): Promise<{ is_online: boolean; last_seen: string | null }> => {
  const supabase = getSupabaseClient();
  const { data } = await supabase.from('user_presence').select('is_online, last_seen').eq('user_id', userId).single();
  return { is_online: data?.is_online || false, last_seen: data?.last_seen || null };
};
