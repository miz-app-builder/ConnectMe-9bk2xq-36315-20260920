import { useState, useEffect, useCallback } from 'react';
import { getProfile, updateProfile } from '@/services/profileService';
import { UserProfile } from '@/types';
import { useAuth } from '@/template';

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    const { data, error: err } = await getProfile(user.id);
    if (!err) setProfile(data);
    else setError(err);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const update = useCallback(async (
    updates: Partial<Pick<UserProfile, 'display_name' | 'username' | 'bio' | 'avatar_url'>>
  ) => {
    if (!user?.id) return { error: 'Not logged in' };
    setSaving(true);
    const { data, error: err } = await updateProfile(user.id, updates);
    setSaving(false);
    if (!err && data) setProfile(data);
    return { error: err };
  }, [user?.id]);

  return { profile, loading, saving, error, update, refresh: fetchProfile };
}
