import { getSupabaseClient } from '@/template';
import { UserProfile } from '@/types';

export const getProfile = async (userId: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*, presence:user_presence(is_online, last_seen)')
    .eq('id', userId)
    .single();
  
  if (error) return { data: null, error: error.message };
  
  const presence = (data as any).presence;
  const profile: UserProfile = {
    ...(data as any),
    is_online: presence?.is_online || false,
    last_seen: presence?.last_seen || null,
  };
  return { data: profile, error: null };
};

export const updateProfile = async (
  userId: string,
  updates: Partial<Pick<UserProfile, 'display_name' | 'username' | 'bio' | 'avatar_url' | 'push_token'>>
) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  return { data: data as UserProfile | null, error: error?.message || null };
};

export const searchProfiles = async (query: string, currentUserId: string) => {
  const supabase = getSupabaseClient();
  const q = query.trim().toLowerCase();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, username, display_name, avatar_url, bio')
    .neq('id', currentUserId)
    .or(`username.ilike.%${q}%,email.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(20);
  return { data: (data as UserProfile[]) || [], error: error?.message || null };
};

export const deleteAccount = async (userId: string) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('user_profiles').delete().eq('id', userId);
  return { error: error?.message || null };
};
