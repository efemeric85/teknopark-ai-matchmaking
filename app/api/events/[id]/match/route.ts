import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { generateIcebreaker } from '@/lib/openai';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { round_number = 1 } = body;
    
    const supabase = createServerClient();
    const eventId = params.id;

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Etkinlik bulunamadı' },
        { status: 404 }
      );
    }

    // Get all checked-in users for this event
    const { data: eventUsers, error: usersError } = await supabase
      .from('event_users')
      .select(`
        user_id,
        users:user_id (
          id, full_name, current_intent, embedding
        )
      `)
      .eq('event_id', eventId)
      .eq('checked_in', true);

    if (usersError || !eventUsers || eventUsers.length < 2) {
      return NextResponse.json(
        { error: 'Eşleştirme için yeterli katılımcı yok' },
        { status: 400 }
      );
    }

    const users = eventUsers.map(eu => eu.users).filter(Boolean);

    // Get existing matches for this round to avoid duplicates
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('user_a_id, user_b_id')
      .eq('event_id', eventId);

    const matchedPairs = new Set(
      (existingMatches || []).map(m => 
        [m.user_a_id, m.user_b_id].sort().join('-')
      )
    );

    // Simple matching algorithm: pair users who haven't been matched before
    const matches = [];
    const usedUsers = new Set();
    let tableNumber = 1;

    for (let i = 0; i < users.length; i++) {
      if (usedUsers.has(users[i].id)) continue;

      for (let j = i + 1; j < users.length; j++) {
        if (usedUsers.has(users[j].id)) continue;

        const pairKey = [users[i].id, users[j].id].sort().join('-');
        if (matchedPairs.has(pairKey)) continue;

        // Generate icebreaker question
        let icebreakerQuestion = "Merhaba! Kendinizi tanıtır mısınız?";
        try {
          icebreakerQuestion = await generateIcebreaker(
            { name: users[i].full_name, intent: users[i].current_intent },
            { name: users[j].full_name, intent: users[j].current_intent },
            event.theme || 'Teknoloji'
          );
        } catch (e) {
          console.error('Icebreaker generation failed:', e);
        }

        matches.push({
          id: uuidv4(),
          event_id: eventId,
          user_a_id: users[i].id,
          user_b_id: users[j].id,
          round_number,
          table_number: tableNumber++,
          icebreaker_question: icebreakerQuestion,
          status: 'pending'
        });

        usedUsers.add(users[i].id);
        usedUsers.add(users[j].id);
        break;
      }
    }

    if (matches.length === 0) {
      return NextResponse.json(
        { error: 'Yeni eşleştirme yapılamadı. Tüm kombinasyonlar tükenmiş olabilir.' },
        { status: 400 }
      );
    }

    // Insert matches
    const { data: insertedMatches, error: matchError } = await supabase
      .from('matches')
      .insert(matches)
      .select();

    if (matchError) throw matchError;

    // Update event status to active
    await supabase
      .from('events')
      .update({ status: 'active' })
      .eq('id', eventId);

    return NextResponse.json({ 
      success: true, 
      matches: insertedMatches,
      message: `${insertedMatches?.length || 0} eşleştirme oluşturuldu`
    });
  } catch (error: any) {
    console.error('Matching error:', error);
    return NextResponse.json(
      { error: error.message || 'Eşleştirme sırasında bir hata oluştu' },
      { status: 500 }
    );
  }
}
