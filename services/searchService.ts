import { getSupabaseClient } from '@/template';
import { Message, Conversation } from '@/types';

export interface SearchResult {
  message: Message;
  conversation: Conversation;
}

export const searchMessages = async (
  userId: string,
  query: string
): Promise<{ data: SearchResult[]; error: string | null }> => {
  if (!query.trim()) return { data: [], error: null };
  const supabase = getSupabaseClient();

  // Get user's conversation ids
  const { data: myParts } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId);

  const convIds = (myParts || []).map((p: any) => p.conversation_id);
  if (!convIds.length) return { data: [], error: null };

  const [{ data: messages }, { data: convRows }, { data: allParts }] = await Promise.all([
    supabase
      .from('messages')
      .select('*, sender:sender_id(id, display_name, username, avatar_url)')
      .in('conversation_id', convIds)
      .ilike('content', `%${query.trim()}%`)
      .eq('deleted_for_everyone', false)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('conversations')
      .select('id, is_group, name, avatar_url, created_by')
      .in('id', convIds),
    supabase
      .from('conversation_participants')
      .select('conversation_id, user_id, user_profiles:user_id(id, display_name, username, avatar_url, email)')
      .in('conversation_id', convIds),
  ]);

  const results: SearchResult[] = (messages || []).map((msg: any) => {
    const convRow = (convRows || []).find((c: any) => c.id === msg.conversation_id);
    let conv: Conversation;
    if (convRow?.is_group) {
      conv = {
        id: convRow.id,
        created_at: '',
        updated_at: '',
        is_group: true,
        name: convRow.name || 'Group',
        avatar_url: convRow.avatar_url,
      };
    } else {
      const otherPart = (allParts || []).find(
        (p: any) => p.conversation_id === msg.conversation_id && p.user_id !== userId
      );
      conv = {
        id: msg.conversation_id,
        created_at: '',
        updated_at: '',
        is_group: false,
        otherUser: (otherPart as any)?.user_profiles,
      };
    }
    return { message: msg as Message, conversation: conv };
  });

  return { data: results, error: null };
};
