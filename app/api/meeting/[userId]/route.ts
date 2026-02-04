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
    console.log('[MEETING-V11] Request for:', userId, 'event_id:', filterEventId);

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
        v: 'V11', error: 'Kullanıcı bulunamadı',
        user: null, match: null, partner: null, event: null, waiting: null, roundInfo: null, allEvents: []
      }, { status: 404 });
    }

    // 2. Tüm event'leri bul (aktif + draft dahil)
    const eventIds = [...new Set(allUsers.map(u => u.event_id).filter(Boolean))];
    const { data: allEventsRaw } = await supabase.from('events').select('*').in('id', eventIds);
    const allEventsList = (allEventsRaw || []).map(e => ({
      id: e.id, name: e.name, status: e.status,
      duration: e.round_duration_sec || e.duration || DEFAULT_DURATION,
    }));

    // Filter events: specific > active > all
    let events: any[];
    if (filterEventId) {
      events = (allEventsRaw || []).filter(e => e.id === filterEventId);
    } else {
      const activeEvents = (allEventsRaw || []).filter(e => e.status === 'active');
      events = activeEvents.length > 0 ? activeEvents : (allEventsRaw || []);
    }

    if (!events || events.length === 0) {
      const user = allUsers[0];
      const { data: anyEvent } = await supabase.from('events').select('*').eq('id', user.event_id).single();
      const roundInfo = user.event_id ? await calcRoundInfo(user.event_id) : null;
      return NextResponse.json({
        v: 'V11',
        user: { id: user.id, full_name: user.full_name, company: user.company, email: user.email, position: user.position || '' },
        match: null, partner: null,
        event: anyEvent ? { id: anyEvent.id, name: anyEvent.name, duration: anyEvent.round_duration_sec || anyEvent.duration || DEFAULT_DURATION, status: anyEvent.status } : null,
        waiting: null, roundInfo, allEvents: allEventsList
      });
    }

    // 3. Tüm match'leri çek - TÜM user ID'leri kullan (aynı email farklı event'ler)
    const allUserIds = allUsers.map(u => u.id);

    const { data: allMatches } = await supabase
      .from('matches').select('*')
      .or(allUserIds.map(id => `user1_id.eq.${id},user2_id.eq.${id}`).join(','))
      .order('round_number', { ascending: false });

    // ═══ Auto-complete expired active matches ═══
    const eventDurationMap = new Map((allEventsRaw || []).map((e: any) => [e.id, e.round_duration_sec || e.duration || DEFAULT_DURATION]));
    const now = Date.now();
    const expiredIds: string[] = [];
    for (const m of (allMatches || [])) {
      if (m.status === 'active' && m.started_at) {
        const dur = eventDurationMap.get(m.event_id) || DEFAULT_DURATION;
        if ((now - new Date(m.started_at).getTime()) / 1000 >= dur) {
          expiredIds.push(m.id);
          m.status = 'completed';
        }
      }
    }
    if (expiredIds.length > 0) {
      await supabase.from('matches').update({ status: 'completed' }).in('id', expiredIds);
    }

    // Best match scoring - allEventsRaw'dan event ara (dar filtre sorunu)
    let bestMatch: any = null;
    let bestUser: any = null;
    let bestEvent: any = null;
    let bestScore = -999;

    for (const m of (allMatches || [])) {
      const matchUser = allUsers.find(u => u.id === m.user1_id || u.id === m.user2_id);
      const matchEvent = (allEventsRaw || []).find((e: any) => e.id === m.event_id);
      if (!matchUser || !matchEvent) continue;

      const duration = matchEvent.round_duration_sec || matchEvent.duration || DEFAULT_DURATION;
      let score = 0;

      if (m.status === 'pending') {
        score = 100 + m.round_number;
      } else if (m.status === 'active') {
        if (m.started_at) {
          const elapsed = (Date.now() - new Date(m.started_at).getTime()) / 1000;
          if (elapsed < duration) {
            score = 50 + m.round_number;
          } else {
            score = -10 + m.round_number;
          }
        } else {
          score = 80 + m.round_number;
        }
      } else if (m.status === 'completed') {
        score = -50 + m.round_number;
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
      // Doğru event'i bul: filterEventId > match olan event > ilk event
      let waitEvent: any = null;
      let waitUser = allUsers[0];

      if (filterEventId) {
        waitEvent = (allEventsRaw || []).find((e: any) => e.id === filterEventId);
        waitUser = allUsers.find(u => u.event_id === filterEventId) || allUsers[0];
      }

      // filterEventId yoksa veya event bulunamadıysa, match olan event'i ara
      if (!waitEvent) {
        for (const ev of (allEventsRaw || [])) {
          const usr = allUsers.find(u => u.event_id === ev.id);
          if (!usr) continue;
          const { count } = await supabase
            .from('matches').select('id', { count: 'exact', head: true }).eq('event_id', ev.id);
          if (count && count > 0) {
            waitEvent = ev;
            waitUser = usr;
            break;
          }
        }
      }

      // Hala bulunamadıysa ilk event'i kullan
      if (!waitEvent) {
        waitEvent = events[0] || (allEventsRaw || [])[0];
        waitUser = allUsers.find(u => u.event_id === waitEvent?.id) || allUsers[0];
      }

      if (!waitEvent) {
        return NextResponse.json({
          v: 'V11',
          user: { id: waitUser.id, full_name: waitUser.full_name, company: waitUser.company, email: waitUser.email, position: waitUser.position || '' },
          match: null, partner: null, event: null, waiting: null, roundInfo: null, allEvents: allEventsList
        });
      }

      const roundInfo = await calcRoundInfo(waitEvent.id);

      const { data: allEventMatches } = await supabase
        .from('matches').select('*').eq('event_id', waitEvent.id)
        .order('round_number', { ascending: false });

      if (allEventMatches && allEventMatches.length > 0) {
        const maxRound = allEventMatches[0].round_number;
        const currentRoundMatches = allEventMatches.filter(m => m.round_number === maxRound);
        const activeMatches = currentRoundMatches.filter(m => m.status === 'active');
        const pendingMatches = currentRoundMatches.filter(m => m.status === 'pending');
        const completedMatches = currentRoundMatches.filter(m => m.status === 'completed');

        const startedMatches = currentRoundMatches.filter(m => m.started_at);
        const lastStartedAt = startedMatches.length > 0
          ? startedMatches.sort((a: any, b: any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0].started_at
          : null;

        // FIX: completed match'leri de say - match'ler bittikten sonra timer kaybolmuyordu
        const allStarted = pendingMatches.length === 0 && (activeMatches.length > 0 || completedMatches.length > 0);

        return NextResponse.json({
          v: 'V11',
          user: { id: waitUser.id, full_name: waitUser.full_name, company: waitUser.company, email: waitUser.email, position: waitUser.position || '' },
          match: null, partner: null,
          event: { id: waitEvent.id, name: waitEvent.name, duration: waitEvent.round_duration_sec || waitEvent.duration || DEFAULT_DURATION, status: waitEvent.status },
          waiting: {
            isWaiting: true, roundNumber: maxRound,
            activeCount: activeMatches.length, pendingCount: pendingMatches.length,
            totalMatches: currentRoundMatches.length, allStarted, lastStartedAt
          },
          roundInfo, allEvents: allEventsList
        });
      }

      return NextResponse.json({
        v: 'V11',
        user: { id: waitUser.id, full_name: waitUser.full_name, company: waitUser.company, email: waitUser.email, position: waitUser.position || '' },
        match: null, partner: null,
        event: { id: waitEvent.id, name: waitEvent.name, duration: waitEvent.round_duration_sec || waitEvent.duration || DEFAULT_DURATION, status: waitEvent.status },
        waiting: null, roundInfo, allEvents: allEventsList
      });
    }

    // 5. Partner bilgisi
    const partnerId = bestMatch.user1_id === bestUser.id ? bestMatch.user2_id : bestMatch.user1_id;
    const { data: partner } = await supabase.from('users').select('*').eq('id', partnerId).single();

    const roundInfo = await calcRoundInfo(bestEvent.id);
    const duration = bestEvent.round_duration_sec || bestEvent.duration || DEFAULT_DURATION;

    console.log('[MEETING-V11] RESULT: Match:', bestMatch.id, 'status:', bestMatch.status,
      'round:', bestMatch.round_number, '/', roundInfo.max, 'partner:', partner?.full_name);

    return NextResponse.json({
      v: 'V11',
      user: { id: bestUser.id, full_name: bestUser.full_name, company: bestUser.company, email: bestUser.email, position: bestUser.position || '' },
      match: {
        id: bestMatch.id,
        status: bestMatch.status,
        started_at: bestMatch.started_at,
        round_number: bestMatch.round_number,
        table_number: bestMatch.table_number || null,
        icebreaker_question: bestMatch.icebreaker_question || null,
      },
      partner: partner ? { id: partner.id, full_name: partner.full_name, company: partner.company, email: partner.email } : null,
      event: { id: bestEvent.id, name: bestEvent.name, duration, status: bestEvent.status },
      waiting: null,
      roundInfo, allEvents: allEventsList
    });
  } catch (error: any) {
    console.error('[MEETING-V11] Error:', error);
    return NextResponse.json({ v: 'V11', error: error.message || 'Hata oluştu.' }, { status: 500 });
  }
}
