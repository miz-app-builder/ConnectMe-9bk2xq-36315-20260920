import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS, AVATAR } from '@/constants/theme';

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: keyof typeof AVATAR;
  isDark?: boolean;
}

function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getColorForName(name?: string | null): string {
  const colors = ['#128C7E', '#075E54', '#25D366', '#00A884', '#34B7F1', '#667781'];
  if (!name) return colors[0];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return colors[sum % colors.length];
}

export const Avatar = memo(({ uri, name, size = 'md', isDark }: AvatarProps) => {
  const px = AVATAR[size];
  const fontSize = px * 0.38;
  const bgColor = getColorForName(name);

  return (
    <View style={[styles.container, { width: px, height: px, borderRadius: px / 2, backgroundColor: bgColor }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: px, height: px, borderRadius: px / 2 }}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <Text style={[styles.initials, { fontSize }]}>{getInitials(name)}</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
