import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { getConversations, updatePresence } from '@/services/chatService';
import { Conversation } from '@/types';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';

const POLL_INTERVAL = 6000;
const PRESENCE_INTERVAL = 30000;

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const presenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return;
    const { data, error: err } = await getConversations(user.id);
    if (!err && data) {
      // Attach unread counts
      const supabase = getSupabaseClient();
      const convIds = data.map(c => c.id);
      if (convIds.length > 0) {
        // Get all message ids in these conversations
        const { data: allMsgs } = await supabase
          .from('messages')
          .select('id, conversation_id, sender_id')
          .in('conversation_id', convIds)
          .eq('deleted_for_everyone', false);

        const { data: readRows } = await supabase
          .from('message_reads')
          .select('message_id')
          .eq('user_id', user.id);

        const readSet = new Set((readRows || []).map((r: any) => r.message_id));

        const unreadMap = new Map<string, number>();
        for (const msg of allMsgs || []) {
          if (msg.sender_id !== user.id && !readSet.has(msg.id)) {
            unreadMap.set(msg.conversation_id, (unreadMap.get(msg.conversation_id) || 0) + 1);
          }
        }

        const withUnread = data.map(c => ({
          ...c,
          unread_count: unreadMap.get(c.id) || 0,
        }));
        setConversations(withUnread);
      } else {
        setConversations(data);
      }
    } else if (err) {
      setError(err);
    }
    setLoading(false);
  }, [user?.id]);

  const updateOnlineStatus = useCallback(async (isOnline: boolean) => {
    if (!user?.id) return;
    await updatePresence(user.id, isOnline);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    updateOnlineStatus(true);
    fetchConversations();
    timerRef.current = setInterval(fetchConversations, POLL_INTERVAL);
    presenceTimerRef.current = setInterval(() => updateOnlineStatus(true), PRESENCE_INTERVAL);
    const sub = AppState.addEventListener('change', state => {
      updateOnlineStatus(state === 'active');
    });
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (presenceTimerRef.current) clearInterval(presenceTimerRef.current);
      sub.remove();
      updateOnlineStatus(false);
    };
  }, [fetchConversations, updateOnlineStatus]);

  return { conversations, loading, error, refresh: fetchConversations };
}
