import { getSupabaseClient } from '@/template';

export const blockUser = async (
  blockerId: string,
  blockedId: string
): Promise<{ error: string | null }> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('blocked_users')
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  return { error: error?.message || null };
};

export const unblockUser = async (
  blockerId: string,
  blockedId: string
): Promise<{ error: string | null }> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  return { error: error?.message || null };
};

export const getBlockedUsers = async (
  userId: string
): Promise<{ data: string[]; error: string | null }> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', userId);
  return { data: (data || []).map((r: any) => r.blocked_id), error: error?.message || null };
};

export const isBlocked = async (
  blockerId: string,
  blockedId: string
): Promise<boolean> => {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('blocked_users')
    .select('id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .maybeSingle();
  return !!data;
};
