import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\\s+/i, '');
    if (!accessToken) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });

    const { call_id } = await req.json();
    if (!call_id) return new Response(JSON.stringify({ error: 'call_id is required' }), { status: 400, headers: cors });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false },
    });
    const { data: { user: callerUser }, error: authError } = await userClient.auth.getUser(accessToken);
    if (authError || !callerUser) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const { data: call, error: callError } = await admin.from('calls').select('*').eq('id', call_id).single();
    if (callError || !call) return new Response(JSON.stringify({ error: callError?.message || 'Call not found' }), { status: 404, headers: cors });
    if (call.caller_id !== callerUser.id) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: cors });

    const { data: profile } = await admin.from('user_profiles').select('push_token, display_name, username').eq('id', call.callee_id).single();
    if (!profile?.push_token) return new Response(JSON.stringify({ sent: false, reason: 'no_push_token' }), { headers: cors });

    const { data: caller } = await admin.from('user_profiles').select('display_name, username').eq('id', call.caller_id).single();
    const callerName = caller?.display_name || caller?.username || 'NexTalk user';

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: profile.push_token,
        title: callerName,
        body: `Incoming ${call.call_type} call`,
        sound: 'default',
        channelId: 'calls',
        priority: 'high',
        data: { type: 'incoming_call', callId: call.id, callType: call.call_type },
      }),
    });

    return new Response(JSON.stringify({ sent: response.ok }), { status: response.ok ? 200 : 502, headers: cors });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }), { status: 500, headers: cors });
  }
});
