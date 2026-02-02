import { createClient } from '@supabase/supabase-js';
import { NextResponse, NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Round bilgisi hesapla ───
async function calcRoundInfo(eventId: string) {
  const { data: users } = await supabase
    .from('users').select('id').eq('event_id', eventId);
  const n = users?.length || 0;
  const maxRounds = n <= 1 ? 0 : (n % 2 === 0 ? n - 1 : n);

  const { data: matches } = await supabase
    .from('matches').select('round_number')
    .eq('event_id', eventId)
    .order('round_number', { ascending: false }).limit(1);
  const currentRound = matches?.[0]?.round_number || 0;

  return {
    current: currentRound,
    max: maxRounds,
    participantCount: n,
    allCompleted: maxRounds > 0 && currentRound >= maxRounds
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = decodeURIComponent(params.userId);
    console.log('[MEETING-V7] Request for:', userId);

    // ─── 1. Kullanıcıyı bul (email veya id) ───
    let allUsers: any[] = [];
    if (userId.includes('@')) {
      const { data } = await supabase
        .from('users').select('*').ilike('email', userId);
      allUsers = data || [];
    } else {
      const { data } = await supabase
        .from('users').select('*').eq('id', userId);
      allUsers = data || [];
    }

    console.log('[MEETING-V7] Found', allUsers.length, 'user records');

    if (allUsers.length === 0) {
      return NextResponse.json({
        v: 'V7', error: 'Kullanıcı bulunamadı',
        user: null, match: null, partner: null, event: null, waiting: null, roundInfo: null
      }, { status: 404 });
    }

    // ─── 2. Aktif event'leri bul ───
    const eventIds = [...new Set(allUsers.map(u => u.event_id))];
    const { data: events } = await supabase
      .from('events').select('*').in('id', eventIds).eq('status', 'active');

    console.log('[MEETING-V7] Active events:', events?.length || 0);

    if (!events || events.length === 0) {
      const { data: anyEvents } = await supabase
        .from('events').select('*').in('id', eventIds)
        .order('created_at', { ascending: false }).limit(1);

      if (!anyEvents || anyEvents.length === 0) {
        return NextResponse.json({
          v: 'V7', error: 'Aktif etkinlik bulunamadı',
          user: null, match: null, partner: null, event: null, waiting: null, roundInfo: null
        });
      }

      const event = anyEvents[0];
      const user = allUsers.find(u => u.event_id === event.id) || allUsers[0];
      const roundInfo = await calcRoundInfo(event.id);

      return NextResponse.json({
        v: 'V7',
        user: { id: user.id, full_name: user.full_name, company: user.company, email: user.email },
        match: null, partner: null,
        event: { id: event.id, name: event.name, duration: event.round_duration_sec || event.duration || 360, status: event.status },
        waiting: null, roundInfo
      });
    }

    // ─── 3. Her aktif event için match'leri tara ───
    // ÖNCELİK: Kullanıcının EN SON turda eşleşmesi var mı?
    // Yoksa waiting state döndür (eski turdan completed match gösterme!)
    let bestMatch: any = null;
    let bestUser: any = null;
    let bestEvent: any = null;
    let bestScore = -1;

    for (const event of events) {
      const user = allUsers.find(u => u.event_id === event.id);
      if (!user) continue;

      // Önce event'in EN SON turunu bul (tüm match'lerden)
      const { data: allEventMatches } = await supabase
        .from('matches').select('round_number, status, started_at, user1_id, user2_id')
        .eq('event_id', event.id)
        .order('round_number', { ascending: false }).limit(1);

      if (!allEventMatches || allEventMatches.length === 0) continue;

      const eventLatestRound = allEventMatches[0].round_number;

      // Kullanıcının BU SON turda match'i var mı?
      const { data: userLatestMatches } = await supabase
        .from('matches').select('*')
        .eq('event_id', event.id)
        .eq('round_number', eventLatestRound)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (!userLatestMatches || userLatestMatches.length === 0) {
        // Kullanıcı en son turda EŞLEŞMEMİŞ → waiting state (Section 4'e bırak)
        console.log('[MEETING-V7] User', user.id, 'unmatched in round', eventLatestRound, 'of event', event.id);
        continue;
      }

      // En son turdaki match'leri puanla
      for (const match of userLatestMatches) {
        const now = Date.now();
        let score = 0;

        if (match.status === 'pending') {
          score = 1000 + eventLatestRound;
        } else if (match.status === 'active' && match.started_at) {
          const elapsed = (now - new Date(match.started_at).getTime()) / 1000;
          const duration = event.round_duration_sec || event.duration || 360;
          if (elapsed < duration) {
            score = 500 + eventLatestRound;
          } else {
            score = 100 + eventLatestRound;
          }
        } else if (match.status === 'completed') {
          score = 50 + eventLatestRound;
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = match;
          bestUser = user;
          bestEvent = event;
        }
      }
    }

    // ─── 4. Eşleşme bulunamadı veya kullanıcı son turda eşleşmemiş ───
    if (!bestMatch || !bestUser || !bestEvent) {
      const event = events[0];
      const user = allUsers.find(u => u.event_id === event.id) || allUsers[0];
      const roundInfo = await calcRoundInfo(event.id);

      const { data: allEventMatches } = await supabase
        .from('matches').select('*').eq('event_id', event.id)
        .order('round_number', { ascending: false });

      if (allEventMatches && allEventMatches.length > 0) {
        const maxRound = allEventMatches[0].round_number;
        const currentRoundMatches = allEventMatches.filter(m => m.round_number === maxRound);
        const activeMatches = currentRoundMatches.filter(m => m.status === 'active');
        const pendingMatches = currentRoundMatches.filter(m => m.status === 'pending');

        const startedMatches = currentRoundMatches.filter(m => m.started_at);
        const lastStartedAt = startedMatches.length > 0
          ? startedMatches.sort((a: any, b: any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0].started_at
          : null;

        const allStarted = pendingMatches.length === 0 && activeMatches.length > 0;

        return NextResponse.json({
          v: 'V7',
          user: { id: user.id, full_name: user.full_name, company: user.company, email: user.email },
          match: null, partner: null,
          event: { id: event.id, name: event.name, duration: event.round_duration_sec || event.duration || 360, status: event.status },
          waiting: {
            isWaiting: true, roundNumber: maxRound,
            activeCount: activeMatches.length, pendingCount: pendingMatches.length,
            totalMatches: currentRoundMatches.length, allStarted, lastStartedAt
          },
          roundInfo
        });
      }

      return NextResponse.json({
        v: 'V7',
        user: { id: user.id, full_name: user.full_name, company: user.company, email: user.email },
        match: null, partner: null,
        event: { id: event.id, name: event.name, duration: event.round_duration_sec || event.duration || 360, status: event.status },
        waiting: null, roundInfo
      });
    }

    // ─── 5. Partner bilgisi ───
    const partnerId = bestMatch.user1_id === bestUser.id ? bestMatch.user2_id : bestMatch.user1_id;
    const { data: partner } = await supabase
      .from('users').select('*').eq('id', partnerId).single();

    const roundInfo = await calcRoundInfo(bestEvent.id);

    console.log('[MEETING-V7] RESULT: Match:', bestMatch.id, 'status:', bestMatch.status,
      'round:', bestMatch.round_number, '/', roundInfo.max, 'partner:', partner?.full_name);

    return NextResponse.json({
      v: 'V7',
      user: { id: bestUser.id, full_name: bestUser.full_name, company: bestUser.company, email: bestUser.email },
      match: {
        id: bestMatch.id,
        status: bestMatch.status,
        started_at: bestMatch.started_at,
        round_number: bestMatch.round_number
      },
      partner: partner ? {
        id: partner.id, full_name: partner.full_name,
        company: partner.company, title: partner.title, goal: partner.goal
      } : null,
      event: { id: bestEvent.id, name: bestEvent.name, duration: bestEvent.round_duration_sec || bestEvent.duration || 360, status: bestEvent.status },
      waiting: null,
      roundInfo
    });

  } catch (error: any) {
    console.error('[MEETING-V7] Error:', error);
    return NextResponse.json({ v: 'V7', error: error.message || 'Hata oluştu.', roundInfo: null }, { status: 500 });
  }
}
