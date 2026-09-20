import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  Pressable, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { useAuth, useAlert } from '@/template';
import { useTheme } from '@/contexts/ThemeContext';
import { useMessages } from '@/hooks/useMessages';
import {
  getConversationParticipant, sendTextMessage, sendImageMessage,
  sendVoiceMessage, forwardMessage, deleteMessageForMe,
  deleteMessageForEveryone, getGroupMembers, getConversations,
  getUserPresence,
} from '@/services/chatService';
import { uploadChatImage, uploadVoiceMessage } from '@/services/storageService';
import { getPinnedMessages, pinMessage, unpinMessage } from '@/services/pinService';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { Avatar } from '@/components/ui/Avatar';
import { UserProfile, Message, GroupMember } from '@/types';
import { FONTS, SPACING, RADIUS, COLORS } from '@/constants/theme';
import { createCall } from '@/services/callService';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const {
    messages, loading, typingUserIds, addOptimistic, reactions, readStatuses,
    starredIds, notifyTyping, deleteMessageLocally, updateMessageLocally,
    handleToggleReaction, handleToggleStar,
  } = useMessages(id);

  const [headerData, setHeaderData] = useState<{
    name: string; avatar?: string; isGroup: boolean;
    members?: GroupMember[]; isOnline?: boolean; lastSeen?: string;
  } | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [showPinned, setShowPinned] = useState(false);

  const listRef = useRef<FlatList>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingAnim = useRef(new Animated.Value(1)).current;

  function formatLastSeen(lastSeen?: string): string {
    if (!lastSeen) return '';
    const d = new Date(lastSeen);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return 'last seen just now';
    if (diff < 3600000) return `last seen ${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `last seen today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return `last seen ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  }

  useEffect(() => {
    if (!user?.id || !id) return;
    (async () => {
      const { data: members } = await getGroupMembers(id);
      if (members && members.length > 2) {
        const { data: convs } = await getConversations(user.id);
        const conv = convs?.find((c: any) => c.id === id);
        setHeaderData({ name: conv?.name || 'Group', avatar: conv?.avatar_url, isGroup: true, members });
      } else {
        const { data: other } = await getConversationParticipant(id, user.id);
        if (other) {
          const presence = await getUserPresence(other.id);
          setHeaderData({
            name: other.display_name || other.username || other.email || '',
            avatar: other.avatar_url,
            isGroup: false,
            isOnline: presence.is_online,
            lastSeen: presence.last_seen || undefined,
          });
        }
      }
    })();
  }, [id, user?.id]);

  // Refresh presence every 30s
  useEffect(() => {
    if (!headerData || headerData.isGroup || !id || !user?.id) return;
    const interval = setInterval(async () => {
      const { data: other } = await getConversationParticipant(id, user.id);
      if (other) {
        const presence = await getUserPresence(other.id);
        setHeaderData(prev => prev ? { ...prev, isOnline: presence.is_online, lastSeen: presence.last_seen || undefined } : prev);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [headerData?.isGroup, id, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    getConversations(user.id).then(({ data }) => setConversations(data || []));
  }, [user?.id]);

  // Load pinned messages
  useEffect(() => {
    if (!id) return;
    getPinnedMessages(id).then(({ data }) => setPinnedMessages(data));
  }, [id]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordingAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(recordingAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      recordingAnim.stopAnimation();
      recordingAnim.setValue(1);
    }
  }, [isRecording]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !user?.id || !id) return;
    setInputText('');
    setReplyTo(null);
    const optimistic: Message = {
      id: `temp-${Date.now()}`, conversation_id: id, sender_id: user.id,
      content: text, message_type: 'text',
      reply_to: replyTo ? {
        id: replyTo.id, content: replyTo.content, message_type: replyTo.message_type,
        sender_name: replyTo.sender?.display_name || user.email || '',
      } : undefined,
      reply_to_id: replyTo?.id,
      created_at: new Date().toISOString(),
    };
    addOptimistic(optimistic);
    setSending(true);
    const { error } = await sendTextMessage(id, user.id, text, replyTo?.id);
    setSending(false);
    if (error) showAlert('Error', error);
  }, [inputText, user?.id, id, addOptimistic, showAlert, replyTo]);

  const handleImagePick = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { showAlert('Permission Needed', 'Please allow photo library access'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;
    if (!user?.id || !id) return;
    setUploading(true);
    const { url, error: uploadErr } = await uploadChatImage(user.id, uri);
    if (uploadErr || !url) { setUploading(false); showAlert('Upload Failed', uploadErr || 'Could not upload image'); return; }
    const { error } = await sendImageMessage(id, user.id, url, replyTo?.id);
    setUploading(false);
    setReplyTo(null);
    if (error) showAlert('Error', error);
    else addOptimistic({ id: `temp-img-${Date.now()}`, conversation_id: id, sender_id: user.id, message_type: 'image', image_url: url, content: '📷 Photo', created_at: new Date().toISOString() });
  }, [user?.id, id, showAlert, addOptimistic, replyTo]);

  const startRecording = useCallback(async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) { showAlert('Permission Needed', 'Microphone access required'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec); setIsRecording(true); setRecordingDuration(0);
      recordTimerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch { showAlert('Error', 'Could not start recording'); }
  }, [showAlert]);

  const stopRecording = useCallback(async () => {
    if (!recording || !user?.id || !id) return;
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsRecording(false);
    const duration = recordingDuration;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri || duration < 1) return;
      setUploading(true);
      const { url, error: uploadErr } = await uploadVoiceMessage(user.id, uri);
      if (uploadErr || !url) { setUploading(false); showAlert('Upload Failed', uploadErr || 'Could not upload voice'); return; }
      const { error } = await sendVoiceMessage(id, user.id, url, duration, replyTo?.id);
      setUploading(false); setReplyTo(null);
      if (error) showAlert('Error', error);
      else addOptimistic({ id: `temp-voice-${Date.now()}`, conversation_id: id, sender_id: user.id, message_type: 'voice', audio_url: url, duration_secs: duration, content: '🎤 Voice message', created_at: new Date().toISOString() });
    } catch { setUploading(false); setRecording(null); }
  }, [recording, user?.id, id, recordingDuration, showAlert, addOptimistic, replyTo]);

  const handleDeleteForMe = useCallback(async (msg: Message) => {
    if (!user?.id) return;
    const { error } = await deleteMessageForMe(msg.id, user.id);
    if (error) showAlert('Error', error);
    else deleteMessageLocally(msg.id);
  }, [user?.id, showAlert, deleteMessageLocally]);

  const handleDeleteForEveryone = useCallback(async (msg: Message) => {
    showAlert('Delete for Everyone?', 'This cannot be undone', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await deleteMessageForEveryone(msg.id);
          if (error) showAlert('Error', error);
          else updateMessageLocally(msg.id, { deleted_for_everyone: true, content: 'This message was deleted' });
        },
      },
    ]);
  }, [showAlert, updateMessageLocally]);

  const handlePin = useCallback(async (msg: Message) => {
    if (!user?.id || !id) return;
    const alreadyPinned = pinnedMessages.some(p => p.id === msg.id);
    if (alreadyPinned) {
      const { error } = await unpinMessage(id, msg.id);
      if (!error) setPinnedMessages(prev => prev.filter(p => p.id !== msg.id));
    } else {
      const { error } = await pinMessage(id, msg.id, user.id);
      if (!error) setPinnedMessages(prev => [msg, ...prev]);
      else showAlert('Error', error);
    }
  }, [user?.id, id, pinnedMessages, showAlert]);

  const handleForward = useCallback((msg: Message) => {
    if (!user?.id || conversations.length === 0) return;
    const options = conversations
      .filter(c => c.id !== id).slice(0, 8)
      .map(c => ({
        text: c.is_group ? (c.name || 'Group') : (c.otherUser?.display_name || c.otherUser?.username || c.otherUser?.email || ''),
        onPress: async () => {
          const { error } = await forwardMessage(msg, c.id, user.id);
          if (error) showAlert('Error', error);
          else showAlert('Forwarded', 'Message forwarded successfully');
        },
      }));
    options.push({ text: 'Cancel', style: 'cancel' } as any);
    Alert.alert('Forward to...', undefined, options);
  }, [user?.id, conversations, id, showAlert]);

  const typingLabel = useMemo(() => {
    if (!typingUserIds.length) return null;
    return typingUserIds.length === 1 ? 'typing...' : `${typingUserIds.length} people typing...`;
  }, [typingUserIds]);

  const isGroup = headerData?.isGroup || false;

  const subTitle = useMemo(() => {
    if (typingLabel) return typingLabel;
    if (isGroup && headerData?.members) return `${headerData.members.length} members`;
    if (!isGroup) {
      if (headerData?.isOnline) return 'online';
      if (headerData?.lastSeen) return formatLastSeen(headerData.lastSeen);
    }
    return null;
  }, [typingLabel, isGroup, headerData]);

  const subTitleColor = typingLabel ? COLORS.primary : headerData?.isOnline ? '#25D366' : colors.textSecondary;

  const startCall = useCallback(async (callType: 'audio' | 'video') => {
    if (!user?.id || !id || isGroup) return;
    const { data, error } = await getConversationParticipant(id, user.id);
    if (error || !data) { showAlert('Call unavailable', error || 'Could not find contact'); return; }
    const result = await createCall(user.id, data.id, callType);
    if (result.error || !result.data) { showAlert('Call failed', result.error || 'Could not start call'); return; }
    router.push({ pathname: '/call/[id]', params: { id: result.data.id } });
  }, [user?.id, id, isGroup, showAlert, router]);

  return (
    <View style={[styles.root, { backgroundColor: colors.chatBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.header, paddingTop: insets.top + 4, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.primary} />
        </Pressable>
        <Pressable
          onPress={() => isGroup ? router.push({ pathname: '/group-info', params: { id } }) : null}
          style={styles.headerPressable}
        >
          <Avatar uri={headerData?.avatar} name={headerData?.name} size="sm" isDark={isDark} />
          <View style={styles.headerInfo}>
            <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
              {headerData?.name || '...'}
            </Text>
            {subTitle ? (
              <Text style={[styles.headerSub, { color: subTitleColor }]} numberOfLines={1}>{subTitle}</Text>
            ) : null}
          </View>
        </Pressable>
        <View style={styles.headerActions}>
          {!isGroup && (
            <>
              <Pressable onPress={() => startCall('audio')} hitSlop={8}>
                <MaterialIcons name="call" size={22} color={colors.icon} />
              </Pressable>
              <Pressable onPress={() => startCall('video')} hitSlop={8}>
                <MaterialIcons name="videocam" size={24} color={colors.icon} />
              </Pressable>
            </>
          )}
          {pinnedMessages.length > 0 && (
            <Pressable onPress={() => setShowPinned(!showPinned)} hitSlop={8}>
              <MaterialIcons name="push-pin" size={22} color={showPinned ? COLORS.primary : colors.icon} />
            </Pressable>
          )}
          {isGroup && (
            <Pressable onPress={() => router.push({ pathname: '/group-info', params: { id } })} hitSlop={8}>
              <MaterialIcons name="info-outline" size={24} color={colors.icon} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Pinned messages bar */}
      {showPinned && pinnedMessages.length > 0 && (
        <View style={[styles.pinnedBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <MaterialIcons name="push-pin" size={14} color={COLORS.primary} />
          <Text style={[styles.pinnedText, { color: colors.text }]} numberOfLines={1}>
            {pinnedMessages[0].content || (pinnedMessages[0].message_type === 'image' ? '📷 Photo' : '🎤 Voice')}
          </Text>
          <Pressable onPress={() => setShowPinned(false)} hitSlop={8}>
            <MaterialIcons name="close" size={16} color={colors.icon} />
          </Pressable>
        </View>
      )}

      {/* Messages */}
      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item: Message) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isSent={item.sender_id === user?.id}
              colors={colors}
              isDark={isDark}
              showSenderName={isGroup}
              onReply={setReplyTo}
              onForward={handleForward}
              onDeleteForMe={handleDeleteForMe}
              onDeleteForEveryone={handleDeleteForEveryone}
              onPin={handlePin}
              reactions={reactions.get(item.id)}
              readStatus={readStatuses.get(item.id)}
              isStarred={starredIds.has(item.id)}
              onToggleReaction={handleToggleReaction}
              onToggleStar={handleToggleStar}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => messages.length > 0 && listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Avatar uri={headerData?.avatar} name={headerData?.name} size="xl" isDark={isDark} />
              <Text style={[styles.emptyChatName, { color: colors.text }]}>{headerData?.name}</Text>
              <Text style={[styles.emptyChatSub, { color: colors.textSecondary }]}>
                {isGroup ? 'Start the group conversation!' : 'Say hello to start the conversation!'}
              </Text>
            </View>
          }
        />
      )}

      {/* Input Bar */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <View style={[styles.inputBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
          {replyTo && (
            <View style={[styles.replyPreview, { backgroundColor: colors.surface, borderLeftColor: COLORS.primary }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.replyPreviewName, { color: COLORS.primary }]}>
                  {replyTo.sender?.display_name || replyTo.sender?.username || 'You'}
                </Text>
                <Text style={[styles.replyPreviewText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {replyTo.message_type === 'image' ? '📷 Photo' : replyTo.message_type === 'voice' ? '🎤 Voice' : replyTo.content}
                </Text>
              </View>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                <MaterialIcons name="close" size={20} color={colors.icon} />
              </Pressable>
            </View>
          )}

          {uploading && (
            <View style={styles.uploadingRow}>
              <ActivityIndicator color={COLORS.primary} size="small" />
              <Text style={[styles.uploadingText, { color: colors.textSecondary }]}>Uploading...</Text>
            </View>
          )}

          {isRecording && (
            <View style={styles.recordingRow}>
              <Animated.View style={[styles.recordDot, { transform: [{ scale: recordingAnim }] }]} />
              <Text style={[styles.recordingText, { color: colors.danger }]}>
                Recording {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
              </Text>
              <Text style={[styles.recordHint, { color: colors.textSecondary }]}>Release to send</Text>
            </View>
          )}

          <View style={styles.inputRow}>
            <Pressable
              onPress={handleImagePick}
              style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]} hitSlop={8}
            >
              <MaterialIcons name="image" size={26} color={COLORS.primary} />
            </Pressable>
            <TextInput
              value={inputText}
              onChangeText={t => { setInputText(t); if (t) notifyTyping(); }}
              placeholder="Message"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
              multiline returnKeyType="send"
              onSubmitEditing={handleSend} blurOnSubmit={false}
            />
            {inputText.trim() ? (
              <Pressable
                onPress={handleSend} disabled={sending}
                style={({ pressed }) => [styles.sendBtn, { backgroundColor: COLORS.primary, opacity: pressed ? 0.8 : 1 }]}
              >
                {sending ? <ActivityIndicator color="#fff" size="small" /> : <MaterialIcons name="send" size={20} color="#fff" />}
              </Pressable>
            ) : (
              <Pressable
                onPressIn={startRecording} onPressOut={stopRecording}
                style={({ pressed }) => [styles.sendBtn, { backgroundColor: isRecording ? colors.danger : COLORS.primary, opacity: pressed ? 0.9 : 1 }]}
              >
                <MaterialIcons name={isRecording ? 'stop' : 'mic'} size={20} color="#fff" />
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.md,
    gap: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 60,
  },
  backBtn: { padding: SPACING.xs },
  headerPressable: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headerInfo: { flex: 1 },
  headerName: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semiBold },
  headerSub: { fontSize: FONTS.sizes.xs },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  pinnedBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pinnedText: { flex: 1, fontSize: FONTS.sizes.sm },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messageList: { paddingVertical: SPACING.md, flexGrow: 1 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: SPACING.md },
  emptyChatName: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.semiBold },
  emptyChatSub: { fontSize: FONTS.sizes.md, textAlign: 'center' },
  inputBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SPACING.sm, paddingHorizontal: SPACING.md },
  replyPreview: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderLeftWidth: 3, paddingLeft: SPACING.sm, paddingVertical: SPACING.xs,
    paddingRight: SPACING.sm, borderRadius: RADIUS.sm, marginBottom: SPACING.sm,
  },
  replyPreviewName: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semiBold },
  replyPreviewText: { fontSize: FONTS.sizes.xs },
  uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingBottom: SPACING.sm },
  uploadingText: { fontSize: FONTS.sizes.sm },
  recordingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingBottom: SPACING.sm },
  recordDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E25151' },
  recordingText: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semiBold },
  recordHint: { fontSize: FONTS.sizes.xs },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm },
  iconBtn: { padding: SPACING.xs, marginBottom: 4 },
  input: {
    flex: 1, borderRadius: RADIUS.xl, paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm, fontSize: FONTS.sizes.md,
    maxHeight: 120, minHeight: 44, textAlignVertical: 'center',
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
