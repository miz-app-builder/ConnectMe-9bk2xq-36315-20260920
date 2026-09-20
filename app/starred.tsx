import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/template';
import { useTheme } from '@/contexts/ThemeContext';
import { getStarredMessages } from '@/services/starService';
import { Avatar } from '@/components/ui/Avatar';
import { Message } from '@/types';
import { FONTS, SPACING, COLORS } from '@/constants/theme';

export default function StarredMessagesScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    getStarredMessages(user.id).then(({ data }) => {
      setMessages(data);
      setLoading(false);
    });
  }, [user?.id]);

  function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { backgroundColor: colors.header, paddingTop: insets.top + 4, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Starred Messages</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={[styles.item, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <View style={styles.itemHeader}>
                <Avatar
                  uri={item.sender?.avatar_url}
                  name={item.sender?.display_name || item.sender?.username || ''}
                  size="sm" isDark={isDark}
                />
                <Text style={[styles.senderName, { color: COLORS.primary }]}>
                  {item.sender?.display_name || item.sender?.username || 'Unknown'}
                </Text>
                <Text style={[styles.itemTime, { color: colors.textMuted }]}>{formatTime(item.created_at)}</Text>
                <Text style={{ fontSize: 14 }}>⭐</Text>
              </View>
              <Text style={[styles.itemContent, { color: colors.text }]}>
                {item.message_type === 'image' ? '📷 Photo' :
                  item.message_type === 'voice' ? '🎤 Voice message' : item.content || ''}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 40 }}>⭐</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No starred messages yet</Text>
              <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                Long press a message and tap Star to save it here
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.semiBold },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  item: { padding: SPACING.lg, borderBottomWidth: StyleSheet.hairlineWidth, gap: SPACING.sm },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  senderName: { flex: 1, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semiBold },
  itemTime: { fontSize: FONTS.sizes.xs },
  itemContent: { fontSize: FONTS.sizes.md, lineHeight: 20 },
  empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.md, paddingHorizontal: SPACING.xxl },
  emptyText: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.semiBold },
  emptyHint: { fontSize: FONTS.sizes.sm, textAlign: 'center', lineHeight: 20 },
});
