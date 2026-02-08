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

    const supabase = createServerClient();    // Step 1: Get current match state
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id')
      .maybeSingle();    if (matchError) {
      console.error('Match query error:', matchError);
      return NextResponse.json(
        { error: 'Sunucu hatasi.' },
        { status: 500 }
      );
    }

    if (!match) {
      console.error('Match not found:', { matchId });
      return NextResponse.json(
        { error: `Eşleşme bulunamadı (ID: ${matchId?.slice(0,8)}...)` },
        { status: 404 }
      );
    }

    // Step 2: Determine which side is doing handshake
    const isUserA = user_id === match.user1_id;
    const isUserB = user_id === match.user2_id;

    console.log('Handshake check:', { 
      user_id, 
      user1_id: match.user1_id, 
      user2_id: match.user2_id,
      isUserA, 
      isUserB 
    });

    if (!isUserA && !isUserB) {
      return NextResponse.json(
        { error: 'Bu eşleşmede yetkisiz kullanıcı' },
        { status: 403 }
      );
    }

    const updateField = isUserA ? 'handshake_a' : 'handshake_b';    // Step 3: Update the handshake field
    const { data: updateData, error: updateError } = await supabase
      .from('matches')
      .update({ [updateField]: true })
      .eq('id')
      .select();    if (updateError) {
      console.error('Handshake update error:', updateError);
      throw updateError;
    }

    // Step 4: Re-fetch to check if BOTH are now true
    const { data: updatedMatch, error: refetchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id')
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
        .eq('id');

      if (activateError) {
        console.error('Match activation error:', activateError);
        throw activateError;
      }

      // Fetch final state
      const { data: activatedMatch } = await supabase
        .from('matches')
        .select('*')
        .eq('id')
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
      { error: 'Sunucu hatasi.' || 'Handshake sırasında bir hata oluştu' },
      { status: 500 }
    );
  }
}
