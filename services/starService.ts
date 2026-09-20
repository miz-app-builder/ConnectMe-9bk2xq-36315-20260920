import { getSupabaseClient } from '@/template';
import { Message } from '@/types';

export const toggleStarMessage = async (
  messageId: string,
  userId: string,
  isCurrentlyStarred: boolean
): Promise<{ error: string | null }> => {
  const supabase = getSupabaseClient();
  if (isCurrentlyStarred) {
    const { error } = await supabase
      .from('starred_messages')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId);
    return { error: error?.message || null };
  } else {
    const { error } = await supabase
      .from('starred_messages')
      .insert({ message_id: messageId, user_id: userId });
    return { error: error?.message || null };
  }
};

export const getStarredMessages = async (userId: string): Promise<{ data: Message[]; error: string | null }> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('starred_messages')
    .select('message_id, messages:message_id(*, sender:sender_id(id, display_name, username, avatar_url))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((r: any) => r.messages).filter(Boolean) as Message[],
    error: null,
  };
};

export const getStarredMessageIds = async (userId: string): Promise<Set<string>> => {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('starred_messages')
    .select('message_id')
    .eq('user_id', userId);
  return new Set((data || []).map((r: any) => r.message_id));
};
