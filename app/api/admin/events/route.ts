import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: List all events
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: Create new event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, date, duration, round_duration_sec, max_rounds } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Etkinlik adı gerekli.' }, { status: 400 });
    }

    const { data, error } = await supabase.from('events').insert({
      name: name.trim(),
      date: date || new Date().toISOString().split('T')[0],
      duration: duration || 360,
      round_duration_sec: round_duration_sec || duration || 360,
      max_rounds: max_rounds || 5,
      status: 'draft',
    }).select().single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
