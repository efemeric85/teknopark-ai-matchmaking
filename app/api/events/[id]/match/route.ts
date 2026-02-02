import { createClient } from '@supabase/supabase-js';
import { NextResponse, NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ═══════════════════════════════════════════════════
// Deterministic Round-Robin (Circle Method)
// N kişi → N-1 tur, her turda N/2 eşleşme garanti
// Tek sayı → BYE eklenir, her turda 1 kişi bekler
// ═══════════════════════════════════════════════════
function getRoundRobinPairings(ids: string[], round: number): [string, string][] {
  const players = [...ids].sort(); // Deterministik sıralama
  const hasBye = players.length % 2 !== 0;
  if (hasBye) players.push('__BYE__');

  const n = players.length;
  const fixed = players[0];
  const rotating = players.slice(1);

  // Round kadar döndür
  for (let r = 0; r < round - 1; r++) {
    rotating.unshift(rotating.pop()!);
  }

  const pairs: [string, string][] = [];

  // Sabit kişi vs son eleman
  if (rotating[rotating.length - 1] !== '__BYE__') {
    pairs.push([fixed, rotating[rotating.length - 1]]);
  }

  // Dıştan içe eşleştir
  const half = Math.floor((n - 2) / 2);
  for (let i = 0; i < half; i++) {
    const a = rotating[i];
    const b = rotating[rotating.length - 2 - i];
    if (a !== '__BYE__' && b !== '__BYE__') {
      pairs.push([a, b]);
    }
  }

  return pairs;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;
    console.log('[MATCH-ROUTE-V5] Creating matches for event:', eventId);

    // ─── 1. Event ve katılımcıları al ───
    const { data: event } = await supabase
      .from('events').select('*').eq('id', eventId).single();

    const { data: participants, error: pError } = await supabase
      .from('users').select('*').eq('event_id', eventId);

    if (pError || !participants || participants.length < 2) {
      return NextResponse.json({ error: 'En az 2 katılımcı gerekli.' }, { status: 400 });
    }

    const n = participants.length;
    const maxRounds = n % 2 === 0 ? n - 1 : n;
    const duration = event?.round_duration_sec || event?.duration || 360;

    // ─── 2. Mevcut eşleşmeleri al ───
    const { data: existingMatches } = await supabase
      .from('matches').select('*').eq('event_id', eventId)
      .order('round_number', { ascending: false });

    const lastRound = existingMatches?.[0]?.round_number || 0;

    // ─── 3. MEVCUT TUR BİTTİ Mİ KONTROLÜ ───
    if (lastRound > 0 && existingMatches) {
      const currentRoundMatches = existingMatches.filter(m => m.round_number === lastRound);
      const now = Date.now();

      // Süresi dolmuş active match'leri otomatik complete yap
      const expiredActive = currentRoundMatches.filter(m => {
        if (m.status !== 'active' || !m.started_at) return false;
        const elapsed = (now - new Date(m.started_at).getTime()) / 1000;
        return elapsed >= duration;
      });

      if (expiredActive.length > 0) {
        for (const m of expiredActive) {
          await supabase.from('matches').update({ status: 'completed' }).eq('id', m.id);
        }
        console.log('[MATCH-ROUTE-V5] Auto-completed', expiredActive.length, 'expired matches');
      }

      // Hala devam eden eşleşme var mı?
      const stillRunning = currentRoundMatches.filter(m => {
        if (m.status === 'pending') return true;
        if (m.status === 'active' && m.started_at) {
          const elapsed = (now - new Date(m.started_at).getTime()) / 1000;
          return elapsed < duration;
        }
        return false;
      });

      if (stillRunning.length > 0) {
        const pendingCount = stillRunning.filter(m => m.status === 'pending').length;
        const activeCount = stillRunning.filter(m => m.status === 'active').length;
        return NextResponse.json({
          error: `Tur ${lastRound} henüz tamamlanmadı! ${pendingCount > 0 ? pendingCount + ' çift QR bekliyor. ' : ''}${activeCount > 0 ? activeCount + ' görüşme devam ediyor.' : ''}`.trim(),
          roundInProgress: true,
          currentRound: lastRound,
          pendingCount,
          activeCount
        }, { status: 400 });
      }
    }

    // ─── 4. MAX TUR KONTROLÜ ───
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

    // ─── 5. Deterministic Round-Robin eşleştirme ───
    const sortedIds = participants.map(p => p.id).sort();
    const pairings = getRoundRobinPairings(sortedIds, newRound);

    const newMatches = pairings.map(([id1, id2]) => ({
      event_id: eventId,
      user1_id: id1,
      user2_id: id2,
      round_number: newRound,
      status: 'pending',
      started_at: null
    }));

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

    // Bekleyen kişileri bul
    const matchedIds = new Set(pairings.flat());
    const waitingParticipants = participants.filter(p => !matchedIds.has(p.id));

    console.log('[MATCH-ROUTE-V5] Round', newRound, '/', maxRounds, ':', newMatches.length, 'matches,', waitingParticipants.length, 'waiting');

    return NextResponse.json({
      success: true,
      round: newRound,
      matchCount: newMatches.length,
      waitingCount: waitingParticipants.length,
      maxRounds,
      participantCount: n,
      version: 'V5-ROUNDROBIN',
      message: `Tur ${newRound}/${maxRounds}: ${newMatches.length} eşleştirme oluşturuldu.${waitingParticipants.length > 0 ? ' ' + waitingParticipants.length + ' kişi beklemede.' : ''} QR okutmayı bekliyor.`,
    });
  } catch (error: any) {
    console.error('[MATCH-ROUTE-V5] Error:', error);
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
