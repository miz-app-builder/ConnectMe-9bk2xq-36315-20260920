import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/template';
import { useTheme } from '@/contexts/ThemeContext';
import { Avatar } from '@/components/ui/Avatar';
import { getCallHistory, type CallRecord } from '@/services/callService';
import { getProfile } from '@/services/profileService';
import { FONTS, SPACING, COLORS } from '@/constants/theme';

export default function CallHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [items, setItems] = useState<Array<{ call: CallRecord; name: string; avatar?: string }>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await getCallHistory(user.id, 100);
    const enriched = await Promise.all((data || []).map(async call => {
      const otherId = call.caller_id === user.id ? call.callee_id : call.caller_id;
      const { data: profile } = await getProfile(otherId);
      return { call, name: profile?.display_name || profile?.username || profile?.email || 'Unknown', avatar: profile?.avatar_url };
    }));
    setItems(enriched);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const statusLabel = (call: CallRecord) => {
    if (call.status === 'missed') return 'Missed';
    if (call.status === 'rejected') return 'Declined';
    if (call.status === 'ended' || call.status === 'accepted') return call.call_type === 'video' ? 'Video call' : 'Audio call';
    return 'Calling';
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { backgroundColor: colors.header, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}><MaterialIcons name="arrow-back" size={24} color={colors.icon} /></Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Call History</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View> : (
        <FlatList
          data={items}
          keyExtractor={x => x.call.id}
          onRefresh={load}
          refreshing={loading}
          ListEmptyComponent={<View style={styles.center}><MaterialIcons name="call" size={42} color={colors.textMuted} /><Text style={[styles.empty, { color: colors.textSecondary }]}>No calls yet</Text></View>}
          renderItem={({ item }) => {
            const outgoing = item.call.caller_id === user?.id;
            const missed = item.call.status === 'missed' || item.call.status === 'rejected';
            return (
              <View style={[styles.row, { borderBottomColor: colors.border }]}>
                <Avatar uri={item.avatar} name={item.name} size="md" isDark={isDark} />
                <View style={styles.info}>
                  <Text style={[styles.name, { color: missed ? colors.danger : colors.text }]}>{item.name}</Text>
                  <View style={styles.meta}>
                    <MaterialIcons name={outgoing ? 'call-made' : 'call-received'} size={15} color={missed ? colors.danger : COLORS.primary} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>{statusLabel(item.call)} • {new Date(item.call.created_at).toLocaleString()}</Text>
                  </View>
                </View>
                <MaterialIcons name={item.call.call_type === 'video' ? 'videocam' : 'call'} size={22} color={colors.icon} />
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  empty: { fontSize: FONTS.sizes.md },
  row: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, gap: SPACING.md, borderBottomWidth: StyleSheet.hairlineWidth },
  info: { flex: 1, gap: 5 },
  name: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semiBold },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: FONTS.sizes.xs },
});
