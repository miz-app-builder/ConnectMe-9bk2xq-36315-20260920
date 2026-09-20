import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import {
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  RTCView,
} from 'react-native-webrtc';
import { useAuth } from '@/template';
import { useTheme } from '@/contexts/ThemeContext';
import {
  getCall, sendCallSignal, subscribeToCallSignals, subscribeToCall,
  updateCall, type CallRecord,
} from '@/services/callService';

const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [call, setCall] = useState<CallRecord | null>(null);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const pcRef = useRef<any>(null);
  const streamRef = useRef<any>(null);
  const mountedRef = useRef(true);

  const endCall = useCallback(async () => {
    if (!id || !user?.id) return;
    await sendCallSignal(id, user.id, 'hangup');
    await updateCall(id, { status: 'ended', ended_at: new Date().toISOString() });
    streamRef.current?.getTracks().forEach((track: any) => track.stop());
    pcRef.current?.close();
    if (mountedRef.current) router.back();
  }, [id, user?.id, router]);

  useEffect(() => {
    mountedRef.current = true;
    if (!id || !user?.id) return;
    let unsubscribeSignals = () => {};
    let unsubscribeCall = () => {};
    let cancelled = false;

    (async () => {
      const { data, error } = await getCall(id);
      if (cancelled || error || !data) return;
      setCall(data);

      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: data.call_type === 'video',
      });
      if (cancelled) {
        stream.getTracks().forEach((track: any) => track.stop());
        return;
      }
      streamRef.current = stream;
      setLocalStream(stream);

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;
      stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));

      pc.ontrack = (event: any) => {
        const [remote] = event.streams || [];
        if (remote) setRemoteStream(remote);
      };
      pc.onicecandidate = (event: any) => {
        if (event.candidate) {
          void sendCallSignal(id, user.id, 'ice', event.candidate.toJSON());
        }
      };
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        setConnected(state === 'connected');
      };

      unsubscribeSignals = subscribeToCallSignals(id, async signal => {
        if (signal.sender_id === user.id) return;
        if (signal.signal_type === 'offer' && !data.offer) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendCallSignal(id, user.id, 'answer', answer);
          await updateCall(id, { answer, status: 'accepted', started_at: new Date().toISOString() });
        } else if (signal.signal_type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
          await updateCall(id, { status: 'accepted', started_at: new Date().toISOString() });
        } else if (signal.signal_type === 'ice') {
          try { await pc.addIceCandidate(new RTCIceCandidate(signal.payload)); } catch {}
        } else if (signal.signal_type === 'hangup') {
          await updateCall(id, { status: 'ended', ended_at: new Date().toISOString() });
          if (mountedRef.current) router.back();
        }
      });

      unsubscribeCall = subscribeToCall(id, next => {
        setCall(next);
        if (next.status === 'ended' || next.status === 'rejected' || next.status === 'missed') {
          if (mountedRef.current) router.back();
        }
      });

      if (data.caller_id === user.id) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendCallSignal(id, user.id, 'offer', offer);
        await updateCall(id, { offer, status: 'ringing' });
      } else if (data.offer && !data.answer) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendCallSignal(id, user.id, 'answer', answer);
        await updateCall(id, { answer, status: 'accepted', started_at: new Date().toISOString() });
      }
    })().catch(() => {
      if (mountedRef.current) router.back();
    });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      unsubscribeSignals();
      unsubscribeCall();
      streamRef.current?.getTracks().forEach((track: any) => track.stop());
      pcRef.current?.close();
    };
  }, [id, user?.id, router]);

  if (!call) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color="#25D366" size="large" /></View>;
  }

  const isVideo = call.call_type === 'video';

  return (
    <View style={[styles.root, { backgroundColor: '#111' }]}>
      <StatusBar style="light" />
      {isVideo && remoteStream ? (
        <RTCView streamURL={remoteStream.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" />
      ) : (
        <View style={styles.audioStage}>
          <MaterialIcons name={isVideo ? 'videocam' : 'call'} size={72} color="#25D366" />
          <Text style={styles.stageTitle}>{connected ? 'Connected' : call.status === 'accepted' ? 'Connecting...' : 'Calling...'}</Text>
        </View>
      )}
      {isVideo && localStream && !cameraOff ? (
        <RTCView streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" />
      ) : null}

      <View style={styles.topBar}>
        <Text style={styles.callType}>{isVideo ? 'Video call' : 'Audio call'}</Text>
        <Text style={styles.status}>{connected ? 'Connected' : 'Connecting...'}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable onPress={() => {
          setMuted(v => {
            const next = !v;
            localStream?.getAudioTracks().forEach((t: any) => { t.enabled = !next; });
            return next;
          });
        }} style={styles.control}>
          <MaterialIcons name={muted ? 'mic-off' : 'mic'} size={24} color="#fff" />
        </Pressable>
        {isVideo && (
          <Pressable onPress={() => {
            setCameraOff(v => !v);
            localStream?.getVideoTracks().forEach((t: any) => { t.enabled = cameraOff; });
          }} style={styles.control}>
            <MaterialIcons name={cameraOff ? 'videocam-off' : 'videocam'} size={24} color="#fff" />
          </Pressable>
        )}
        <Pressable onPress={endCall} style={[styles.control, styles.endControl]}>
          <MaterialIcons name="call-end" size={28} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  audioStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  stageTitle: { color: '#fff', fontSize: 22, fontWeight: '600' },
  topBar: { position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center', gap: 6 },
  callType: { color: '#fff', fontSize: 18, fontWeight: '700' },
  status: { color: '#aaa', fontSize: 13 },
  localVideo: { position: 'absolute', top: 90, right: 18, width: 120, height: 180, borderRadius: 14, overflow: 'hidden' },
  controls: { position: 'absolute', bottom: 48, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 18 },
  control: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  endControl: { backgroundColor: '#e53935', width: 62, height: 62, borderRadius: 31 },
});
