import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET() {
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
