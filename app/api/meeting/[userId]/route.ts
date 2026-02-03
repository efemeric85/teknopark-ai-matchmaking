import { createClient } from '@supabase/supabase-js';
import { NextResponse, NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_DURATION = 360;

async function calcRoundInfo(eventId: string) {
  const { data: users } = await supabase.from('users').select('id').eq('event_id', eventId);
  const n = users?.length || 0;
  const maxRounds = n < 2 ? 0 : (n % 2 === 0 ? n - 1 : n);

  const { data: matches } = await supabase
    .from('matches').select('round_number').eq('event_id', eventId)
    .order('round_number', { ascending: false }).limit(1);

  const current = matches && matches.length > 0 ? matches[0].round_number : 0;

  return { current, max: maxRounds, participantCount: n, allCompleted: current >= maxRounds && maxRounds > 0 };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = decodeURIComponent(params.userId);
    const { searchParams } = new URL(request.url);
    const filterEventId = searchParams.get('event_id');
    console.log('[MEETING-V10] Request for:', userId, 'event_id:', filterEventId);

    // 1. Kullanıcıyı bul (email veya id)
    let allUsers: any[] = [];
    if (userId.includes('@')) {
      const { data } = await supabase.from('users').select('*').ilike('email', userId);
      allUsers = data || [];
    } else {
      const { data } = await supabase.from('users').select('*').eq('id', userId);
      allUsers = data || [];
    }

    if (allUsers.length === 0) {
      return NextResponse.json({
        v: 'V10', error: 'Kullanıcı bulunamadı',
        user: null, match: null, partner: null, event: null, waiting: null, roundInfo: null, allEvents: []
      }, { status: 404 });
    }

    // 2. Tüm event'leri bul (aktif + draft dahil, kullanıcının seçim yapabilmesi için)
    const eventIds = [...new Set(allUsers.map(u => u.event_id))];
    const { data: allEventsRaw } = await supabase.from('events').select('*').in('id', eventIds);
    const allEventsList = (allEventsRaw || []).map(e => ({
      id: e.id, name: e.name, status: e.status,
      duration: e.round_duration_sec || e.duration || DEFAULT_DURATION,
    }));

    // Filter to active events (or specific event if requested)
    let events: any[];
    if (filterEventId) {
      events = (allEventsRaw || []).filter(e => e.id === filterEventId);
    } else {
      events = (allEventsRaw || []).filter(e => e.status === 'active');
    }

    if (!events || events.length === 0) {
      const user = allUsers[0];
      const { data: anyEvent } = await supabase.from('events').select('*').eq('id', user.event_id).single();
      const roundInfo = await calcRoundInfo(user.event_id);
      return NextResponse.json({
        v: 'V10',
        user: { id: user.id, full_name: user.full_name, company: user.company, email: user.email, position: user.position || '' },
        match: null, partner: null,
        event: anyEvent ? { id: anyEvent.id, name: anyEvent.name, duration: anyEvent.round_duration_sec || anyEvent.duration || DEFAULT_DURATION, status: anyEvent.status } : null,
        waiting: null, roundInfo, allEvents: allEventsList
      });
    }

    // 3. Tüm match'leri çek ve skor ile en iyi match'i seç
    const activeEventIds = events.map(e => e.id);
    const activeUserIds = allUsers.filter(u => activeEventIds.includes(u.event_id)).map(u => u.id);

    const { data: allMatches } = await supabase
      .from('matches').select('*')
      .or(activeUserIds.map(id => `user1_id.eq.${id},user2_id.eq.${id}`).join(','))
      .in('event_id', activeEventIds)
      .order('round_number', { ascending: false });

    // ═══ BUG 14 FIX: Auto-complete expired active matches ═══
    const eventDurationMap = new Map(events.map(e => [e.id, e.round_duration_sec || e.duration || DEFAULT_DURATION]));
    const now = Date.now();
    const expiredIds: string[] = [];
    for (const m of (allMatches || [])) {
      if (m.status === 'active' && m.started_at) {
        const dur = eventDurationMap.get(m.event_id) || DEFAULT_DURATION;
        if ((now - new Date(m.started_at).getTime()) / 1000 >= dur) {
          expiredIds.push(m.id);
          m.status = 'completed'; // Update local copy for correct scoring below
        }
      }
    }
    if (expiredIds.length > 0) {
      await supabase.from('matches').update({ status: 'completed' }).in('id', expiredIds);
    }
    // ═══ END BUG 14 FIX ═══

    let bestMatch: any = null;
    let bestUser: any = null;
    let bestEvent: any = null;
    let bestScore = -999;

    for (const m of (allMatches || [])) {
      const matchUser = allUsers.find(u => u.id === m.user1_id || u.id === m.user2_id);
      const matchEvent = events.find(e => e.id === m.event_id);
      if (!matchUser || !matchEvent) continue;

      const duration = matchEvent.round_duration_sec || matchEvent.duration || DEFAULT_DURATION;
      let score = 0;

      if (m.status === 'pending') {
        score = 100 + m.round_number; // Pending = en yüksek öncelik
      } else if (m.status === 'active') {
        if (m.started_at) {
          const elapsed = (Date.now() - new Date(m.started_at).getTime()) / 1000;
          if (elapsed < duration) {
            score = 50 + m.round_number; // Aktif ve süresi devam ediyor
          } else {
            score = -10 + m.round_number; // Süresi dolmuş
          }
        } else {
          score = 80 + m.round_number; // Aktif ama started_at yok (garip durum)
        }
      } else if (m.status === 'completed') {
        score = -50 + m.round_number; // Tamamlanmış
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = m;
        bestUser = matchUser;
        bestEvent = matchEvent;
      }
    }

    // 4. Eşleşme bulunamadı - waiting state kontrolü
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
          v: 'V10',
          user: { id: user.id, full_name: user.full_name, company: user.company, email: user.email, position: user.position || '' },
          match: null, partner: null,
          event: { id: event.id, name: event.name, duration: event.round_duration_sec || event.duration || DEFAULT_DURATION, status: event.status },
          waiting: {
            isWaiting: true, roundNumber: maxRound,
            activeCount: activeMatches.length, pendingCount: pendingMatches.length,
            totalMatches: currentRoundMatches.length, allStarted, lastStartedAt
          },
          roundInfo, allEvents: allEventsList
        });
      }

      return NextResponse.json({
        v: 'V10',
        user: { id: user.id, full_name: user.full_name, company: user.company, email: user.email, position: user.position || '' },
        match: null, partner: null,
        event: { id: event.id, name: event.name, duration: event.round_duration_sec || event.duration || DEFAULT_DURATION, status: event.status },
        waiting: null, roundInfo, allEvents: allEventsList
      });
    }

    // 5. Partner bilgisi
    const partnerId = bestMatch.user1_id === bestUser.id ? bestMatch.user2_id : bestMatch.user1_id;
    const { data: partner } = await supabase.from('users').select('*').eq('id', partnerId).single();

    const roundInfo = await calcRoundInfo(bestEvent.id);
    const duration = bestEvent.round_duration_sec || bestEvent.duration || DEFAULT_DURATION;

    console.log('[MEETING-V10] RESULT: Match:', bestMatch.id, 'status:', bestMatch.status,
      'round:', bestMatch.round_number, '/', roundInfo.max, 'partner:', partner?.full_name);

    return NextResponse.json({
      v: 'V10',
      user: { id: bestUser.id, full_name: bestUser.full_name, company: bestUser.company, email: bestUser.email, position: bestUser.position || '' },
      match: {
        id: bestMatch.id,
        status: bestMatch.status,
        started_at: bestMatch.started_at,
        round_number: bestMatch.round_number,
        icebreaker_question: bestMatch.icebreaker_question || null,
      },
      partner: partner ? { id: partner.id, full_name: partner.full_name, company: partner.company, email: partner.email } : null,
      event: { id: bestEvent.id, name: bestEvent.name, duration, status: bestEvent.status },
      waiting: null,
      roundInfo, allEvents: allEventsList
    });
  } catch (error: any) {
    console.error('[MEETING-V8] Error:', error);
    return NextResponse.json({ v: 'V10', error: error.message || 'Hata oluştu.' }, { status: 500 });
  }
}
