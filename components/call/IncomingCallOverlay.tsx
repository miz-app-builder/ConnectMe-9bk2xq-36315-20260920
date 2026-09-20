import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, Vibration } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/template';
import { useTheme } from '@/contexts/ThemeContext';
import { getCall, updateCall } from '@/services/callService';
import { getIncomingRingingCall, subscribeToIncomingCalls } from '@/services/incomingCallService';
import { getProfile } from '@/services/profileService';

export function IncomingCallOverlay() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [call, setCall] = useState<any>(null);
  const [callerName, setCallerName] = useState('Incoming call');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (!user?.id) return;
    const show = async (next: any) => {
      if (!next || next.callee_id !== user.id || next.status !== 'ringing') return;
      const { data } = await getCall(next.id);
      if (!mounted.current || !data || data.status !== 'ringing') return;
      setCall(data);
      Vibration.vibrate([0, 700, 500], true);
      setTimeout(async () => {
        const latest = await getCall(data.id);
        if (latest.data?.status === 'ringing') {
          await updateCall(data.id, { status: 'missed', ended_at: new Date().toISOString() });
          if (mounted.current) { Vibration.cancel(); setCall(null); }
        }
      }, 30000);
      const { data: profile } = await getProfile(data.caller_id);
      if (profile) setCallerName(profile.display_name || profile.username || profile.email || 'Incoming call');
    };
    getIncomingRingingCall(user.id).then(({ data }) => { if (data) void show(data); });
    const unsubscribe = subscribeToIncomingCalls(user.id, next => void show(next));
    return () => { mounted.current = false; unsubscribe(); Vibration.cancel(); };
  }, [user?.id]);

  if (!call) return null;

  const reject = async () => {
    await updateCall(call.id, { status: 'rejected', ended_at: new Date().toISOString() });
    if (mounted.current) { Vibration.cancel(); setCall(null); }
  };
  const accept = async () => {
    await updateCall(call.id, { status: 'accepted', started_at: new Date().toISOString() });
    if (mounted.current) { Vibration.cancel(); setCall(null); }
    router.push({ pathname: '/call/[id]', params: { id: call.id } });
  };

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.icon}><MaterialIcons name={call.call_type === 'video' ? 'videocam' : 'call'} size={30} color="#fff" /></View>
        <Text style={[styles.title, { color: colors.text }]}>{callerName}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Incoming {call.call_type} call
        </Text>
        <View style={styles.actions}>
          <Pressable onPress={reject} style={[styles.action, styles.reject]}><MaterialIcons name="call-end" size={24} color="#fff" /></Pressable>
          <Pressable onPress={accept} style={[styles.action, styles.accept]}><MaterialIcons name="call" size={24} color="#fff" /></Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 9999, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 70 },
  card: { width: '90%', maxWidth: 420, borderRadius: 22, borderWidth: 1, padding: 22, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { marginTop: 4, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 34, marginTop: 20 },
  action: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  reject: { backgroundColor: '#e53935' },
  accept: { backgroundColor: '#25D366' },
});
