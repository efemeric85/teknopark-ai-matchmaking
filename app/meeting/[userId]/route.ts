import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;

    // Get user info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
    }

    // Get matches where user is either user1 or user2
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('*')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    if (matchesError) {
      console.error('Matches error:', matchesError);
      throw matchesError;
    }

    // Get partner info for each match
    const matchesWithPartners = await Promise.all(
      (matches || []).map(async (match) => {
        const partnerId = match.user1_id === userId ? match.user2_id : match.user1_id;
        
        const { data: partner } = await supabase
          .from('users')
          .select('id, full_name, company, position, current_intent')
          .eq('id', partnerId)
          .single();

        return {
          ...match,
          partner
        };
      })
    );

    return NextResponse.json({
      user,
      matches: matchesWithPartners
    });
  } catch (error: any) {
    console.error('Error fetching meeting data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
