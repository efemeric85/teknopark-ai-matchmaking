import { createClient } from '@supabase/supabase-js';
import { NextResponse, NextRequest } from 'next/server';

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

    const { data: participants, error: pErr } = await supabase
      .from('users').select('*').eq('event_id', eventId);
    if (pErr) throw pErr;
    if (!participants || participants.length < 2) {
      return NextResponse.json({ error: 'En az 2 katılımcı gerekli.' }, { status: 400 });
    }

    // Mevcut eşleşmeleri al
    const { data: existingMatches } = await supabase
      .from('matches').select('*').eq('event_id', eventId);

    const currentMaxRound = existingMatches && existingMatches.length > 0
      ? Math.max(...existingMatches.map(m => m.round_number || 1)) : 0;

    // Önceki tamamlanmamış eşleşmeleri otomatik tamamla
    if (currentMaxRound > 0) {
      const unfinished = (existingMatches || []).filter(m => m.status === 'pending' || m.status === 'active');
      if (unfinished.length > 0) {
        await supabase.from('matches').update({ status: 'completed' }).in('id', unfinished.map(m => m.id));
      }
    }

    const newRound = currentMaxRound + 1;

    // Daha önce eşleşmiş çiftleri bul
    const previousPairs = new Set<string>();
    if (existingMatches) {
      existingMatches.forEach(m => {
        previousPairs.add(`${m.user1_id}-${m.user2_id}`);
        previousPairs.add(`${m.user2_id}-${m.user1_id}`);
      });
    }

    // Eşleştirme
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const matched = new Set<string>();
    const newMatches: any[] = [];

    for (let i = 0; i < shuffled.length; i++) {
      if (matched.has(shuffled[i].id)) continue;
      for (let j = i + 1; j < shuffled.length; j++) {
        if (matched.has(shuffled[j].id)) continue;
        const pairKey = `${shuffled[i].id}-${shuffled[j].id}`;
        if (newRound > 1 && previousPairs.has(pairKey)) continue;
        newMatches.push({
          event_id: eventId,
          user1_id: shuffled[i].id,
          user2_id: shuffled[j].id,
          round_number: newRound,
          status: 'pending',
          started_at: null,
        });
        matched.add(shuffled[i].id);
        matched.add(shuffled[j].id);
        break;
      }
    }

    // Fallback: eşleşemeyenler
    const unmatched = shuffled.filter(p => !matched.has(p.id));
    for (let i = 0; i < unmatched.length; i += 2) {
      if (i + 1 < unmatched.length) {
        newMatches.push({
          event_id: eventId, user1_id: unmatched[i].id, user2_id: unmatched[i + 1].id,
          round_number: newRound, status: 'pending', started_at: null,
        });
      }
    }

    if (newMatches.length > 0) {
      const { error: insertErr } = await supabase.from('matches').insert(newMatches);
      if (insertErr) throw insertErr;
    }

    await supabase.from('events').update({ status: 'active' }).eq('id', eventId);

    return NextResponse.json({
      success: true, round: newRound, matchCount: newMatches.length,
      waitingCount: participants.length - newMatches.length * 2,
      message: `Tur ${newRound}: ${newMatches.length} eşleştirme oluşturuldu. QR okutmayı bekliyor.`,
    });
  } catch (error: any) {
    console.error('Match error:', error);
    return NextResponse.json({ error: error.message || 'Eşleştirme hatası.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await supabase.from('matches').delete().eq('event_id', params.id);
    await supabase.from('events').update({ status: 'draft' }).eq('id', params.id);
    return NextResponse.json({ success: true, message: 'Tüm eşleşmeler sıfırlandı.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
