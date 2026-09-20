import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getMessages, markMessagesRead, getTypingUsers, setTyping,
  getReadStatuses,
} from '@/services/chatService';
import { getMessageReactions, toggleReaction, Reaction } from '@/services/reactionService';
import { getStarredMessageIds, toggleStarMessage } from '@/services/starService';
import { Message } from '@/types';
import { useAuth } from '@/template';

const POLL_INTERVAL = 2500;
const TYPING_POLL = 2000;

export function useMessages(conversationId: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [reactions, setReactions] = useState<Map<string, Reaction[]>>(new Map());
  const [readStatuses, setReadStatuses] = useState<Map<string, 'sent' | 'delivered' | 'read'>>(new Map());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCountRef = useRef(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !user?.id) return;
    const { data, error: err } = await getMessages(conversationId, user.id);
    if (!err && data) {
      setMessages(prev => {
        const lastPrev = prev[prev.length - 1]?.id;
        const lastNew = data[data.length - 1]?.id;
        if (data.length === prev.length && lastPrev === lastNew) return prev;
        lastCountRef.current = data.length;
        // Mark new messages as read
        const prevIds = new Set(prev.map(m => m.id));
        const newUnreadIds = data
          .filter(m => !prevIds.has(m.id) && m.sender_id !== user.id && !m.is_deleted_for_me)
          .map(m => m.id);
        if (newUnreadIds.length > 0) {
          markMessagesRead(conversationId, user.id, newUnreadIds);
        }
        return data;
      });

      // Fetch reactions and read statuses for current messages
      const msgIds = data.map(m => m.id);
      const sentIds = data.filter(m => m.sender_id === user.id).map(m => m.id);

      const [reactMap, readMap] = await Promise.all([
        getMessageReactions(msgIds, user.id),
        sentIds.length ? getReadStatuses(sentIds, conversationId, user.id) : Promise.resolve(new Map()),
      ]);
      setReactions(reactMap);
      setReadStatuses(readMap);
    } else if (err) {
      setError(err);
    }
    setLoading(false);
  }, [conversationId, user?.id]);

  const fetchTyping = useCallback(async () => {
    if (!conversationId || !user?.id) return;
    const ids = await getTypingUsers(conversationId, user.id);
    setTypingUserIds(ids);
  }, [conversationId, user?.id]);

  // Fetch starred message ids once
  useEffect(() => {
    if (!user?.id) return;
    getStarredMessageIds(user.id).then(ids => setStarredIds(ids));
  }, [user?.id]);

  useEffect(() => {
    if (!conversationId) return;
    setLoading(true);
    lastCountRef.current = 0;
    setMessages([]);
    fetchMessages();
    timerRef.current = setInterval(fetchMessages, POLL_INTERVAL);
    typingTimerRef.current = setInterval(fetchTyping, TYPING_POLL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (user?.id) setTyping(conversationId, user.id, false);
    };
  }, [fetchMessages, fetchTyping, conversationId, user?.id]);

  const addOptimistic = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const notifyTyping = useCallback(() => {
    if (!user?.id || !conversationId) return;
    setTyping(conversationId, user.id, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(conversationId, user.id, false);
    }, 4000);
  }, [conversationId, user?.id]);

  const removeOptimistic = useCallback((tempId: string, realMsg: Message) => {
    setMessages(prev => prev.map(m => m.id === tempId ? realMsg : m));
  }, []);

  const deleteMessageLocally = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

  const updateMessageLocally = useCallback((messageId: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, ...updates } : m));
  }, []);

  const handleToggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user?.id) return;
    const current = reactions.get(messageId) || [];
    const found = current.find(r => r.emoji === emoji);
    const isReacted = found?.reactedByMe || false;

    // Optimistic update
    setReactions(prev => {
      const updated = new Map(prev);
      const existing = [...(updated.get(messageId) || [])];
      const idx = existing.findIndex(r => r.emoji === emoji);
      if (idx >= 0) {
        const r = { ...existing[idx] };
        if (isReacted) {
          r.count--;
          r.reactedByMe = false;
          r.users = r.users.filter(u => u !== user.id);
          if (r.count <= 0) existing.splice(idx, 1);
          else existing[idx] = r;
        } else {
          r.count++;
          r.reactedByMe = true;
          r.users = [...r.users, user.id];
          existing[idx] = r;
        }
      } else if (!isReacted) {
        existing.push({ emoji, count: 1, reactedByMe: true, users: [user.id] });
      }
      updated.set(messageId, existing);
      return updated;
    });

    await toggleReaction(messageId, user.id, emoji);
  }, [user?.id, reactions]);

  const handleToggleStar = useCallback(async (messageId: string) => {
    if (!user?.id) return;
    const isStarred = starredIds.has(messageId);
    setStarredIds(prev => {
      const next = new Set(prev);
      if (isStarred) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
    await toggleStarMessage(messageId, user.id, isStarred);
  }, [user?.id, starredIds]);

  return {
    messages,
    loading,
    error,
    typingUserIds,
    reactions,
    readStatuses,
    starredIds,
    addOptimistic,
    removeOptimistic,
    notifyTyping,
    deleteMessageLocally,
    updateMessageLocally,
    handleToggleReaction,
    handleToggleStar,
    refresh: fetchMessages,
  };
}
