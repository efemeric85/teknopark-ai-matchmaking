import { createClient } from '@supabase/supabase-js';
import { NextResponse, NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Admin token required
  const token = request.headers.get('x-admin-token');
  if (!token) {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 });
  }

  const { data: creds } = await supabase.from('admin_settings').select('email, password').eq('id', 1).single();
  if (!creds) {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 });
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(creds.email + ':' + creds.password + '-teknopark-2026');
  const buf = await crypto.subtle.digest('SHA-256', data);
  const expected = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

  if (token !== expected) {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 });
  }

  try {
    const { data: events } = await supabase.from('events').select('*').order('created_at', { ascending: false });
    const { data: users } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    const { data: matches } = await supabase.from('matches').select('*').order('created_at', { ascending: false });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      events: events?.map(e => ({ id: e.id, name: e.name, status: e.status, duration: e.duration, round_duration_sec: e.round_duration_sec })),
      users: users?.map(u => ({ id: u.id, name: u.full_name, email: u.email, event_id: u.event_id })),
      matches: matches?.map(m => ({ id: m.id, event_id: m.event_id, user1: m.user1_id, user2: m.user2_id, round: m.round_number, status: m.status, started_at: m.started_at })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Sunucu hatasi.' }, { status: 500 });
  }
}
