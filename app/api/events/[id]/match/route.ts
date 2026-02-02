import { createClient } from '@supabase/supabase-js';
import { NextResponse, NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST: Eşleştir ve başlat (eski eşleşmeler varsa otomatik tamamla)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;

    // Katılımcıları al
    const { data: participants, error: participantsError } = await supabase
      .from('users')
      .select('*')
      .eq('event_id', eventId);

    if (participantsError) throw participantsError;

    if (!participants || participants.length < 2) {
      return NextResponse.json({ error: 'En az 2 katılımcı gerekli.' }, { status: 400 });
    }

    // Mevcut round numarasını bul
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('round_number, status, id')
      .eq('event_id', eventId);

    const currentMaxRound = existingMatches && existingMatches.length > 0
      ? Math.max(...existingMatches.map(m => m.round_number || 1))
      : 0;

    // ÖNCEKİ TAMAMLANMAMIŞ EŞLEŞMELERİ OTOMATİK TAMAMLA
    if (currentMaxRound > 0) {
      const unfinished = (existingMatches || []).filter(
        m => m.status === 'pending' || m.status === 'active'
      );
      if (unfinished.length > 0) {
        const unfinishedIds = unfinished.map(m => m.id);
        await supabase
          .from('matches')
          .update({ status: 'completed' })
          .in('id', unfinishedIds);
      }
    }

    const newRound = currentMaxRound + 1;

    // Daha önce eşleşmiş çiftleri bul
    const previousPairs = new Set<string>();
    if (existingMatches && existingMatches.length > 0) {
      const { data: allPrevMatches } = await supabase
        .from('matches')
        .select('user1_id, user2_id')
        .eq('event_id', eventId);

      if (allPrevMatches) {
        allPrevMatches.forEach(m => {
          previousPairs.add(`${m.user1_id}-${m.user2_id}`);
          previousPairs.add(`${m.user2_id}-${m.user1_id}`);
        });
      }
    }

    // Eşleştirme algoritması
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const matched = new Set<string>();
    const matches: any[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < shuffled.length; i++) {
      if (matched.has(shuffled[i].id)) continue;
      for (let j = i + 1; j < shuffled.length; j++) {
        if (matched.has(shuffled[j].id)) continue;
        const pairKey = `${shuffled[i].id}-${shuffled[j].id}`;
        if (newRound > 1 && previousPairs.has(pairKey)) continue;

        matches.push({
          event_id: eventId,
          user1_id: shuffled[i].id,
          user2_id: shuffled[j].id,
          round_number: newRound,
          status: 'active',
          started_at: now,
        });
        matched.add(shuffled[i].id);
        matched.add(shuffled[j].id);
        break;
      }
    }

    // Eşleşemeyenler fallback
    const unmatched = shuffled.filter(p => !matched.has(p.id));
    for (let i = 0; i < unmatched.length; i += 2) {
      if (i + 1 < unmatched.length) {
        matches.push({
          event_id: eventId,
          user1_id: unmatched[i].id,
          user2_id: unmatched[i + 1].id,
          round_number: newRound,
          status: 'active',
          started_at: now,
        });
      }
    }

    if (matches.length > 0) {
      const { error: insertError } = await supabase.from('matches').insert(matches);
      if (insertError) throw insertError;
    }

    await supabase.from('events').update({ status: 'active' }).eq('id', eventId);

    const waitingNames = shuffled
      .filter(p => !matched.has(p.id) && !unmatched.slice(0, unmatched.length - (unmatched.length % 2)).find(u => u.id === p.id))
      .map(p => p.full_name);

    return NextResponse.json({
      success: true,
      round: newRound,
      matchCount: matches.length,
      waitingCount: participants.length - matches.length * 2,
      message: `Tur ${newRound}: ${matches.length} eşleştirme başlatıldı.`,
    });
  } catch (error: any) {
    console.error('Match creation error:', error);
    return NextResponse.json({ error: error.message || 'Eşleştirme hatası.' }, { status: 500 });
  }
}

// DELETE: Tüm eşleşmeleri sıfırla
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;

    await supabase.from('matches').delete().eq('event_id', eventId);
    await supabase.from('events').update({ status: 'draft' }).eq('id', eventId);

    return NextResponse.json({ success: true, message: 'Tüm eşleşmeler sıfırlandı.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
