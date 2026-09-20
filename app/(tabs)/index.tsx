import React from 'react';
import { View, FlatList, Text, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useConversations } from '@/hooks/useConversations';
import { ChatListItem } from '@/components/chat/ChatListItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { Conversation } from '@/types';
import { FONTS, SPACING, COLORS } from '@/constants/theme';

export default function ChatsScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { conversations, loading, refresh } = useConversations();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.header, paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>ConnectMe</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Pressable onPress={() => router.push('/search')} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons name="search" size={24} color={COLORS.primary} />
          </Pressable>
          <Pressable onPress={() => router.push('/(tabs)/contacts')} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons name="edit" size={24} color={COLORS.primary} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item: Conversation) => item.id}
        renderItem={({ item }) => (
          <ChatListItem
            conversation={item}
            onPress={() => router.push(`/chat/${item.id}`)}
            colors={colors}
            isDark={isDark}
          />
        )}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
        )}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="chat-bubble-outline"
              title="No conversations yet"
              subtitle="Search contacts and start chatting"
              colors={colors}
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={conversations.length === 0 ? { flex: 1 } : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    letterSpacing: -0.3,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 74,
  },
});
