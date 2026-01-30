import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = createServerClient();
    const userId = params.userId;

    // Get all matches and filter
    const { data: allMatches, error: allError } = await supabase
      .from('matches')
      .select('*')
      .order('created_at', { ascending: false }); // Order by most recent first
    
    if (allError) {
      console.error('Supabase error:', allError);
      throw allError;
    }

    // Filter matches where user is either user_a or user_b
    const matchesData = (allMatches || []).filter(match => 
      match.user_a_id === userId || match.user_b_id === userId
    );

    // Auto-complete expired matches
    const now = Date.now();
    for (const match of matchesData) {
      if (match.status === 'active' && match.started_at) {
        const startedAt = new Date(match.started_at).getTime();
        const elapsed = Math.floor((now - startedAt) / 1000);
        const duration = 360; // 6 minutes
        
        if (elapsed > duration) {
          // Mark as completed
          await supabase
            .from('matches')
            .update({ status: 'completed' })
            .eq('id', match.id);
          match.status = 'completed';
        }
      }
    }

    // Now get the related data for each match
    const transformedMatches = await Promise.all(matchesData.map(async (match) => {
      // Get user_a
      const { data: userA } = await supabase
        .from('users')
        .select('id, full_name, company, position, current_intent')
        .eq('id', match.user_a_id)
        .single();

      // Get user_b
      const { data: userB } = await supabase
        .from('users')
        .select('id, full_name, company, position, current_intent')
        .eq('id', match.user_b_id)
        .single();

      // Get event
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

    return NextResponse.json({ matches: transformedMatches });
  } catch (error: any) {
    console.error('Matches fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Bir hata oluştu' },
      { status: 500 }
    );
  }
}
