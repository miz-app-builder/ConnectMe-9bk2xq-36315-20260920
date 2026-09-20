import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAlert } from '@/template';
import { useTheme } from '@/contexts/ThemeContext';
import { useProfile } from '@/hooks/useProfile';
import { uploadAvatar } from '@/services/storageService';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FONTS, SPACING, RADIUS, COLORS } from '@/constants/theme';

export default function EditProfileScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { profile, saving, update, refresh } = useProfile();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
    }
  }, [profile]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!displayName.trim()) errs.displayName = 'Name is required';
    if (username && !/^[a-z0-9_]{3,20}$/.test(username.trim())) {
      errs.username = 'Username: 3-20 chars, lowercase letters, numbers, underscores only';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Needed', 'Please allow photo library access');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!validate()) return;

    let avatarUrl = profile?.avatar_url;
    if (avatarUri && profile?.id) {
      setUploadingAvatar(true);
      const { url, error: uploadErr } = await uploadAvatar(profile.id, avatarUri);
      setUploadingAvatar(false);
      if (uploadErr) {
        showAlert('Upload Error', uploadErr);
        return;
      }
      avatarUrl = url || avatarUrl;
    }

    const { error } = await update({
      display_name: displayName.trim(),
      username: username.trim() || undefined,
      bio: bio.trim(),
      avatar_url: avatarUrl,
    });

    if (error) {
      showAlert('Save Failed', error);
    } else {
      showAlert('Saved', 'Your profile has been updated');
      refresh();
      router.back();
    }
  };

  const displayedAvatar = avatarUri || profile?.avatar_url;
  const name = displayName || profile?.display_name || '';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.header, paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="close" size={24} color={colors.icon} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <Pressable onPress={handlePickAvatar} style={styles.avatarPressable}>
              <Avatar uri={displayedAvatar} name={name} size="xxl" isDark={isDark} />
              <View style={[styles.cameraBadge, { backgroundColor: COLORS.primary }]}>
                {uploadingAvatar ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <MaterialIcons name="camera-alt" size={18} color="#fff" />
                )}
              </View>
            </Pressable>
            <Text style={[styles.avatarHint, { color: colors.textSecondary }]}>Tap to change photo</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="Full Name"
              value={displayName}
              onChangeText={setDisplayName}
              error={errors.displayName}
              colors={colors}
              placeholder="Your full name"
              returnKeyType="next"
            />
            <Input
              label="Username (optional)"
              value={username}
              onChangeText={text => setUsername(text.toLowerCase())}
              error={errors.username}
              colors={colors}
              placeholder="your_username"
              autoCapitalize="none"
              returnKeyType="next"
            />
            <Input
              label="Bio (optional)"
              value={bio}
              onChangeText={setBio}
              colors={colors}
              placeholder="Tell others a bit about yourself..."
              multiline
              numberOfLines={3}
              style={{ height: 80, textAlignVertical: 'top', paddingTop: SPACING.sm }}
            />
            <Button
              label={saving || uploadingAvatar ? 'Saving...' : 'Save Changes'}
              onPress={handleSave}
              loading={saving || uploadingAvatar}
              style={{ marginTop: SPACING.md }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semiBold,
  },
  scroll: {
    paddingHorizontal: SPACING.lg,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  avatarPressable: {
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarHint: {
    fontSize: FONTS.sizes.sm,
    marginTop: SPACING.sm,
  },
  form: {
    gap: 0,
  },
});
