import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;

    // Get participants
    const { data: participants } = await supabase
      .from('users')
      .select('*')
      .eq('event_id', params.id);

    return NextResponse.json({
      event: {
        ...event,
        participants: participants || []
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Sunucu hatasi.' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    const { data: event, error } = await supabase
      .from('events')
      .update(body)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ event });
  } catch (error: any) {
    return NextResponse.json({ error: 'Sunucu hatasi.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // First delete related records (matches, users)
    await supabase
      .from('matches')
      .delete()
      .eq('event_id', params.id);

    await supabase
      .from('users')
      .delete()
      .eq('event_id', params.id);

    // Then delete the event
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Sunucu hatasi.' }, { status: 500 });
  }
}
