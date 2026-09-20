import React, { memo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Modal, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Message, ReplyPreview } from '@/types';
import { ThemeColors, FONTS, SPACING, RADIUS, COLORS } from '@/constants/theme';
import { Reaction } from '@/services/reactionService';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

interface MessageBubbleProps {
  message: Message;
  isSent: boolean;
  colors: ThemeColors;
  isDark: boolean;
  onReply?: (message: Message) => void;
  onForward?: (message: Message) => void;
  onDeleteForMe?: (message: Message) => void;
  onDeleteForEveryone?: (message: Message) => void;
  onPin?: (message: Message) => void;
  showSenderName?: boolean;
  reactions?: Reaction[];
  readStatus?: 'sent' | 'delivered' | 'read';
  isStarred?: boolean;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onToggleStar?: (messageId: string) => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(secs?: number): string {
  if (!secs) return '0:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function ReadReceipt({ status, isDark }: { status?: string; isDark: boolean }) {
  if (!status) return null;
  if (status === 'read') {
    return <MaterialIcons name="done-all" size={14} color={COLORS.primary} />;
  }
  if (status === 'delivered') {
    return <MaterialIcons name="done-all" size={14} color={isDark ? '#8696A0' : '#A0ACBA'} />;
  }
  return <MaterialIcons name="done" size={14} color={isDark ? '#8696A0' : '#A0ACBA'} />;
}

function ReplyBar({ reply, colors }: { reply: ReplyPreview; colors: ThemeColors }) {
  return (
    <View style={[styles.replyBar, { backgroundColor: colors.bubbleReceived, borderLeftColor: COLORS.primary }]}>
      <Text style={[styles.replyName, { color: COLORS.primary }]} numberOfLines={1}>
        {reply.sender_name || 'Unknown'}
      </Text>
      <Text style={[styles.replyText, { color: colors.textSecondary }]} numberOfLines={2}>
        {reply.message_type === 'image' ? '📷 Photo' : reply.message_type === 'voice' ? '🎤 Voice' : reply.content}
      </Text>
    </View>
  );
}

function VoiceBubble({ message, isSent, colors }: { message: Message; isSent: boolean; colors: ThemeColors }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackSecs, setPlaybackSecs] = useState(0);

  React.useEffect(() => {
    return () => { sound?.unloadAsync().catch(() => {}); };
  }, [sound]);

  const togglePlay = useCallback(async () => {
    if (!message.audio_url) return;
    if (playing && sound) { await sound.pauseAsync(); setPlaying(false); return; }
    if (sound) { await sound.playAsync(); setPlaying(true); return; }
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound: newSound } = await Audio.loadAsync({ uri: message.audio_url }, {}, false);
      newSound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;
        const dur = status.durationMillis || 1;
        setProgress(status.positionMillis / dur);
        setPlaybackSecs(Math.floor(status.positionMillis / 1000));
        if (status.didJustFinish) {
          setPlaying(false); setProgress(0); setPlaybackSecs(0);
          newSound.unloadAsync(); setSound(null);
        }
      });
      await newSound.playAsync(); setSound(newSound); setPlaying(true);
    } catch { Alert.alert('Error', 'Could not play voice message'); }
  }, [message.audio_url, playing, sound]);

  const elapsed = playing ? playbackSecs : message.duration_secs || 0;
  return (
    <View style={styles.voiceRow}>
      <Pressable onPress={togglePlay} style={[styles.playBtn, { backgroundColor: isSent ? COLORS.primaryDark : COLORS.primary }]}>
        <MaterialIcons name={playing ? 'pause' : 'play-arrow'} size={22} color="#fff" />
      </Pressable>
      <View style={styles.voiceInfo}>
        <View style={[styles.waveformBar, { backgroundColor: isSent ? 'rgba(255,255,255,0.3)' : COLORS.primaryLight + '33' }]}>
          <View style={[styles.waveformFill, { flex: progress, backgroundColor: isSent ? '#fff' : COLORS.primary }]} />
          <View style={{ flex: 1 - progress }} />
        </View>
        <Text style={[styles.voiceDuration, { color: isSent ? 'rgba(255,255,255,0.7)' : colors.textMuted }]}>
          {formatDuration(elapsed)}
        </Text>
      </View>
      <MaterialIcons name="mic" size={16} color={isSent ? 'rgba(255,255,255,0.6)' : colors.textMuted} />
    </View>
  );
}

