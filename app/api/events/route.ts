import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const supabase = createServerClient();
    
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ events: events || [] });
  } catch (error: any) {
    console.error('Events fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Bir hata oluştu' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, theme, round_duration_sec = 360 } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Etkinlik adı zorunludur' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    
    const { data: event, error } = await supabase
      .from('events')
      .insert({
        id: uuidv4(),
        name,
        theme,
        status: 'draft',
        round_duration_sec
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, event });
  } catch (error: any) {
    console.error('Event creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Etkinlik oluşturulurken bir hata oluştu' },
      { status: 500 }
    );
  }
}
