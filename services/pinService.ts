import { getSupabaseClient } from '@/template';
import { Message } from '@/types';

export const pinMessage = async (
  conversationId: string,
  messageId: string,
  pinnedBy: string
): Promise<{ error: string | null }> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('pinned_messages')
    .insert({ conversation_id: conversationId, message_id: messageId, pinned_by: pinnedBy });
  return { error: error?.message || null };
};

export const unpinMessage = async (
  conversationId: string,
  messageId: string
): Promise<{ error: string | null }> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('pinned_messages')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('message_id', messageId);
  return { error: error?.message || null };
};

export const getPinnedMessages = async (
  conversationId: string
): Promise<{ data: Message[]; error: string | null }> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('pinned_messages')
    .select('message_id, messages:message_id(*, sender:sender_id(id, display_name, username, avatar_url))')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((r: any) => r.messages).filter(Boolean) as Message[],
    error: null,
  };
};
