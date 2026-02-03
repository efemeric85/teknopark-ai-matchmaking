import { createClient } from '@supabase/supabase-js';
import { NextResponse, NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

const ICEBREAKERS = [
  'Yapay zeka ile ilgili en heyecan verici proje fikriniz nedir?',
  'Şirketinizde otomasyon ile çözmeyi istediğiniz en büyük sorun ne?',
  'Bu etkinlikten en çok ne bekliyorsunuz?',
  '5 yıl sonra sektörünüzü nasıl görüyorsunuz?',
  'Son dönemde sizi en çok etkileyen teknoloji trendi ne oldu?',
  'İdeal iş ortağınızda aradığınız en önemli özellik nedir?',
  'Bugün burada tanışmak istediğiniz kişi profili nasıl biri?',
  'Şirketinizin en güçlü yanı ne?',
  'Hangi sektörlere açılmayı düşünüyorsunuz?',
  'Bir startup kurabilseydiniz hangi sorunu çözerdiniz?',
];

// Circle method: deterministic round-robin tournament
function generateCirclePairs(ids: string[], roundIndex: number): [string, string][] {
  const n = ids.length;
  if (n < 2) return [];

  const fixed = ids[0];
  const rotating = ids.slice(1);
  const m = rotating.length;

  // Rotate array by roundIndex positions
  const rotated: string[] = [];
  for (let i = 0; i < m; i++) {
    rotated.push(rotating[(i + roundIndex) % m]);
  }

  const pairs: [string, string][] = [];
  // Fixed vs first rotated
  pairs.push([fixed, rotated[0]]);
  // Remaining pairs from ends inward
  for (let i = 1; i <= Math.floor(m / 2); i++) {
    if (i < m - i + 1) {
      pairs.push([rotated[i], rotated[m - i]]);
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

    // Event bilgisi
    const { data: event } = await supabase
      .from('events').select('*').eq('id', eventId).single();

    if (!event) {
      return NextResponse.json({ error: 'Etkinlik bulunamadı.' }, { status: 404 });
    }

    // Katılımcılar
    const { data: users } = await supabase
      .from('users').select('*').eq('event_id', eventId).order('created_at', { ascending: true });

    if (!users || users.length < 2) {
      return NextResponse.json({ error: 'En az 2 katılımcı gerekli.' }, { status: 400 });
    }

    // Mevcut eşleşmeler
    const { data: allMatches } = await supabase
      .from('matches').select('*').eq('event_id', eventId)
      .order('round_number', { ascending: false });

    const existingMatches = allMatches || [];
    const maxExistingRound = existingMatches.length > 0 ? existingMatches[0].round_number : 0;

    // Mevcut turda tamamlanmamış eşleşme var mı?
    if (maxExistingRound > 0) {
      const currentRound = existingMatches.filter(m => m.round_number === maxExistingRound);
      const duration = event.round_duration_sec || event.duration || 360;

      // Süresi dolmuş active match'leri completed yap
      for (const m of currentRound) {
        if (m.status === 'active' && m.started_at) {
          const elapsed = (Date.now() - new Date(m.started_at).getTime()) / 1000;
          if (elapsed >= duration) {
            await supabase.from('matches').update({ status: 'completed' }).eq('id', m.id);
            m.status = 'completed';
          }
        }
      }

      const pending = currentRound.filter(m => m.status === 'pending');
      const active = currentRound.filter(m => m.status === 'active');
      if (pending.length > 0 || active.length > 0) {
        return NextResponse.json({
          error: `Tur ${maxExistingRound} henüz tamamlanmadı! ${pending.length} bekleyen, ${active.length} aktif eşleşme var.`
        }, { status: 400 });
      }
    }

    // Max tur hesapla
    const n = users.length;
    const maxRounds = n % 2 === 0 ? n - 1 : n;

    if (maxExistingRound >= maxRounds) {
      return NextResponse.json({
        error: `Tüm turlar tamamlandı! (${maxRounds} tur, ${n} katılımcı)`
      }, { status: 400 });
    }

    const newRound = maxExistingRound + 1;
    const roundIndex = newRound - 1; // 0-based for circle method

    // Kullanıcı ID'lerini sırala (deterministik)
    const userIds = users.map(u => u.id).sort();
    const pairs = generateCirclePairs(userIds, roundIndex);

    // Eşleşmeleri oluştur
    const matchInserts = pairs.map((pair, idx) => ({
      event_id: eventId,
      user1_id: pair[0],
      user2_id: pair[1],
      round_number: newRound,
      status: 'pending',
      table_number: idx + 1,
      icebreaker_question: ICEBREAKERS[(roundIndex * pairs.length + idx) % ICEBREAKERS.length],
    }));

    const { error: insertError } = await supabase.from('matches').insert(matchInserts);
    if (insertError) throw insertError;

    // Beklemedeki katılımcılar (tek sayıda ise 1 kişi bekler)
    const matchedIds = new Set(pairs.flat());
    const waitingParticipants = users.filter(u => !matchedIds.has(u.id));

    return NextResponse.json({
      success: true,
      round: newRound,
      maxRounds,
      matchCount: pairs.length,
      waitingCount: waitingParticipants.length,
      message: `Tur ${newRound}/${maxRounds}: ${pairs.length} eşleşme oluşturuldu.${waitingParticipants.length > 0 ? ' ' + waitingParticipants.length + ' kişi beklemede.' : ''} QR okutmayı bekliyor.`,
    });
  } catch (error: any) {
    console.error('[MATCH-ROUTE-V8] Error:', error);
    return NextResponse.json({ error: error.message || 'Eşleştirme hatası.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // SADECE match'leri sil, event status'una DOKUNMA
    await supabase.from('matches').delete().eq('event_id', params.id);
    return NextResponse.json({ success: true, message: 'Tüm eşleşmeler sıfırlandı.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
