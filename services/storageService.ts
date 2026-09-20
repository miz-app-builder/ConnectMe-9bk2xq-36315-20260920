import { getSupabaseClient } from '@/template';
import * as FileSystem from 'expo-file-system';

// Efficient base64 → ArrayBuffer for React Native
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export const uploadAvatar = async (userId: string, uri: string): Promise<{ url: string | null; error: string | null }> => {
  const supabase = getSupabaseClient();
  try {
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const cleanPath = `${userId}/avatar.${ext}`;

    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const arrayBuffer = base64ToArrayBuffer(base64);

    const { error } = await supabase.storage
      .from('avatars')
      .upload(cleanPath, arrayBuffer, { contentType, upsert: true });

    if (error) return { url: null, error: error.message };

    const { data } = supabase.storage.from('avatars').getPublicUrl(cleanPath);
    return { url: data.publicUrl + `?t=${Date.now()}`, error: null };
  } catch (e: any) {
    return { url: null, error: e.message || 'Upload failed' };
  }
};

export const uploadChatImage = async (
  userId: string,
  uri: string
): Promise<{ url: string | null; error: string | null }> => {
  const supabase = getSupabaseClient();
  try {
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const fileName = `${Date.now()}.${ext}`;
    const path = `${userId}/${fileName}`;

    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const arrayBuffer = base64ToArrayBuffer(base64);

    const { error } = await supabase.storage
      .from('chat-images')
      .upload(path, arrayBuffer, { contentType, upsert: false });

    if (error) return { url: null, error: error.message };

    const { data } = supabase.storage.from('chat-images').getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  } catch (e: any) {
    return { url: null, error: e.message || 'Upload failed' };
  }
};

export const uploadVoiceMessage = async (
  userId: string,
  uri: string
): Promise<{ url: string | null; error: string | null }> => {
  const supabase = getSupabaseClient();
  try {
    const fileName = `${Date.now()}.m4a`;
    const path = `${userId}/${fileName}`;

    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const arrayBuffer = base64ToArrayBuffer(base64);

    const { error } = await supabase.storage
      .from('voice-messages')
      .upload(path, arrayBuffer, { contentType: 'audio/mp4', upsert: false });

    if (error) return { url: null, error: error.message };

    const { data } = supabase.storage.from('voice-messages').getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  } catch (e: any) {
    return { url: null, error: e.message || 'Upload failed' };
  }
};

export const uploadGroupAvatar = async (
  conversationId: string,
  uri: string
): Promise<{ url: string | null; error: string | null }> => {
  const supabase = getSupabaseClient();
  try {
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const path = `groups/${conversationId}.${ext}`;

    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const arrayBuffer = base64ToArrayBuffer(base64);

    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, arrayBuffer, { contentType, upsert: true });

    if (error) return { url: null, error: error.message };

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return { url: data.publicUrl + `?t=${Date.now()}`, error: null };
  } catch (e: any) {
    return { url: null, error: e.message || 'Upload failed' };
  }
};
