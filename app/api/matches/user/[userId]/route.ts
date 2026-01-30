import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = createServerClient();
    const userId = params.userId;

    console.log('Fetching matches for userId:', userId);

    // Get all matches and filter
    const { data: allMatches, error: allError } = await supabase
      .from('matches')
      .select('*')
      .order('round_number', { ascending: true });

    console.log('All matches in DB:', allMatches?.length);
    console.log('Match IDs:', allMatches?.map(m => ({ id: m.id.slice(0,8), round: m.round_number, ua: m.user_a_id.slice(0,8), ub: m.user_b_id.slice(0,8) })));
    
    if (allError) {
      console.error('Supabase error:', allError);
      throw allError;
    }

    // Filter matches where user is either user_a or user_b
    const matchesData = (allMatches || []).filter(match => 
      match.user_a_id === userId || match.user_b_id === userId
    );

    console.log('Filtered matches for user:', matchesData.length);
    console.log('Filtered match IDs:', matchesData.map(m => m.id.slice(0,8)));

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
