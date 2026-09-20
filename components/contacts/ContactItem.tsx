import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { UserProfile } from '@/types';
import { ThemeColors, FONTS, SPACING, RADIUS, COLORS } from '@/constants/theme';

interface ContactItemProps {
  profile: UserProfile;
  isContact?: boolean;
  isBlocked?: boolean;
  onMessage: () => void;
  onAdd?: () => void;
  onRemove?: () => void;
  onBlock?: () => void;
  colors: ThemeColors;
  isDark: boolean;
}

export const ContactItem = memo(({
  profile, isContact, isBlocked, onMessage, onAdd, onRemove, onBlock, colors, isDark
}: ContactItemProps) => {
  const name = profile.display_name || profile.username || profile.email;
  const sub = profile.username ? `@${profile.username}` : profile.email;

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <Avatar uri={profile.avatar_url} name={name} size="md" isDark={isDark} />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{name}</Text>
          {isBlocked && (
            <View style={[styles.blockedBadge, { backgroundColor: colors.danger + '22' }]}>
              <Text style={[styles.blockedText, { color: colors.danger }]}>Blocked</Text>
            </View>
          )}
        </View>
        <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>{sub}</Text>
      </View>
      <View style={styles.actions}>
        {!isBlocked && (
          <Pressable
            onPress={onMessage}
            style={({ pressed }) => [styles.iconBtn, { backgroundColor: COLORS.primary, opacity: pressed ? 0.8 : 1 }]}
          >
            <MaterialIcons name="chat" size={18} color="#fff" />
          </Pressable>
        )}
        {isContact ? (
          onRemove ? (
            <Pressable onPress={onRemove} style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 }]}>
              <MaterialIcons name="person-remove" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null
        ) : (
          onAdd ? (
            <Pressable onPress={onAdd} style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 }]}>
              <MaterialIcons name="person-add" size={18} color={COLORS.primary} />
            </Pressable>
          ) : null
        )}
        {onBlock && (
          <Pressable
            onPress={onBlock}
            style={({ pressed }) => [styles.iconBtn, { backgroundColor: isBlocked ? colors.surface : colors.surface, opacity: pressed ? 0.8 : 1 }]}
          >
            <MaterialIcons
              name={isBlocked ? 'lock-open' : 'block'}
              size={18}
              color={isBlocked ? COLORS.primary : colors.danger}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  name: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semiBold, flexShrink: 1 },
  blockedBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm,
  },
  blockedText: { fontSize: 10, fontWeight: '600' },
  sub: { fontSize: FONTS.sizes.sm },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
});
