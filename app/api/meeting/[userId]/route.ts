import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SAFE_FIELDS = 'id, email, full_name, company, position, current_intent, event_id, checked_in, created_at';
const DEFAULT_DURATION = 360;

// Helper: find matches for a user in an event
async function findMatchesForUser(userId: string, eventId: string) {
  const { data: mA } = await supabase
    .from('matches').select('*')
    .eq('user1_id', userId).eq('event_id', eventId);
  const { data: mB } = await supabase
    .from('matches').select('*')
    .eq('user2_id', userId).eq('event_id', eventId);
  const combined = [...(mA || []), ...(mB || [])];
  return combined.filter((m, i, s) => i === s.findIndex(x => x.id === m.id));
}

function respond(data: any) {
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
    }
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const identifier = decodeURIComponent(params.userId || '');
    if (!identifier) {
      return respond({ error: 'Kullanıcı kimliği gerekli' });
    }

    const { searchParams } = new URL(request.url);
    const filterEventId = searchParams.get('event_id');
    const isEmail = identifier.includes('@');

    // ═══ 1. TÜM KULLANICI KAYITLARINI BUL ═══
    let allUsers: any[] = [];
    if (isEmail) {
      const { data } = await supabase
        .from('users')
        .select(SAFE_FIELDS)
        .ilike('email', identifier)
        .order('created_at', { ascending: false });
      allUsers = data || [];
    } else {
      const { data } = await supabase
        .from('users')
        .select(SAFE_FIELDS)
        .eq('id', identifier);
      allUsers = data || [];
    }

    if (allUsers.length === 0) {
      return respond({
        v: 'V16', error: 'Kullanıcı bulunamadı',
        user: null, match: null, partner: null, event: null,
        waiting: null, roundInfo: null, allEvents: []
      });
    }

    // ═══ 2. TÜM ETKİNLİKLERİ AL ═══
    const { data: allEventsData } = await supabase
      .from('events')
      .select('id, name, status, duration, round_duration_sec')
      .order('created_at', { ascending: false });
    const allEventsList = allEventsData || [];

    // ═══ 3. DOĞRU KULLANICI VE ETKİNLİĞİ BUL ═══
    let user: any = null;
    let eventId: string | null = null;
    let userMatches: any[] = [];

    if (filterEventId) {
      // Belirli bir etkinlik isteniyor - o etkinliğe kayıtlı kullanıcıyı bul
      user = allUsers.find(u => u.event_id === filterEventId) || allUsers[0];
      eventId = filterEventId;
      userMatches = await findMatchesForUser(user.id, eventId);
    } else {
      // Strateji: her kullanıcı kaydını dene, pending/active match olanı bul
      for (const u of allUsers) {
        if (!u.event_id) continue;
        const matches = await findMatchesForUser(u.id, u.event_id);
        const hasCurrent = matches.some(m => m.status === 'pending' || m.status === 'active');
        if (hasCurrent) {
          user = u;
          eventId = u.event_id;
          userMatches = matches;
          break;
        }
      }

      // Bulunamadı - son çare: TÜM etkinliklerde pending/active match ara
      if (!user) {
        const allIds = allUsers.map(u => u.id);
        for (const uid of allIds) {
          const { data: mA } = await supabase
            .from('matches').select('*')
            .eq('user1_id', uid)
            .in('status', ['pending', 'active'])
            .limit(1);
          const { data: mB } = await supabase
            .from('matches').select('*')
            .eq('user2_id', uid)
            .in('status', ['pending', 'active'])
            .limit(1);
          const found = [...(mA || []), ...(mB || [])];
          if (found.length > 0) {
            user = allUsers.find(u => u.id === uid) || allUsers[0];
            eventId = found[0].event_id;
            userMatches = await findMatchesForUser(uid, eventId);
            break;
          }
        }
      }

      // Hala bulunamadı - en güncel kullanıcıyı kullan
      if (!user) {
        user = allUsers[0];
        eventId = user.event_id;
        if (eventId) {
          userMatches = await findMatchesForUser(user.id, eventId);
        }
      }
    }

    const userInfo = {
      id: user.id, full_name: user.full_name, email: user.email,
      company: user.company, position: user.position || ''
    };

    if (!eventId) {
      return respond({
        v: 'V16', user: userInfo,
        match: null, partner: null, event: null,
        waiting: null, roundInfo: null,
        allEvents: allEventsList,
        message: 'Aktif etkinlik bulunamadı.'
      });
    }

    // ═══ 4. ETKİNLİK DETAYLARI ═══
    const event = allEventsList.find(e => e.id === eventId);
    if (!event) {
      return respond({
        v: 'V16', user: userInfo,
        match: null, partner: null, event: null,
        waiting: null, roundInfo: null,
        allEvents: allEventsList,
        error: 'Etkinlik bulunamadı'
      });
    }

    const duration = event.round_duration_sec || event.duration || DEFAULT_DURATION;

    // ═══ 5. AKTİF VEYA PENDING MATCH ═══
    const currentMatch = userMatches
      .filter(m => m.status === 'active' || m.status === 'pending')
      .sort((a: any, b: any) => b.round_number - a.round_number)[0] || null;

    // ═══ 6. PARTNER BİLGİSİ ═══
    let partner = null;
    if (currentMatch) {
      const partnerId = currentMatch.user1_id === user.id
        ? currentMatch.user2_id
        : currentMatch.user1_id;
      const { data: pd } = await supabase
        .from('users')
        .select('id, full_name, company, email, position')
        .eq('id', partnerId)
        .single();
      partner = pd || null;
    }

    // ═══ 7. ROUND BİLGİSİ ═══
    const { data: allEventMatches } = await supabase
      .from('matches')
      .select('round_number, status')
      .eq('event_id', eventId);

    const maxRound = allEventMatches?.length
      ? Math.max(...allEventMatches.map((m: any) => m.round_number))
      : 0;

    const { data: participants } = await supabase
      .from('users').select('id')
      .eq('event_id', eventId)
      .eq('checked_in', true);

    const allCompleted = userMatches.length > 0 &&
      userMatches.every(m => m.status === 'completed');

    const roundInfo = {
      current: currentMatch?.round_number || maxRound || 0,
      max: maxRound,
      participantCount: participants?.length || 0,
      allCompleted: allCompleted && !currentMatch
    };

    // ═══ 8. BEKLEME DURUMU ═══
    let waiting = null;
    if (!currentMatch && maxRound > 0 && !allCompleted) {
      const currentRoundMatches = allEventMatches?.filter((m: any) => m.round_number === maxRound) || [];
      const activeCount = currentRoundMatches.filter((m: any) => m.status === 'active').length;
      const pendingCount = currentRoundMatches.filter((m: any) => m.status === 'pending').length;

      if (activeCount > 0 || pendingCount > 0) {
        const { data: activeInRound } = await supabase
          .from('matches').select('started_at')
          .eq('event_id', eventId)
          .eq('round_number', maxRound)
          .eq('status', 'active')
          .not('started_at', 'is', null)
          .order('started_at', { ascending: false })
          .limit(1);

        waiting = {
          isWaiting: true,
          roundNumber: maxRound,
          activeCount, pendingCount,
          totalMatches: currentRoundMatches.length,
          allStarted: pendingCount === 0 && activeCount > 0,
          lastStartedAt: activeInRound?.[0]?.started_at || null
        };
      }
    }

    // ═══ 9. RESPONSE ═══
    const formattedMatch = currentMatch ? {
      id: currentMatch.id,
      status: currentMatch.status,
      started_at: currentMatch.started_at,
      round_number: currentMatch.round_number,
      table_number: currentMatch.table_number || null,
      icebreaker_question: currentMatch.icebreaker_question || null
    } : null;

    return respond({
      v: 'V16',
      user: userInfo,
      match: formattedMatch,
      partner,
      event: { id: event.id, name: event.name, duration, status: event.status },
      waiting,
      roundInfo,
      allEvents: allEventsList
    });

  } catch (error: any) {
    console.error('[V16] Error:', error);
    return respond({ v: 'V16', error: 'Sunucu hatasi.' });
  }
}
