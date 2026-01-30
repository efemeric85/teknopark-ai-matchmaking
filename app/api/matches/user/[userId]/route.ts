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

    // First, let's try to get all matches and filter manually
    const { data: allMatches, error: allError } = await supabase
      .from('matches')
      .select(`
        *,
        user_a:user_a_id (
          id, full_name, company, position, current_intent
        ),
        user_b:user_b_id (
          id, full_name, company, position, current_intent
        ),
        event:event_id (
          id, name, theme, round_duration_sec
        )
      `)
      .order('round_number', { ascending: true });

    console.log('All matches count:', allMatches?.length);
    
    if (allError) {
      console.error('Supabase error:', allError);
      throw allError;
    }

    // Filter matches where user is either user_a or user_b
    const matches = (allMatches || []).filter(match => 
      match.user_a_id === userId || match.user_b_id === userId
    );

    console.log('Filtered matches count:', matches.length);

    // Transform matches to include partner info
    const transformedMatches = matches.map(match => {
      const isUserA = match.user_a_id === userId;
      const partner = isUserA ? match.user_b : match.user_a;
      const myHandshake = isUserA ? match.handshake_a : match.handshake_b;
      const partnerHandshake = isUserA ? match.handshake_b : match.handshake_a;

      return {
        ...match,
        partner,
        myHandshake,
        partnerHandshake,
        isUserA
      };
    });

    return NextResponse.json({ matches: transformedMatches });
  } catch (error: any) {
    console.error('Matches fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Bir hata oluştu' },
      { status: 500 }
    );
  }
}
