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

    // Get the match
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

    // Determine which handshake to update
    const isUserA = match.user_a_id === user_id;
    const isUserB = match.user_b_id === user_id;

    if (!isUserA && !isUserB) {
      return NextResponse.json(
        { error: 'Bu eşleşmede yetkisiz kullanıcı' },
        { status: 403 }
      );
    }

    const updateField = isUserA ? 'handshake_a' : 'handshake_b';
    const otherHandshake = isUserA ? match.handshake_b : match.handshake_a;

    console.log('Handshake attempt:', { matchId, user_id, isUserA, isUserB, updateField, otherHandshake });

    // Update handshake
    const updateData: any = { [updateField]: true };
    
    // If both have shaken hands, start the timer
    if (otherHandshake) {
      updateData.status = 'active';
      updateData.started_at = new Date().toISOString();
    }

    console.log('Update data:', updateData);

    const { data: updatedMatch, error: updateError } = await supabase
      .from('matches')
      .update(updateData)
      .eq('id', matchId)
      .select()
      .single();

    console.log('Update result:', { updatedMatch, updateError });

    if (updateError) throw updateError;

    return NextResponse.json({ 
      success: true, 
      match: updatedMatch,
      bothReady: otherHandshake === true
    });
  } catch (error: any) {
    console.error('Handshake error:', error);
    return NextResponse.json(
      { error: error.message || 'Handshake sırasında bir hata oluştu' },
      { status: 500 }
    );
  }
}
