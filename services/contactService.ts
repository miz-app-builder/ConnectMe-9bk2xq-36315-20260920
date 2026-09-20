import { getSupabaseClient } from '@/template';
import { Contact, UserProfile } from '@/types';

export const getContacts = async (userId: string): Promise<{ data: Contact[]; error: string | null }> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('contacts')
    .select('*, contact:contact_id(id, display_name, username, avatar_url, email, bio)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return { data: (data as Contact[]) || [], error: error?.message || null };
};

export const addContact = async (userId: string, contactId: string): Promise<{ error: string | null }> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('contacts')
    .insert({ user_id: userId, contact_id: contactId });
  return { error: error?.message || null };
};

export const removeContact = async (userId: string, contactId: string): Promise<{ error: string | null }> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('user_id', userId)
    .eq('contact_id', contactId);
  return { error: error?.message || null };
};

export const isContact = async (userId: string, contactId: string): Promise<boolean> => {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
    .eq('contact_id', contactId)
    .single();
  return !!data;
};
