import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SAFE_USER_FIELDS = 'id, email, full_name, company, position, current_intent, event_id, checked_in, created_at';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const identifier = decodeURIComponent(params.userId || '');
    if (!identifier) {
      return NextResponse.json({ error: 'Kullanıcı kimliği gerekli' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const eventIdParam = searchParams.get('event_id');
    const isEmail = identifier.includes('@');

    // ═══ 1. KULLANICIYI BUL ═══
    let user;
    if (isEmail) {
      const { data, error } = await supabase
        .from('users')
        .select(SAFE_USER_FIELDS)
        .eq('email', identifier)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error || !data) {
        return NextResponse.json({
          v: 'V14', error: 'Kullanıcı bulunamadı',
          user: null, match: null, partner: null, event: null,
          waiting: null, roundInfo: null
        });
      }
      user = data;
    } else {
      const { data, error } = await supabase
        .from('users')
        .select(SAFE_USER_FIELDS)
        .eq('id', identifier)
        .single();
      if (error || !data) {
        return NextResponse.json({
          v: 'V14', error: 'Kullanıcı bulunamadı',
          user: null, match: null, partner: null, event: null,
          waiting: null, roundInfo: null
        });
      }
      user = data;
    }

    // ═══ 2. EVENT BELİRLE ═══
    const eventId = eventIdParam || user.event_id;

    // Tüm eventleri al (selector için)
    const { data: allEventsData } = await supabase
      .from('events')
      .select('id, name, status, duration')
      .order('created_at', { ascending: false });

    const userInfo = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      company: user.company,
      position: user.position
    };

    if (!eventId) {
      return NextResponse.json({
        v: 'V14', user: userInfo,
        match: null, partner: null, event: null,
        waiting: null, roundInfo: null,
        allEvents: allEventsData || [],
        message: 'Aktif etkinlik bulunamadı.'
      });
    }

    // ═══ 3. EVENT DETAYLARI ═══
    const { data: event } = await supabase
      .from('events')
      .select('id, name, status, duration')
      .eq('id', eventId)
      .single();

    if (!event) {
      return NextResponse.json({
        v: 'V14', user: userInfo,
        match: null, partner: null, event: null,
        waiting: null, roundInfo: null,
        allEvents: allEventsData || [],
        error: 'Etkinlik bulunamadı'
      });
    }

    // ═══ 4. BU KULLANICINıN EŞLEŞMELERİNİ BUL ═══
    // DOĞRU KOLON ADLARI: user1_id ve user2_id
    const { data: matchesA, error: errA } = await supabase
      .from('matches')
      .select('*')
      .eq('user1_id', user.id)
      .eq('event_id', eventId);

    const { data: matchesB, error: errB } = await supabase
      .from('matches')
      .select('*')
      .eq('user2_id', user.id)
      .eq('event_id', eventId);

    if (errA) console.error('[V13] matches user1_id error:', errA);
    if (errB) console.error('[V13] matches user2_id error:', errB);

    const allMatches = [...(matchesA || []), ...(matchesB || [])];

    // Deduplicate
    const uniqueMatches = allMatches.filter((m, i, self) =>
      i === self.findIndex((x) => x.id === m.id)
    );

    // ═══ 5. AKTİF VEYA PENDING MATCH BUL (en yüksek tur) ═══
    const currentMatch = uniqueMatches
      .filter(m => m.status === 'active' || m.status === 'pending')
      .sort((a, b) => b.round_number - a.round_number)[0] || null;

    // ═══ 6. PARTNER BİLGİSİ ═══
    let partner = null;
    if (currentMatch) {
      const partnerId = currentMatch.user1_id === user.id
        ? currentMatch.user2_id
        : currentMatch.user1_id;

      const { data: partnerData } = await supabase
        .from('users')
        .select('id, full_name, company, email, position')
        .eq('id', partnerId)
        .single();

      partner = partnerData || null;
    }

    // ═══ 7. ROUND BİLGİSİ ═══
    const { data: allEventMatches } = await supabase
      .from('matches')
      .select('round_number, status')
      .eq('event_id', eventId);

    const maxRound = allEventMatches && allEventMatches.length > 0
      ? Math.max(...allEventMatches.map(m => m.round_number))
      : 0;

    const { data: participants } = await supabase
      .from('users')
      .select('id')
      .eq('event_id', eventId)
      .eq('checked_in', true);

    const allCompleted = uniqueMatches.length > 0 &&
      uniqueMatches.every(m => m.status === 'completed');

    const roundInfo = {
      current: currentMatch?.round_number || maxRound || 0,
      max: maxRound,
      participantCount: participants?.length || 0,
      allCompleted: allCompleted && !currentMatch
    };

    // ═══ 8. BEKLEME DURUMU (tek kalan katılımcı) ═══
    let waiting = null;
    if (!currentMatch && maxRound > 0 && !allCompleted) {
      const currentRoundMatches = allEventMatches?.filter(m => m.round_number === maxRound) || [];
      const activeCount = currentRoundMatches.filter(m => m.status === 'active').length;
      const pendingCount = currentRoundMatches.filter(m => m.status === 'pending').length;

      if (activeCount > 0 || pendingCount > 0) {
        // Son started_at'ı bul
        const { data: activeInRound } = await supabase
          .from('matches')
          .select('started_at')
          .eq('event_id', eventId)
          .eq('round_number', maxRound)
          .eq('status', 'active')
          .not('started_at', 'is', null)
          .order('started_at', { ascending: false })
          .limit(1);

        const lastStartedAt = activeInRound?.[0]?.started_at || null;

        waiting = {
          isWaiting: true,
          roundNumber: maxRound,
          activeCount,
          pendingCount,
          totalMatches: currentRoundMatches.length,
          allStarted: pendingCount === 0 && activeCount > 0,
          lastStartedAt
        };
      }
    }

    // ═══ 9. FRONTEND FORMAT ═══
    const formattedMatch = currentMatch ? {
      id: currentMatch.id,
      status: currentMatch.status,
      started_at: currentMatch.started_at,
      round_number: currentMatch.round_number,
      table_number: currentMatch.table_number,
      icebreaker_question: currentMatch.icebreaker_question
    } : null;

    return NextResponse.json({
      v: 'V14',
      user: userInfo,
      match: formattedMatch,
      partner,
      event: { id: event.id, name: event.name, duration: event.duration, status: event.status },
      waiting,
      roundInfo,
      allEvents: allEventsData || []
    });

  } catch (error: any) {
    console.error('[V13] Error fetching meeting data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
