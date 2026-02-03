import { createClient } from '@supabase/supabase-js';
import { NextResponse, NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ events: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, events: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, date, duration } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Etkinlik adı gerekli.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('events')
      .insert({
        name: name.trim(),
        date: date || new Date().toISOString().split('T')[0],
        duration: parseInt(duration) || 360,
        round_duration_sec: parseInt(duration) || 360,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ event: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
