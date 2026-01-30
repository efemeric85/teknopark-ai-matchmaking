import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { user_id } = body;
    const matchId = params.id;

    if (!user_id) {
      return NextResponse.json(
        { error: 'Kullanıcı ID gerekli' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Step 1: Get current match state
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return NextResponse.json(
        { error: 'Eşleşme bulunamadı' },
        { status: 404 }
      );
    }

    // Step 2: Determine which side is doing handshake
    const isUserA = user_id === match.user_a_id;
    const isUserB = user_id === match.user_b_id;

    if (!isUserA && !isUserB) {
      return NextResponse.json(
        { error: 'Bu eşleşmede yetkisiz kullanıcı' },
        { status: 403 }
      );
    }

    const updateField = isUserA ? 'handshake_a' : 'handshake_b';

    // Step 3: Update the handshake field
    const { error: updateError } = await supabase
      .from('matches')
      .update({ [updateField]: true })
      .eq('id', matchId);

    if (updateError) {
      console.error('Handshake update error:', updateError);
      throw updateError;
    }

    // Step 4: Re-fetch to check if BOTH are now true
    const { data: updatedMatch, error: refetchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (refetchError || !updatedMatch) {
      throw refetchError || new Error('Match refetch failed');
    }

    // Step 5: ONLY set started_at and status='active' when BOTH handshakes are TRUE
    let finalMatch = updatedMatch;
    let bothReady = false;

    if (updatedMatch.handshake_a === true && 
        updatedMatch.handshake_b === true && 
        updatedMatch.status === 'pending') {
      
      const startedAt = new Date().toISOString();
      
      const { error: activateError } = await supabase
        .from('matches')
        .update({
          status: 'active',
          started_at: startedAt
        })
        .eq('id', matchId);

      if (activateError) {
        console.error('Match activation error:', activateError);
        throw activateError;
      }

      // Fetch final state
      const { data: activatedMatch } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (activatedMatch) {
        finalMatch = activatedMatch;
      }
      
      bothReady = true;
    }

    return NextResponse.json({ 
      success: true, 
      match: finalMatch,
      bothReady,
      handshake_a: finalMatch.handshake_a,
      handshake_b: finalMatch.handshake_b,
      status: finalMatch.status,
      started_at: finalMatch.started_at
    });
  } catch (error: any) {
    console.error('Handshake error:', error);
    return NextResponse.json(
      { error: error.message || 'Handshake sırasında bir hata oluştu' },
      { status: 500 }
    );
  }
}
