import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth, useAlert } from '@/template';
import { useTheme } from '@/contexts/ThemeContext';
import {
  getGroupMembers, addGroupMember, removeGroupMember, updateGroupInfo,
} from '@/services/chatService';
import { uploadGroupAvatar } from '@/services/storageService';
import { searchProfiles } from '@/services/profileService';
import { Avatar } from '@/components/ui/Avatar';
import { GroupMember, UserProfile } from '@/types';
import { FONTS, SPACING, RADIUS, COLORS } from '@/constants/theme';

export default function GroupInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupAvatar, setGroupAvatar] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  const isAdmin = members.some(m => m.user_id === user?.id && m.role === 'admin');

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await getGroupMembers(id);
    if (data?.length > 0 && !groupName) {
      // Load group name from conversation on first fetch
      const supabase = (await import('@/template')).getSupabaseClient();
      const { data: conv } = await supabase.from('conversations').select('name, avatar_url').eq('id', id).single();
      if (conv) {
        if (conv.name) setGroupName(conv.name);
        if (conv.avatar_url) setGroupAvatar(conv.avatar_url);
      }
    }
    setMembers(data);
    setLoading(false);
  }, [id, groupName]);

  useEffect(() => { refresh(); }, [refresh]);

  const handlePickAvatar = async () => {
    if (!isAdmin) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { showAlert('Permission Needed', 'Allow photo library access'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setSaving(true);
    const { url, error } = await uploadGroupAvatar(id, result.assets[0].uri);
    if (error) { setSaving(false); showAlert('Error', error); return; }
    const { error: updateErr } = await updateGroupInfo(id, { avatar_url: url || undefined });
    setSaving(false);
    if (updateErr) showAlert('Error', updateErr);
    else { setGroupAvatar(url || undefined); showAlert('Updated', 'Group photo changed'); }
  };

  const handleSaveName = async () => {
    if (!groupName.trim()) return;
    setSaving(true);
    const { error } = await updateGroupInfo(id, { name: groupName.trim() });
    setSaving(false);
    if (error) showAlert('Error', error);
    else { setEditingName(false); showAlert('Saved', 'Group name updated'); }
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim() || !user?.id) { setSearchResults([]); return; }
    setSearching(true);
    const existingIds = new Set(members.map(m => m.user_id));
    const { data } = await searchProfiles(q, user.id);
    setSearchResults(data.filter(p => !existingIds.has(p.id)));
    setSearching(false);
  };

  const handleAddMember = async (profile: UserProfile) => {
    const { error } = await addGroupMember(id, profile.id);
    if (error) showAlert('Error', error);
    else { showAlert('Added', `${profile.display_name || profile.username || profile.email} added to group`); refresh(); setShowAddMember(false); setSearchQuery(''); setSearchResults([]); }
  };

  const handleRemoveMember = (member: GroupMember) => {
    const name = member.profile?.display_name || member.profile?.username || member.profile?.email || 'member';
    showAlert(`Remove ${name}?`, 'They will be removed from the group', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          const { error } = await removeGroupMember(id, member.user_id);
          if (error) showAlert('Error', error);
          else refresh();
        },
      },
    ]);
  };

  const currentName = members.length > 0 ? (groupName || 'Group') : 'Group';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { backgroundColor: colors.header, paddingTop: insets.top + 4, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Group Info</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <Pressable onPress={handlePickAvatar} disabled={!isAdmin}>
            <Avatar uri={groupAvatar} name={currentName} size="xxl" isDark={isDark} />
            {isAdmin && (
              <View style={[styles.cameraBadge, { backgroundColor: COLORS.primary }]}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <MaterialIcons name="camera-alt" size={16} color="#fff" />}
              </View>
            )}
          </Pressable>

          {editingName ? (
            <View style={styles.nameEdit}>
              <TextInput
                value={groupName}
                onChangeText={setGroupName}
                style={[styles.nameInput, { color: colors.text, borderBottomColor: COLORS.primary }]}
                autoFocus
                placeholder="Group name"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.nameActions}>
                <Pressable onPress={() => setEditingName(false)} hitSlop={8}>
                  <MaterialIcons name="close" size={22} color={colors.icon} />
                </Pressable>
                <Pressable onPress={handleSaveName} hitSlop={8}>
                  <MaterialIcons name="check" size={22} color={COLORS.primary} />
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => { if (isAdmin) { setGroupName(currentName); setEditingName(true); } }} style={styles.nameRow}>
              <Text style={[styles.groupName, { color: colors.text }]}>{currentName}</Text>
              {isAdmin && <MaterialIcons name="edit" size={16} color={COLORS.primary} />}
            </Pressable>
          )}
          <Text style={[styles.memberCount, { color: colors.textSecondary }]}>
            {members.length} / 50 members
          </Text>
        </View>

        {/* Members */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>MEMBERS</Text>
          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ margin: SPACING.lg }} />
          ) : (
            members.map(member => (
              <View key={member.user_id} style={[styles.memberRow, { borderBottomColor: colors.border }]}>
                <Avatar uri={member.profile?.avatar_url} name={member.profile?.display_name || member.profile?.username || ''} size="md" isDark={isDark} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.memberName, { color: colors.text }]}>
                    {member.user_id === user?.id ? 'You' : (member.profile?.display_name || member.profile?.username || member.profile?.email || '')}
                  </Text>
                  {member.role === 'admin' && (
                    <Text style={[styles.adminBadge, { color: COLORS.primary }]}>Admin</Text>
                  )}
                </View>
                {isAdmin && member.user_id !== user?.id && (
                  <Pressable onPress={() => handleRemoveMember(member)} hitSlop={8}>
                    <MaterialIcons name="remove-circle-outline" size={22} color={colors.danger} />
                  </Pressable>
                )}
              </View>
            ))
          )}
        </View>

        {/* Add member */}
        {isAdmin && members.length < 50 && (
          <View style={styles.section}>
            <Pressable
              onPress={() => setShowAddMember(!showAddMember)}
              style={[styles.addMemberBtn, { backgroundColor: colors.surface, borderColor: COLORS.primary }]}
            >
              <MaterialIcons name="person-add" size={20} color={COLORS.primary} />
              <Text style={[styles.addMemberText, { color: COLORS.primary }]}>Add Member</Text>
            </Pressable>

            {showAddMember && (
              <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <MaterialIcons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  value={searchQuery}
                  onChangeText={handleSearch}
                  placeholder="Search by name, email..."
                  placeholderTextColor={colors.textMuted}
                  style={[styles.searchInput, { color: colors.text }]}
                  autoCapitalize="none"
                  autoFocus
                />
                {searching && <ActivityIndicator size="small" color={COLORS.primary} />}
              </View>
            )}

            {searchResults.map(profile => (
              <Pressable
                key={profile.id}
                onPress={() => handleAddMember(profile)}
                style={({ pressed }) => [styles.searchResultRow, { backgroundColor: pressed ? colors.surface : 'transparent' }]}
              >
                <Avatar uri={profile.avatar_url} name={profile.display_name || profile.username || ''} size="sm" isDark={isDark} />
                <View>
                  <Text style={[styles.memberName, { color: colors.text }]}>{profile.display_name || profile.username || profile.email}</Text>
                  <Text style={[styles.adminBadge, { color: colors.textSecondary }]}>{profile.email}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.semiBold },
  avatarSection: { alignItems: 'center', paddingVertical: SPACING.xxl, gap: SPACING.sm },
  cameraBadge: {
    position: 'absolute', bottom: 4, right: 4,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  groupName: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold },
  memberCount: { fontSize: FONTS.sizes.sm },
  nameEdit: { alignItems: 'center', gap: SPACING.sm, width: '60%' },
  nameInput: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, borderBottomWidth: 2, paddingBottom: 4, textAlign: 'center', width: '100%' },
  nameActions: { flexDirection: 'row', gap: SPACING.lg },
  section: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg },
  sectionLabel: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semiBold, letterSpacing: 0.8, marginBottom: SPACING.md },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberName: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.medium },
  adminBadge: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.medium },
  addMemberBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1,
    marginBottom: SPACING.md,
  },
  addMemberText: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semiBold },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.sm, borderRadius: RADIUS.lg, borderWidth: 1, marginBottom: SPACING.sm,
  },
  searchInput: { flex: 1, fontSize: FONTS.sizes.md },
  searchResultRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.sm, borderRadius: RADIUS.md },
});
