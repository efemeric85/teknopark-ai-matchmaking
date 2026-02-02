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
    console.log('[MATCH-ROUTE-V4] Creating matches for event:', eventId);

    // ─── 1. Katılımcıları al ───
    const { data: participants, error: pError } = await supabase
      .from('users').select('*').eq('event_id', eventId);

    if (pError || !participants || participants.length < 2) {
      return NextResponse.json({ error: 'En az 2 katılımcı gerekli.' }, { status: 400 });
    }

    const n = participants.length;
    // N çift → N-1 tur, N tek → N tur (round-robin)
    const maxRounds = n % 2 === 0 ? n - 1 : n;

    // ─── 2. Mevcut eşleşmeleri al ───
    const { data: existingMatches } = await supabase
      .from('matches').select('*').eq('event_id', eventId)
      .order('round_number', { ascending: false });

    const lastRound = existingMatches?.[0]?.round_number || 0;

    // ─── 3. MAX TUR KONTROLÜ ───
    if (lastRound >= maxRounds) {
      return NextResponse.json({
        error: `Tüm turlar tamamlandı! ${n} katılımcı için maksimum ${maxRounds} tur yapılabilir.`,
        allRoundsCompleted: true,
        maxRounds,
        currentRound: lastRound,
        participantCount: n
      }, { status: 400 });
    }

    const newRound = lastRound + 1;

    // ─── 4. Geçmiş eşleşmeleri set'e al ───
    const pastPairings = new Set<string>();
    if (existingMatches) {
      for (const m of existingMatches) {
        const key = [m.user1_id, m.user2_id].sort().join('_');
        pastPairings.add(key);
      }
    }

    // ─── 5. Round-robin eşleştirme ───
    const available = [...participants];
    const newMatches: any[] = [];

    // Shuffle
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }

    const matched = new Set<string>();

    for (let i = 0; i < available.length; i++) {
      if (matched.has(available[i].id)) continue;
      for (let j = i + 1; j < available.length; j++) {
        if (matched.has(available[j].id)) continue;
        const key = [available[i].id, available[j].id].sort().join('_');
        if (!pastPairings.has(key)) {
          newMatches.push({
            event_id: eventId,
            user1_id: available[i].id,
            user2_id: available[j].id,
            round_number: newRound,
            status: 'pending',
            started_at: null
          });
          matched.add(available[i].id);
          matched.add(available[j].id);
          break;
        }
      }
    }

    if (newMatches.length === 0) {
      return NextResponse.json({
        error: 'Yeni eşleşme yapılamadı. Tüm kombinasyonlar tükenmiş olabilir.',
        allRoundsCompleted: true,
        maxRounds,
        currentRound: lastRound
      }, { status: 400 });
    }

    // ─── 6. Insert ───
    const { error: insertError } = await supabase
      .from('matches').insert(newMatches);

    if (insertError) throw insertError;

    await supabase.from('events').update({ status: 'active' }).eq('id', eventId);

    console.log('[MATCH-ROUTE-V4] Created', newMatches.length, 'PENDING matches for round', newRound, '/', maxRounds);

    return NextResponse.json({
      success: true,
      round: newRound,
      matchCount: newMatches.length,
      waitingCount: participants.length - newMatches.length * 2,
      maxRounds,
      participantCount: n,
      version: 'V4-MAXROUND',
      message: `Tur ${newRound}/${maxRounds}: ${newMatches.length} eşleştirme oluşturuldu. QR okutmayı bekliyor.`,
    });
  } catch (error: any) {
    console.error('[MATCH-ROUTE-V4] Error:', error);
    return NextResponse.json({ error: error.message || 'Eşleştirme hatası.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await supabase.from('matches').delete().eq('event_id', params.id);
    return NextResponse.json({ success: true, message: 'Tüm eşleşmeler sıfırlandı.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
