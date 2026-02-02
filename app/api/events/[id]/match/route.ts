import { createClient } from '@supabase/supabase-js';
import { NextResponse, NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST: Eşleştirme oluştur ve otomatik başlat
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;

    // Etkinlik bilgilerini al
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Etkinlik bulunamadı.' }, { status: 404 });
    }

    // Katılımcıları al
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

    // Mevcut round numarasını bul
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('round_number')
      .eq('event_id', eventId);

    const currentMaxRound = existingMatches && existingMatches.length > 0
      ? Math.max(...existingMatches.map(m => m.round_number || 1))
      : 0;

    // Mevcut round tamamlanmış mı kontrol et
    if (currentMaxRound > 0) {
      const { data: activeMatches } = await supabase
        .from('matches')
        .select('id')
        .eq('event_id', eventId)
        .eq('round_number', currentMaxRound)
        .in('status', ['pending', 'active']);

      if (activeMatches && activeMatches.length > 0) {
        return NextResponse.json({ 
          error: 'Mevcut turda henüz tamamlanmamış eşleşmeler var.' 
        }, { status: 400 });
      }
    }

    const newRound = currentMaxRound + 1;

    // Daha önce eşleşmiş çiftleri bul (tekrar eşleşmesinler)
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
          started_at: now
        });

        matched.add(shuffled[i].id);
        matched.add(shuffled[j].id);
        break;
      }
    }

    // Eşleşemeyenler için fallback (daha önce eşleşmiş olsa bile)
    const unmatched = shuffled.filter(p => !matched.has(p.id));
    for (let i = 0; i < unmatched.length; i += 2) {
      if (i + 1 < unmatched.length) {
        matches.push({
          event_id: eventId,
          user1_id: unmatched[i].id,
          user2_id: unmatched[i + 1].id,
          round_number: newRound,
          status: 'active',
          started_at: now
        });
      }
    }

    // Yeni eşleşmeleri kaydet
    if (matches.length > 0) {
      const { error: insertError } = await supabase
        .from('matches')
        .insert(matches);

      if (insertError) throw insertError;
    }

    // Etkinlik durumunu güncelle
    await supabase
      .from('events')
      .update({ status: 'active' })
      .eq('id', eventId);

    return NextResponse.json({ 
      success: true, 
      round: newRound,
      matchCount: matches.length,
      waitingCount: participants.length - (matches.length * 2),
      message: `Tur ${newRound}: ${matches.length} eşleştirme oluşturuldu ve başlatıldı.`
    });
  } catch (error: any) {
    console.error('Match creation error:', error);
    return NextResponse.json({ 
      error: error.message || 'Eşleştirme sırasında hata oluştu.' 
    }, { status: 500 });
  }
}
