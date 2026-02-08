import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Tur durumunu getir
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;

    const { data: matches } = await supabase
      .from('matches').select('*, user1:user1_id(id, full_name, company), user2:user2_id(id, full_name, company)')
      .eq('event_id', eventId)
      .order('round_number', { ascending: true });

    if (!matches || matches.length === 0) {
      return NextResponse.json({ currentRound: 0, matches: [], totalMatches: 0, completedMatches: 0, allCompleted: false });
    }

    const currentRound = Math.max(...matches.map(m => m.round_number || 1));
    const currentRoundMatches = matches.filter(m => (m.round_number || 1) === currentRound);
    const completedMatches = currentRoundMatches.filter(m => m.status === 'completed').length;
    const activeMatches = currentRoundMatches.filter(m => m.status === 'active').length;
    const allCompleted = currentRoundMatches.length > 0 && completedMatches === currentRoundMatches.length;

    return NextResponse.json({
      currentRound,
      matches: currentRoundMatches,
      totalMatches: currentRoundMatches.length,
      completedMatches,
      activeMatches,
      pendingMatches: currentRoundMatches.length - completedMatches - activeMatches,
      allCompleted
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Sunucu hatasi.' }, { status: 500 });
  }
}

// POST: Sıradaki turu oluştur
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;

    // Tüm kullanıcıları al
    const { data: users } = await supabase
      .from('users').select('id')
      .eq('event_id', eventId);

    if (!users || users.length < 2) {
      return NextResponse.json({ error: 'Yeterli katılımcı yok' }, { status: 400 });
    }

    // Tüm mevcut eşleşmeleri al
    const { data: existingMatches } = await supabase
      .from('matches').select('user1_id, user2_id, round_number')
      .eq('event_id', eventId);

    const currentRound = existingMatches && existingMatches.length > 0
      ? Math.max(...existingMatches.map(m => m.round_number || 1))
      : 0;

    // Mevcut turdaki eşleşmeler tamamlanmış mı?
    if (currentRound > 0) {
      const currentRoundMatches = existingMatches!.filter(m => (m.round_number || 1) === currentRound);
      const { data: currentMatches } = await supabase
        .from('matches').select('status')
        .eq('event_id', eventId)
        .eq('round_number', currentRound);
      
      const allDone = currentMatches?.every(m => m.status === 'completed');
      if (!allDone) {
        return NextResponse.json({ error: 'Mevcut tur henüz tamamlanmadı' }, { status: 400 });
      }
    }

    // Daha önce eşleşen çiftleri bul
    const paired = new Set<string>();
    (existingMatches || []).forEach(m => {
      paired.add(`${m.user1_id}|${m.user2_id}`);
      paired.add(`${m.user2_id}|${m.user1_id}`);
    });

    const hasPaired = (a: string, b: string) => paired.has(`${a}|${b}`);

    // Kullanıcıları karıştır
    const shuffled = [...users].sort(() => Math.random() - 0.5);
    const newMatches: { event_id: string; user1_id: string; user2_id: string; round_number: number; status: string }[] = [];
    const used = new Set<string>();

    // Greedy eşleştirme (daha önce eşleşmeyenler)
    for (let i = 0; i < shuffled.length; i++) {
      if (used.has(shuffled[i].id)) continue;
      for (let j = i + 1; j < shuffled.length; j++) {
        if (used.has(shuffled[j].id)) continue;
        if (!hasPaired(shuffled[i].id, shuffled[j].id)) {
          newMatches.push({
            event_id: eventId,
            user1_id: shuffled[i].id,
            user2_id: shuffled[j].id,
            round_number: currentRound + 1,
            status: 'pending'
          });
          used.add(shuffled[i].id);
          used.add(shuffled[j].id);
          break;
        }
      }
    }

    if (newMatches.length === 0) {
      return NextResponse.json({ error: 'Yeni eşleşme oluşturulamadı. Tüm olası eşleşmeler tükenmiş olabilir.' }, { status: 400 });
    }

    // Yeni eşleşmeleri kaydet
    const { error } = await supabase.from('matches').insert(newMatches);
    if (error) throw error;

    const newRound = currentRound + 1;
    const unmatched = shuffled.filter(u => !used.has(u.id)).length;

    return NextResponse.json({
      success: true,
      round: newRound,
      matchCount: newMatches.length,
      unmatchedCount: unmatched
    });
  } catch (error: any) {
    console.error('Next round error:', error);
    return NextResponse.json({ error: 'Sunucu hatasi.' }, { status: 500 });
  }
}
