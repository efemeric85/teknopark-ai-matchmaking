import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = createServerClient();
    const userId = params.userId;

    // Query matches directly without complex joins first
    const { data: rawMatches, error: rawError } = await supabase
      .from('matches')
      .select('*')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .order('round_number', { ascending: true });

    if (rawError) {
      console.error('Raw matches error:', rawError);
    }

    // If direct query fails, get all and filter
    let matchesData = rawMatches;
    if (!matchesData || matchesData.length === 0) {
      const { data: allMatches } = await supabase
        .from('matches')
        .select('*')
        .order('round_number', { ascending: true });
      
      matchesData = (allMatches || []).filter(match => 
        match.user_a_id === userId || match.user_b_id === userId
      );
    }

    // Now get the related data for each match
    const transformedMatches = await Promise.all((matchesData || []).map(async (match) => {
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
