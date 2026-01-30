import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    
    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', params.id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Etkinlik bulunamadı' },
        { status: 404 }
      );
    }

    // Get participants
    const { data: eventUsers, error: usersError } = await supabase
      .from('event_users')
      .select(`
        *,
        users:user_id (
          id, email, full_name, company, position, current_intent, created_at
        )
      `)
      .eq('event_id', params.id);

    const participants = eventUsers?.map(eu => eu.users).filter(Boolean) || [];

    return NextResponse.json({ event, participants });
  } catch (error: any) {
    console.error('Event fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Bir hata oluştu' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const supabase = createServerClient();
    
    const { data: event, error } = await supabase
      .from('events')
      .update(body)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, event });
  } catch (error: any) {
    console.error('Event update error:', error);
    return NextResponse.json(
      { error: error.message || 'Etkinlik güncellenirken bir hata oluştu' },
      { status: 500 }
    );
  }
}
