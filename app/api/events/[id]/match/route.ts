import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;

    // Get all participants for this event
    const { data: participants, error: participantsError } = await supabase
      .from('users')
      .select('*')
      .eq('event_id', eventId);

    if (participantsError) throw participantsError;

    if (!participants || participants.length < 2) {
      return NextResponse.json({ 
        error: 'En az 2 katılımcı gerekli.' 
      }, { status: 400 });
    }

    // Simple round-robin matching algorithm
    const matches = [];
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        matches.push({
          event_id: eventId,
          user1_id: shuffled[i].id,
          user2_id: shuffled[i + 1].id,
          round_number: 1,
          status: 'pending'
        });
      }
    }

    // If odd number of participants, last person waits
    if (shuffled.length % 2 !== 0) {
      console.log('Odd number of participants, one person will wait');
    }

    // Delete existing matches for this event (if re-matching)
    await supabase
      .from('matches')
      .delete()
      .eq('event_id', eventId);

    // Insert new matches
    if (matches.length > 0) {
      const { error: insertError } = await supabase
        .from('matches')
        .insert(matches);

      if (insertError) throw insertError;
    }

    // Update event status
    await supabase
      .from('events')
      .update({ status: 'active' })
      .eq('id', eventId);

    return NextResponse.json({ 
      success: true, 
      matchCount: matches.length,
      message: `${matches.length} eşleştirme oluşturuldu.`
    });
  } catch (error: any) {
    console.error('Error creating matches:', error);
    return NextResponse.json({ 
      error: error.message || 'Eşleştirme sırasında hata oluştu.' 
    }, { status: 500 });
  }
}
