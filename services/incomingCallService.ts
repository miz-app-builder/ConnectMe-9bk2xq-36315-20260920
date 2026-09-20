import { supabase } from '@/template/supabase';

export async function getIncomingRingingCall(userId: string) {
  const { data, error } = await supabase.from('calls').select('*')
    .eq('callee_id', userId).eq('status', 'ringing')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return { data, error: error?.message || null };
}

export function subscribeToIncomingCalls(userId: string, onCall: (call: any) => void) {
  const channel = supabase.channel(`incoming-calls:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'calls',
      filter: `callee_id=eq.${userId}`,
    }, payload => {
      if (payload.new?.status === 'ringing') onCall(payload.new);
    })
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
