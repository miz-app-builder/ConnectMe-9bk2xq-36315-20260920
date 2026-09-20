import { getSupabaseClient } from '@/template';

export interface Reaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  users: string[];
}

export const getMessageReactions = async (
  messageIds: string[],
  currentUserId: string
): Promise<Map<string, Reaction[]>> => {
  if (!messageIds.length) return new Map();
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('message_reactions')
    .select('message_id, emoji, user_id')
    .in('message_id', messageIds);

  const map = new Map<string, Reaction[]>();
  for (const row of data || []) {
    const existing = map.get(row.message_id) || [];
    const found = existing.find((r) => r.emoji === row.emoji);
    if (found) {
      found.count++;
      found.users.push(row.user_id);
      if (row.user_id === currentUserId) found.reactedByMe = true;
    } else {
      existing.push({
        emoji: row.emoji,
        count: 1,
        reactedByMe: row.user_id === currentUserId,
        users: [row.user_id],
      });
    }
    map.set(row.message_id, existing);
  }
  return map;
};

export const toggleReaction = async (
  messageId: string,
  userId: string,
  emoji: string
): Promise<{ error: string | null }> => {
  const supabase = getSupabaseClient();
  const { data: existing } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji);
    return { error: error?.message || null };
  } else {
    const { error } = await supabase
      .from('message_reactions')
      .insert({ message_id: messageId, user_id: userId, emoji });
    return { error: error?.message || null };
  }
};
