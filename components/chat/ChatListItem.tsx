import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Conversation } from '@/types';
import { ThemeColors, FONTS, SPACING, COLORS } from '@/constants/theme';

interface ChatListItemProps {
  conversation: Conversation;
  onPress: () => void;
  colors: ThemeColors;
  isDark: boolean;
}

function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const ChatListItem = memo(({ conversation, onPress, colors, isDark }: ChatListItemProps) => {
  const { lastMessage, is_group, unread_count } = conversation;

  const name = is_group
    ? (conversation.name || 'Group')
    : (conversation.otherUser?.display_name || conversation.otherUser?.username || conversation.otherUser?.email || '');

  const avatarUri = is_group ? conversation.avatar_url : conversation.otherUser?.avatar_url;

  let preview = 'Say hello!';
  if (lastMessage) {
    if (lastMessage.deleted_for_everyone) {
      preview = 'This message was deleted';
    } else if (lastMessage.message_type === 'image') {
      preview = '📷 Photo';
    } else if (lastMessage.message_type === 'voice') {
      preview = '🎤 Voice message';
    } else {
      preview = lastMessage.content || 'Say hello!';
    }
  }

  const isOnline = !is_group && conversation.otherUser?.is_online;
  const hasUnread = (unread_count || 0) > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, { backgroundColor: pressed ? colors.surface : colors.card }]}
    >
      <View style={styles.avatarWrapper}>
        <Avatar uri={avatarUri} name={name} size="lg" isDark={isDark} />
        {isOnline && <View style={[styles.onlineDot, { borderColor: colors.card }]} />}
        {is_group && (
          <View style={[styles.groupBadge, { backgroundColor: COLORS.primary, borderColor: colors.card }]}>
            <MaterialIcons name="group" size={9} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={[styles.name, { color: colors.text }, hasUnread && styles.nameUnread]} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.rightMeta}>
            {hasUnread && (
              <Text style={[styles.time, { color: COLORS.primary, fontWeight: '600' }]}>
                {formatTime(lastMessage?.created_at)}
              </Text>
            )}
            {!hasUnread && (
              <Text style={[styles.time, { color: colors.textMuted }]}>
                {formatTime(lastMessage?.created_at)}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.previewRow}>
          <Text
            style={[
              styles.preview,
              { color: hasUnread ? colors.text : colors.textSecondary },
              hasUnread && styles.previewUnread,
            ]}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {hasUnread ? (
            <View style={[styles.badge, { backgroundColor: COLORS.primary }]}>
              <Text style={styles.badgeText}>{unread_count! > 99 ? '99+' : unread_count}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: SPACING.md,
  },
  avatarWrapper: { position: 'relative' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 6.5,
    backgroundColor: '#25D366', borderWidth: 2,
  },
  groupBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  content: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semiBold, flex: 1, marginRight: SPACING.sm },
  nameUnread: { fontWeight: FONTS.weights.bold },
  rightMeta: { alignItems: 'flex-end' },
  time: { fontSize: FONTS.sizes.xs },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  preview: { fontSize: FONTS.sizes.sm, flex: 1 },
  previewUnread: { fontWeight: FONTS.weights.medium },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5, marginLeft: SPACING.sm,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
