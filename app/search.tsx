import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  Pressable, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/template';
import { useTheme } from '@/contexts/ThemeContext';
import { searchMessages, SearchResult } from '@/services/searchService';
import { Avatar } from '@/components/ui/Avatar';
import { FONTS, SPACING, RADIUS, COLORS } from '@/constants/theme';

export default function SearchScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (!text.trim() || !user?.id) { setResults([]); return; }
    setLoading(true);
    const { data } = await searchMessages(user.id, text);
    setResults(data);
    setLoading(false);
  }, [user?.id]);

  function highlightText(content: string, q: string) {
    if (!q.trim()) return <Text style={[styles.resultContent, { color: colors.text }]}>{content}</Text>;
    const idx = content.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return <Text style={[styles.resultContent, { color: colors.text }]}>{content}</Text>;
    return (
      <Text style={[styles.resultContent, { color: colors.text }]}>
        {content.slice(0, idx)}
        <Text style={{ backgroundColor: COLORS.primary + '44', color: COLORS.primary, fontWeight: '600' }}>
          {content.slice(idx, idx + q.length)}
        </Text>
        {content.slice(idx + q.length)}
      </Text>
    );
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.header, paddingTop: insets.top + 4, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.primary} />
        </Pressable>
        <View style={[styles.searchBox, { backgroundColor: colors.inputBg }]}>
          <MaterialIcons name="search" size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={handleSearch}
            placeholder="Search messages..."
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            autoFocus
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => handleSearch('')}>
              <MaterialIcons name="close" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, index) => `${item.message.id}-${index}`}
          renderItem={({ item }) => {
            const { message, conversation } = item;
            const name = conversation.is_group
              ? (conversation.name || 'Group')
              : (conversation.otherUser?.display_name || conversation.otherUser?.username || conversation.otherUser?.email || '');
            const avatarUri = conversation.is_group
              ? conversation.avatar_url
              : conversation.otherUser?.avatar_url;

            return (
              <Pressable
                onPress={() => router.push(`/chat/${conversation.id}`)}
                style={({ pressed }) => [
                  styles.resultItem,
                  { backgroundColor: pressed ? colors.surface : colors.background, borderBottomColor: colors.border },
                ]}
              >
                <Avatar uri={avatarUri} name={name} size="md" isDark={isDark} />
                <View style={styles.resultBody}>
                  <View style={styles.resultHeader}>
                    <Text style={[styles.resultName, { color: colors.text }]}>{name}</Text>
                    <Text style={[styles.resultTime, { color: colors.textMuted }]}>
                      {formatTime(message.created_at)}
                    </Text>
                  </View>
                  {highlightText(message.content || '', query)}
                  <Text style={[styles.resultSender, { color: colors.textSecondary }]}>
                    {message.sender?.display_name || message.sender?.username || ''}
                  </Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            query.length > 0 ? (
              <View style={styles.empty}>
                <MaterialIcons name="search-off" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No messages found</Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <MaterialIcons name="search" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>Search across all chats</Text>
              </View>
            )
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
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, height: 40,
  },
  searchInput: { flex: 1, fontSize: FONTS.sizes.md },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  resultItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md,
    padding: SPACING.lg, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultBody: { flex: 1, gap: 3 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultName: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semiBold },
  resultTime: { fontSize: FONTS.sizes.xs },
  resultContent: { fontSize: FONTS.sizes.sm, lineHeight: 18 },
  resultSender: { fontSize: FONTS.sizes.xs },
  empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.md },
  emptyText: { fontSize: FONTS.sizes.md },
});
