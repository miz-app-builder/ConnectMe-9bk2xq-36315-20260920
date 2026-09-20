import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useTheme } from '@/contexts/ThemeContext';
import { useProfile } from '@/hooks/useProfile';
import { Avatar } from '@/components/ui/Avatar';
import { FONTS, SPACING, RADIUS, COLORS } from '@/constants/theme';

export default function SettingsScreen() {
  const { colors, isDark, themeMode, setThemeMode } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const { profile } = useProfile();

  const name = profile?.display_name || profile?.username || user?.email || '';

  const handleLogout = () => {
    showAlert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive',
        onPress: async () => {
          await logout();
        }
      }
    ]);
  };

  const handleDeleteAccount = () => {
    showAlert(
      'Delete Account',
      'This will permanently delete your account and all your messages. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            const supabase = getSupabaseClient();
            await supabase.auth.signOut();
          }
        }
      ]
    );
  };

  const toggleDarkMode = () => {
    setThemeMode(isDark ? 'light' : 'dark');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { backgroundColor: colors.header, paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {/* Profile Card */}
        <Pressable
          onPress={() => router.push('/edit-profile')}
          style={({ pressed }) => [styles.profileCard, { backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 }]}
        >
          <Avatar uri={profile?.avatar_url} name={name} size="lg" isDark={isDark} />
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>{name}</Text>
            <Text style={[styles.profileSub, { color: colors.textSecondary }]}>
              {profile?.bio || 'Tap to edit your profile'}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.icon} />
        </Pressable>

        {/* Preferences */}
        <SectionHeader label="Preferences" colors={colors} />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon="dark-mode"
            label="Dark Mode"
            colors={colors}
            right={
              <Switch
                value={isDark}
                onValueChange={toggleDarkMode}
                trackColor={{ false: colors.border, true: COLORS.primary }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* Account */}
        <SectionHeader label="Account" colors={colors} />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon="star"
            label="Starred Messages"
            colors={colors}
            onPress={() => router.push('/starred')}
            showChevron
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <SettingRow
            icon="lock"
            label="Privacy & Security"
            colors={colors}
            onPress={() => showAlert('Coming Soon', 'Privacy settings coming in the next update')}
            showChevron
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <SettingRow
            icon="notifications"
            label="Notifications"
            colors={colors}
            onPress={() => showAlert('Coming Soon', 'Notification settings coming soon')}
            showChevron
          />
        </View>

        {/* Logout */}
        <SectionHeader label="Session" colors={colors} />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
          >
            <MaterialIcons name="logout" size={22} color={colors.danger} />
            <Text style={[styles.rowLabel, { color: colors.danger }]}>Log Out</Text>
          </Pressable>
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <Pressable
            onPress={handleDeleteAccount}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
          >
            <MaterialIcons name="delete-forever" size={22} color={colors.danger} />
            <Text style={[styles.rowLabel, { color: colors.danger }]}>Delete Account</Text>
          </Pressable>
        </View>

        <Text style={[styles.version, { color: colors.textMuted }]}>ConnectMe v1.0</Text>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ label, colors }: { label: string; colors: any }) {
  return (
    <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{label.toUpperCase()}</Text>
  );
}

function SettingRow({
  icon, label, colors, right, onPress, showChevron,
}: {
  icon: any; label: string; colors: any;
  right?: React.ReactNode; onPress?: () => void; showChevron?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
      disabled={!onPress}
    >
      <MaterialIcons name={icon} size={22} color={colors.icon} />
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <View style={styles.rowRight}>
        {right}
        {showChevron && <MaterialIcons name="chevron-right" size={22} color={colors.icon} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    margin: SPACING.lg,
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  profileInfo: { flex: 1, gap: 4 },
  profileName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semiBold,
  },
  profileSub: {
    fontSize: FONTS.sizes.sm,
  },
  sectionHeader: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    letterSpacing: 0.8,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  section: {
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    minHeight: 52,
  },
  rowLabel: {
    flex: 1,
    fontSize: FONTS.sizes.md,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: SPACING.lg + 22 + SPACING.md,
  },
  version: {
    textAlign: 'center',
    fontSize: FONTS.sizes.xs,
    marginTop: SPACING.xxxl,
  },
});
