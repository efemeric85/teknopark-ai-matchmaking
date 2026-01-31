import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
        db: { schema: 'public' }
      }
    );
    
    const userId = params.userId;

    // Check if user is registered for any active event
    const { data: eventUser } = await supabase
      .from('event_users')
      .select(`
        event_id,
        checked_in,
        events:event_id (
          id,
          status,
          round_duration_sec
        )
      `)
      .eq('user_id', userId)
      .eq('checked_in', true)
      .single();

    const isInActiveEvent = eventUser?.events?.status === 'active';
    const roundDuration = eventUser?.events?.round_duration_sec || 360;

    // Get all matches
    const { data: allMatches, error: allError } = await supabase
      .from('matches')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (allError) {
      console.error('Supabase error:', allError);
      throw allError;
    }

    // Filter matches for this user
    const matchesData = (allMatches || []).filter(match => 
      match.user_a_id === userId || match.user_b_id === userId
    );

    // Check if there are any matches in user's event (to know if matching started)
    let matchingStarted = false;
    let activeMatchStartedAt: string | null = null;
    
    if (eventUser?.event_id) {
      const eventMatches = (allMatches || []).filter(m => m.event_id === eventUser.event_id);
      matchingStarted = eventMatches.length > 0;
      
      // Find any active match in the event to get the timer reference
      const activeMatch = eventMatches.find(m => m.status === 'active' && m.started_at);
      if (activeMatch) {
        activeMatchStartedAt = activeMatch.started_at;
      }
    }

    // Transform matches with related data
    const transformedMatches = await Promise.all(matchesData.map(async (match) => {
      const { data: userA } = await supabase
        .from('users')
        .select('id, full_name, company, position, current_intent')
        .eq('id', match.user_a_id)
        .single();

      const { data: userB } = await supabase
        .from('users')
        .select('id, full_name, company, position, current_intent')
        .eq('id', match.user_b_id)
        .single();

      const { data: event } = await supabase
        .from('events')
        .select('id, name, theme, round_duration_sec')
        .eq('id', match.event_id)
        .single();

      const isUserA = match.user_a_id === userId;
      const partner = isUserA ? userB : userA;
      const myHandshake = isUserA ? match.handshake_a : match.handshake_b;
      const partnerHandshake = isUserA ? match.handshake_b : match.handshake_a;

      return {
        ...match,
        user_a: userA,
        user_b: userB,
        event,
        partner,
        myHandshake,
        partnerHandshake,
        isUserA
      };
    }));

    return NextResponse.json(
      { 
        matches: transformedMatches,
        isInActiveEvent,
        matchingStarted,
        activeMatchStartedAt,
        roundDuration
      },
      { 
        headers: { 
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        } 
      }
    );
  } catch (error: any) {
    console.error('Matches fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Bir hata oluştu' },
      { status: 500 }
    );
  }
}
