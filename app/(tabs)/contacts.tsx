import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput,
  Pressable, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth, useAlert } from '@/template';
import { useTheme } from '@/contexts/ThemeContext';
import { useContacts } from '@/hooks/useContacts';
import { getOrCreateConversation, createGroupConversation } from '@/services/chatService';
import { blockUser, unblockUser, getBlockedUsers } from '@/services/blockService';
import { ContactItem } from '@/components/contacts/ContactItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { Contact, UserProfile } from '@/types';
import { FONTS, SPACING, RADIUS, COLORS } from '@/constants/theme';
import { Avatar } from '@/components/ui/Avatar';

export default function ContactsScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'contacts' | 'search'>('contacts');
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());

  // Group creation state
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<UserProfile[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const {
    contacts, searchResults, loading, searching,
    search, add, remove, isInContacts, clearSearch,
  } = useContacts();

  React.useEffect(() => {
    if (!user?.id) return;
    getBlockedUsers(user.id).then(({ data }) => setBlockedIds(new Set(data)));
  }, [user?.id]);

  const handleBlock = async (profileId: string, name: string) => {
    if (!user?.id) return;
    const isBlocked = blockedIds.has(profileId);
    showAlert(
      isBlocked ? `Unblock ${name}?` : `Block ${name}?`,
      isBlocked ? 'They will be able to message you again.' : 'They will no longer be able to message you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isBlocked ? 'Unblock' : 'Block',
          style: 'destructive',
          onPress: async () => {
            if (isBlocked) {
              await unblockUser(user.id, profileId);
              setBlockedIds(prev => { const n = new Set(prev); n.delete(profileId); return n; });
            } else {
              await blockUser(user.id, profileId);
              setBlockedIds(prev => new Set([...prev, profileId]));
            }
          },
        },
      ]
    );
  };

  const handleSearch = (text: string) => {
    setQuery(text);
    if (text.trim()) { setActiveTab('search'); search(text); }
    else { setActiveTab('contacts'); clearSearch(); }
  };

  const handleMessage = async (profile: UserProfile) => {
    if (!user?.id) return;
    const { data: convId, error } = await getOrCreateConversation(user.id, profile.id);
    if (error || !convId) { showAlert('Error', error || 'Could not open chat'); return; }
    router.push(`/chat/${convId}`);
  };

  const handleAdd = async (contactId: string) => {
    const { error } = await add(contactId);
    if (error) showAlert('Error', error);
    else showAlert('Added', 'Contact saved');
  };

  const handleRemove = async (contactId: string) => {
    showAlert('Remove Contact', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { const { error } = await remove(contactId); if (error) showAlert('Error', error); } },
    ]);
  };

  const toggleGroupMember = (profile: UserProfile) => {
    setSelectedMembers(prev =>
      prev.some(m => m.id === profile.id)
        ? prev.filter(m => m.id !== profile.id)
        : prev.length < 49 ? [...prev, profile] : prev
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) { showAlert('Name Required', 'Please enter a group name'); return; }
    if (selectedMembers.length < 1) { showAlert('Add Members', 'Add at least 1 member'); return; }
    if (!user?.id) return;
    setCreatingGroup(true);
    const { data: convId, error } = await createGroupConversation(user.id, groupName.trim(), selectedMembers.map(m => m.id));
    setCreatingGroup(false);
    if (error) { showAlert('Error', error); return; }
    setShowGroupModal(false);
    setGroupName('');
    setSelectedMembers([]);
    router.push(`/chat/${convId}`);
  };

  const displayList = activeTab === 'search' ? searchResults : contacts.map(c => c.contact).filter(Boolean) as UserProfile[];
  const contactProfiles = contacts.map(c => c.contact).filter(Boolean) as UserProfile[];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { backgroundColor: colors.header, paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Contacts</Text>
        <Pressable
          onPress={() => setShowGroupModal(true)}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          hitSlop={8}
        >
          <MaterialIcons name="group-add" size={24} color={COLORS.primary} />
        </Pressable>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
        <View style={[styles.searchInput, { backgroundColor: colors.inputBg }]}>
          <MaterialIcons name="search" size={20} color={colors.textMuted} />
          <TextInput
            value={query} onChangeText={handleSearch}
            placeholder="Search by name, username or email"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchText, { color: colors.text }]}
            autoCapitalize="none" returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => handleSearch('')}>
              <MaterialIcons name="close" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {searching && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={COLORS.primary} size="small" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Searching...</Text>
        </View>
      )}

      <FlatList
        data={displayList}
        keyExtractor={(item: UserProfile) => item.id}
        renderItem={({ item }) => (
          <ContactItem
            profile={item} isContact={isInContacts(item.id)}
            isBlocked={blockedIds.has(item.id)}
            onMessage={() => handleMessage(item)}
            onAdd={() => handleAdd(item.id)}
            onRemove={() => handleRemove(item.id)}
            onBlock={() => handleBlock(item.id, item.display_name || item.username || item.email || '')}
            colors={colors} isDark={isDark}
          />
        )}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
        ListEmptyComponent={loading || searching ? null : (
          <EmptyState
            icon={activeTab === 'search' ? 'search-off' : 'people-outline'}
            title={activeTab === 'search' ? 'No users found' : 'No contacts yet'}
            subtitle={activeTab === 'search' ? 'Try a different name or email' : 'Use the search bar to find people'}
            colors={colors}
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={displayList.length === 0 ? { flex: 1 } : undefined}
      />

      {/* Group Creation Modal */}
      <Modal visible={showGroupModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => { setShowGroupModal(false); setSelectedMembers([]); setGroupName(''); }} hitSlop={8}>
              <MaterialIcons name="close" size={24} color={colors.icon} />
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Group</Text>
            <Pressable onPress={handleCreateGroup} disabled={creatingGroup} hitSlop={8}>
              {creatingGroup
                ? <ActivityIndicator color={COLORS.primary} size="small" />
                : <Text style={[styles.createBtn, { color: groupName.trim() && selectedMembers.length > 0 ? COLORS.primary : colors.textMuted }]}>Create</Text>
              }
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <View style={[styles.groupNameBox, { backgroundColor: colors.inputBg }]}>
              <MaterialIcons name="group" size={20} color={COLORS.primary} />
              <TextInput
                value={groupName} onChangeText={setGroupName}
                placeholder="Group name (required)"
                placeholderTextColor={colors.textMuted}
                style={[styles.groupNameInput, { color: colors.text }]}
                maxLength={50}
              />
            </View>

            {selectedMembers.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedRow}>
                {selectedMembers.map(m => (
                  <Pressable key={m.id} onPress={() => toggleGroupMember(m)} style={styles.selectedChip}>
                    <Avatar uri={m.avatar_url} name={m.display_name || m.username || ''} size="sm" isDark={isDark} />
                    <MaterialIcons name="cancel" size={14} color={colors.danger} style={styles.chipRemove} />
                    <Text style={[styles.chipName, { color: colors.textSecondary }]} numberOfLines={1}>
                      {m.display_name || m.username || ''}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              ADD FROM CONTACTS ({selectedMembers.length}/49)
            </Text>

            {contactProfiles.length === 0 ? (
              <Text style={[styles.emptyContacts, { color: colors.textMuted }]}>No contacts yet. Add contacts first.</Text>
            ) : (
              contactProfiles.map(profile => {
                const selected = selectedMembers.some(m => m.id === profile.id);
                return (
                  <Pressable
                    key={profile.id}
                    onPress={() => toggleGroupMember(profile)}
                    style={({ pressed }) => [styles.memberSelectRow, { backgroundColor: pressed ? colors.surface : 'transparent' }]}
                  >
                    <Avatar uri={profile.avatar_url} name={profile.display_name || profile.username || ''} size="md" isDark={isDark} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.memberName, { color: colors.text }]}>{profile.display_name || profile.username || profile.email}</Text>
                      <Text style={[styles.memberEmail, { color: colors.textSecondary }]}>{profile.email}</Text>
                    </View>
                    <View style={[styles.checkbox, { borderColor: selected ? COLORS.primary : colors.border, backgroundColor: selected ? COLORS.primary : 'transparent' }]}>
                      {selected && <MaterialIcons name="check" size={14} color="#fff" />}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold },
  searchBar: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  searchInput: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: SPACING.sm, height: 44 },
  searchText: { flex: 1, fontSize: FONTS.sizes.md },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm },
  loadingText: { fontSize: FONTS.sizes.sm },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: SPACING.lg },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: StyleSheet.hairlineWidth, paddingTop: SPACING.xxl },
  modalTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.semiBold },
  createBtn: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semiBold },
  modalBody: { padding: SPACING.lg, gap: SPACING.lg },
  groupNameBox: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.lg },
  groupNameInput: { flex: 1, fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.medium },
  selectedRow: { marginBottom: SPACING.sm },
  selectedChip: { alignItems: 'center', marginRight: SPACING.md, width: 60 },
  chipRemove: { position: 'absolute', top: -2, right: 8 },
  chipName: { fontSize: FONTS.sizes.xs, textAlign: 'center', marginTop: 2 },
  sectionLabel: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semiBold, letterSpacing: 0.8, marginBottom: SPACING.sm },
  emptyContacts: { fontSize: FONTS.sizes.sm, textAlign: 'center', marginTop: SPACING.lg },
  memberSelectRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm },
  memberName: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.medium },
  memberEmail: { fontSize: FONTS.sizes.xs },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
