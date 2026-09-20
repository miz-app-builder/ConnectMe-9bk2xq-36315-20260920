import { supabase } from '@/template/supabase';

export type CallType = 'audio' | 'video';
export type CallStatus = 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended';

export interface CallRecord {
  id: string;
  caller_id: string;
  callee_id: string;
  call_type: CallType;
  status: CallStatus;
  offer?: any | null;
  answer?: any | null;
  started_at?: string | null;
  ended_at?: string | null;
  created_at: string;
}

export async function createCall(callerId: string, calleeId: string, callType: CallType) {
  const { data, error } = await supabase
    .from('calls')
    .insert({ caller_id: callerId, callee_id: calleeId, call_type: callType })
    .select('*')
    .single();
  return { data: data as CallRecord | null, error: error?.message || null };
}

export async function getCall(callId: string) {
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .eq('id', callId)
    .single();
  return { data: data as CallRecord | null, error: error?.message || null };
}

export async function updateCall(callId: string, patch: Partial<CallRecord>) {
  const { data, error } = await supabase
    .from('calls')
    .update(patch)
    .eq('id', callId)
    .select('*')
    .single();
  return { data: data as CallRecord | null, error: error?.message || null };
}

export async function sendCallSignal(
  callId: string,
  senderId: string,
  signalType: 'offer' | 'answer' | 'ice' | 'hangup',
  payload: Record<string, unknown> = {},
) {
  const { error } = await supabase.from('call_signals').insert({
    call_id: callId,
    sender_id: senderId,
    signal_type: signalType,
    payload,
  });
  return { error: error?.message || null };
}

export function subscribeToCallSignals(callId: string, onSignal: (signal: any) => void) {
  const channel = supabase
    .channel(`call-signals:${callId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'call_signals', filter: `call_id=eq.${callId}` },
      payload => onSignal(payload.new),
    )
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}

export function subscribeToCall(callId: string, onChange: (call: CallRecord) => void) {
  const channel = supabase
    .channel(`call:${callId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'calls', filter: `id=eq.${callId}` },
      payload => onChange(payload.new as CallRecord),
    )
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}

export async function getCallHistory(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .or(`caller_id.eq.${userId},callee_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data: (data || []) as CallRecord[], error: error?.message || null };
}
