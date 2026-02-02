import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data: events } = await supabase.from('events').select('*');
  const { data: users } = await supabase.from('users').select('id, full_name, email, event_id');
  const { data: matches } = await supabase.from('matches').select('*').order('created_at', { ascending: false }).limit(20);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    events: events || [],
    users: users || [],
    recentMatches: (matches || []).map(m => ({
      id: m.id,
      event_id: m.event_id,
      user1_id: m.user1_id,
      user2_id: m.user2_id,
      round: m.round_number,
      status: m.status,
      started_at: m.started_at,
      created_at: m.created_at,
    })),
  }, { status: 200 });
}