function ReactionsRow({
  reactions, onToggle, colors,
}: { reactions: Reaction[]; onToggle: (emoji: string) => void; colors: ThemeColors }) {
  if (!reactions.length) return null;
  return (
    <View style={styles.reactionsRow}>
      {reactions.map(r => (
        <Pressable
          key={r.emoji}
          onPress={() => onToggle(r.emoji)}
          style={[
            styles.reactionChip,
            { backgroundColor: r.reactedByMe ? COLORS.primary + '33' : colors.surface, borderColor: r.reactedByMe ? COLORS.primary : colors.border },
          ]}
        >
          <Text style={styles.reactionEmoji}>{r.emoji}</Text>
          <Text style={[styles.reactionCount, { color: r.reactedByMe ? COLORS.primary : colors.textSecondary }]}>{r.count}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const MessageBubble = memo(({
  message, isSent, colors, isDark, onReply, onForward, onDeleteForMe,
  onDeleteForEveryone, onPin, showSenderName, reactions, readStatus,
  isStarred, onToggleReaction, onToggleStar,
}: MessageBubbleProps) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const bgColor = isSent ? colors.bubbleSent : colors.bubbleReceived;

  if (message.is_deleted_for_me) return null;

  const showOptions = () => {
    if (message.deleted_for_everyone) return;
    const opts: any[] = [
      { text: '😊 React', onPress: () => setShowEmojiPicker(true) },
      { text: '↩ Reply', onPress: () => onReply?.(message) },
      { text: '➡ Forward', onPress: () => onForward?.(message) },
      {
        text: isStarred ? '☆ Unstar' : '⭐ Star',
        onPress: () => onToggleStar?.(message.id),
      },
      { text: '📌 Pin', onPress: () => onPin?.(message) },
      { text: '🗑 Delete for Me', style: 'destructive', onPress: () => onDeleteForMe?.(message) },
    ];
    if (isSent) {
      opts.push({ text: '🗑 Delete for Everyone', style: 'destructive', onPress: () => onDeleteForEveryone?.(message) });
    }
    opts.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Message Options', undefined, opts);
  };

  const isDeleted = message.deleted_for_everyone;
  const msgReadStatus = readStatus || message.read_status;

  return (
    <>
      <Pressable
        onLongPress={showOptions}
        style={[styles.wrapper, isSent ? styles.sentWrapper : styles.receivedWrapper]}
        delayLongPress={300}
      >
        {/* Star indicator */}
        {isStarred && (
          <View style={[styles.starIndicator, isSent ? { right: 0 } : { left: 0 }]}>
            <Text style={{ fontSize: 10 }}>⭐</Text>
          </View>
        )}

        <View style={[styles.bubble, { backgroundColor: bgColor }, isDeleted && styles.deletedBubble]}>
          {showSenderName && !isSent && message.sender && (
            <Text style={[styles.senderName, { color: COLORS.primary }]}>
              {message.sender.display_name || message.sender.username || ''}
            </Text>
          )}

          {message.forwarded_from_id && (
            <View style={styles.forwardedRow}>
              <MaterialIcons name="forward" size={13} color={colors.textMuted} />
              <Text style={[styles.forwardedText, { color: colors.textMuted }]}>Forwarded</Text>
            </View>
          )}

          {message.reply_to && !isDeleted && <ReplyBar reply={message.reply_to} colors={colors} />}

          {isDeleted ? (
            <View style={styles.textRow}>
              <MaterialIcons name="block" size={14} color={colors.textMuted} />
              <Text style={[styles.deletedText, { color: colors.textMuted }]}>This message was deleted</Text>
            </View>
          ) : message.message_type === 'image' && message.image_url ? (
            <View>
              <Image source={{ uri: message.image_url }} style={styles.image} contentFit="cover" transition={200} />
              <View style={styles.imageFooter}>
                <Text style={[styles.timeInner, { color: isSent ? '#4FC3F7' : colors.textMuted }]}>
                  {formatTime(message.created_at)}
                </Text>
                {isSent && <ReadReceipt status={msgReadStatus} isDark={isDark} />}
              </View>
            </View>
          ) : message.message_type === 'voice' ? (
            <View>
              <VoiceBubble message={message} isSent={isSent} colors={colors} />
              <View style={[styles.textRow, { marginTop: 4 }]}>
                <Text style={[styles.time, { color: isSent ? (isDark ? '#4FC3F7' : '#5A8A6E') : colors.textMuted }]}>
                  {formatTime(message.created_at)}
                </Text>
                {isSent && <ReadReceipt status={msgReadStatus} isDark={isDark} />}
              </View>
            </View>
          ) : (
            <View style={styles.textRow}>
              <Text style={[styles.text, { color: colors.text }]}>{message.content}</Text>
              <View style={styles.timeRow}>
                {message.is_edited && (
                  <Text style={[styles.editedLabel, { color: colors.textMuted }]}>edited</Text>
                )}
                <Text style={[styles.time, { color: isSent ? (isDark ? '#4FC3F7' : '#5A8A6E') : colors.textMuted }]}>
                  {formatTime(message.created_at)}
                </Text>
                {isSent && <ReadReceipt status={msgReadStatus} isDark={isDark} />}
              </View>
            </View>
          )}
        </View>

        {/* Reactions row */}
        {reactions && reactions.length > 0 && (
          <ReactionsRow
            reactions={reactions}
            onToggle={emoji => onToggleReaction?.(message.id, emoji)}
            colors={colors}
          />
        )}
      </Pressable>

      {/* Emoji Picker Modal */}
      <Modal
        visible={showEmojiPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmojiPicker(false)}
      >
        <TouchableOpacity
          style={styles.emojiOverlay}
          activeOpacity={1}
          onPress={() => setShowEmojiPicker(false)}
        >
          <View style={[styles.emojiPicker, { backgroundColor: colors.card }]}>
            {REACTION_EMOJIS.map(emoji => (
              <Pressable
                key={emoji}
                onPress={() => {
                  onToggleReaction?.(message.id, emoji);
                  setShowEmojiPicker(false);
                }}
                style={({ pressed }) => [styles.emojiBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
});

const styles = StyleSheet.create({
  wrapper: { marginVertical: 2, marginHorizontal: SPACING.md },
  sentWrapper: { alignItems: 'flex-end' },
  receivedWrapper: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '82%', borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  deletedBubble: { opacity: 0.7 },
  starIndicator: { position: 'absolute', top: -6, zIndex: 1 },
  senderName: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semiBold, marginBottom: 2 },
  forwardedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  forwardedText: { fontSize: FONTS.sizes.xs, fontStyle: 'italic' },
  replyBar: {
    borderLeftWidth: 3, paddingLeft: SPACING.sm, paddingVertical: 4,
    marginBottom: SPACING.sm, borderRadius: RADIUS.sm, paddingRight: SPACING.sm,
  },
  replyName: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semiBold, marginBottom: 2 },
  replyText: { fontSize: FONTS.sizes.xs },
  textRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm, flexWrap: 'wrap' },
  text: { fontSize: FONTS.sizes.md, lineHeight: 20, flexShrink: 1 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-end', marginBottom: 1 },
  time: { fontSize: FONTS.sizes.xs },
  editedLabel: { fontSize: 10, fontStyle: 'italic' },
  deletedText: { fontSize: FONTS.sizes.sm, fontStyle: 'italic' },
  image: { width: 200, height: 200, borderRadius: RADIUS.md },
  imageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  timeInner: { fontSize: FONTS.sizes.xs, textAlign: 'right' },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, minWidth: 160 },
  playBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  voiceInfo: { flex: 1, gap: 4 },
  waveformBar: { height: 4, borderRadius: 2, flexDirection: 'row', overflow: 'hidden' },
  waveformFill: { borderRadius: 2 },
  voiceDuration: { fontSize: FONTS.sizes.xs },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4, maxWidth: '82%' },
  reactionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: RADIUS.full, borderWidth: 1,
  },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 11, fontWeight: FONTS.weights.semiBold },
  emojiOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  emojiPicker: {
    flexDirection: 'row', padding: SPACING.lg, gap: SPACING.lg,
    borderRadius: RADIUS.xl, elevation: 10,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10,
  },
  emojiBtn: { padding: SPACING.xs },
  emojiText: { fontSize: 30 },
});
