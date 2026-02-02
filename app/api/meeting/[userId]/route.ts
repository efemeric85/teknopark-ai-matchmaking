import { createClient } from '@supabase/supabase-js';
import { NextResponse, NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_DURATION = 360; // 6 dakika (admin ile aynı)

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = decodeURIComponent(params.userId);
    console.log('[MEETING-V6.1] Request for:', userId);

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

    console.log('[MEETING-V6.1] Found', allUsers.length, 'user records');

    if (allUsers.length === 0) {
      return NextResponse.json({
        v: 'V6.1', error: 'Kullanıcı bulunamadı',
        user: null, match: null, partner: null, event: null, waiting: null
      }, { status: 404 });
    }

    // ─── 2. Aktif event'leri bul ───
    const eventIds = [...new Set(allUsers.map(u => u.event_id))];
    const { data: events } = await supabase
      .from('events').select('*').in('id', eventIds).eq('status', 'active');

    console.log('[MEETING-V6.1] Active events:', events?.length || 0);

    if (!events || events.length === 0) {
      const { data: anyEvents } = await supabase
        .from('events').select('*').in('id', eventIds)
        .order('created_at', { ascending: false }).limit(1);
      
      if (!anyEvents || anyEvents.length === 0) {
        return NextResponse.json({
          v: 'V6.1', error: 'Aktif etkinlik bulunamadı',
          user: null, match: null, partner: null, event: null, waiting: null
        });
      }

      const event = anyEvents[0];
      const user = allUsers.find(u => u.event_id === event.id) || allUsers[0];
      const dur = event.duration && event.duration > 0 ? event.duration : DEFAULT_DURATION;
      return NextResponse.json({
        v: 'V6.1',
        user: { id: user.id, full_name: user.full_name, company: user.company, email: user.email },
        match: null, partner: null,
        event: { id: event.id, name: event.name, duration: dur, status: event.status },
        waiting: null
      });
    }

    // ─── 3. Her aktif event için kullanıcının match'lerini tara ───
    let bestMatch: any = null;
    let bestUser: any = null;
    let bestEvent: any = null;
    let bestScore = -1;

    for (const event of events) {
      const user = allUsers.find(u => u.event_id === event.id);
      if (!user) continue;

      const dur = event.duration && event.duration > 0 ? event.duration : DEFAULT_DURATION;

      const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .eq('event_id', event.id)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('round_number', { ascending: false })
        .order('created_at', { ascending: false });

      console.log('[MEETING-V6.1] Event:', event.name, 'User:', user.full_name, 'Matches:', matches?.length || 0);

      if (!matches || matches.length === 0) continue;

      const maxRound = matches[0].round_number;
      const latestRoundMatches = matches.filter(m => m.round_number === maxRound);

      for (const match of latestRoundMatches) {
        const now = Date.now();
        let score = 0;

        if (match.status === 'pending') {
          score = 1000 + maxRound;
        } else if (match.status === 'active' && match.started_at) {
          const elapsed = (now - new Date(match.started_at).getTime()) / 1000;
          if (elapsed < dur) {
            score = 500 + maxRound;
          } else {
            score = 100 + maxRound;
          }
        } else if (match.status === 'completed') {
          score = 50 + maxRound;
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = match;
          bestUser = user;
          bestEvent = event;
        }
      }
    }

    // ─── 4. Eşleşme bulunamadı ───
    if (!bestMatch || !bestUser || !bestEvent) {
      const event = events[0];
      const user = allUsers.find(u => u.event_id === event.id) || allUsers[0];
      const dur = event.duration && event.duration > 0 ? event.duration : DEFAULT_DURATION;

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
          v: 'V6.1',
          user: { id: user.id, full_name: user.full_name, company: user.company, email: user.email },
          match: null, partner: null,
          event: { id: event.id, name: event.name, duration: dur, status: event.status },
          waiting: {
            isWaiting: true, roundNumber: maxRound,
            activeCount: activeMatches.length, pendingCount: pendingMatches.length,
            totalMatches: currentRoundMatches.length, allStarted, lastStartedAt
          }
        });
      }

      return NextResponse.json({
        v: 'V6.1',
        user: { id: user.id, full_name: user.full_name, company: user.company, email: user.email },
        match: null, partner: null,
        event: { id: event.id, name: event.name, duration: dur, status: event.status },
        waiting: null
      });
    }

    // ─── 5. Partner bilgisi ───
    const partnerId = bestMatch.user1_id === bestUser.id ? bestMatch.user2_id : bestMatch.user1_id;
    const { data: partner } = await supabase
      .from('users').select('*').eq('id', partnerId).single();

    const dur = bestEvent.duration && bestEvent.duration > 0 ? bestEvent.duration : DEFAULT_DURATION;

    console.log('[MEETING-V6.1] RESULT: Match:', bestMatch.id, 'status:', bestMatch.status,
      'duration:', dur, 'partner:', partner?.full_name, 'score:', bestScore);

    return NextResponse.json({
      v: 'V6.1',
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
      event: { id: bestEvent.id, name: bestEvent.name, duration: dur, status: bestEvent.status },
      waiting: null
    });

  } catch (error: any) {
    console.error('[MEETING-V6.1] Error:', error);
    return NextResponse.json({ v: 'V6.1', error: error.message || 'Hata oluştu.' }, { status: 500 });
  }
}
