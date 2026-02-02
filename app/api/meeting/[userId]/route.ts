import { createClient } from '@supabase/supabase-js';
import { NextResponse, NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = decodeURIComponent(params.userId);
    console.log('[MEETING-V4] Request for:', userId);

    // ─── 1. Kullanıcıyı bul ───
    // Email ise: TÜM kayıtları al, doğru event'i bul
    // ID ise: direkt al
    let user: any = null;

    if (userId.includes('@')) {
      const { data: allUsers } = await supabase
        .from('users').select('*').eq('email', userId);

      console.log('[MEETING-V4] Found', allUsers?.length || 0, 'user records for email');

      if (!allUsers || allUsers.length === 0) {
        return NextResponse.json({ apiVersion: 'V4', error: 'Kullanıcı bulunamadı', user: null, match: null, partner: null, event: null, waiting: null }, { status: 404 });
      }

      if (allUsers.length === 1) {
        user = allUsers[0];
      } else {
        // Birden fazla kayıt var. Pending/active match'i olanı bul.
        for (const candidate of allUsers) {
          if (!candidate.event_id) continue;
          const { data: activeMatches } = await supabase
            .from('matches').select('id, status')
            .eq('event_id', candidate.event_id)
            .in('status', ['pending', 'active'])
            .or(`user1_id.eq.${candidate.id},user2_id.eq.${candidate.id}`)
            .limit(1);

          if (activeMatches && activeMatches.length > 0) {
            user = candidate;
            console.log('[MEETING-V4] Found active match for user in event:', candidate.event_id);
            break;
          }
        }
        // Hiçbirinde aktif match yoksa en yenisini al
        if (!user) {
          user = allUsers.sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];
          console.log('[MEETING-V4] No active match, using most recent user');
        }
      }
    } else {
      const { data } = await supabase
        .from('users').select('*').eq('id', userId).single();
      user = data;
    }

    if (!user) {
      return NextResponse.json({ apiVersion: 'V4', error: 'Kullanıcı bulunamadı', user: null, match: null, partner: null, event: null, waiting: null }, { status: 404 });
    }

    console.log('[MEETING-V4] Using user:', user.id, 'event:', user.event_id);

    // ─── 2. Event bilgisi ───
    const { data: event } = await supabase
      .from('events').select('*').eq('id', user.event_id).single();

    // duration field: round_duration_sec VEYA duration
    const duration = event?.round_duration_sec || event?.duration || 360;
    const eventInfo = event ? { id: event.id, name: event.name, duration: duration, status: event.status } : null;
    const userInfo = { id: user.id, full_name: user.full_name, company: user.company, title: user.title, email: user.email, event_id: user.event_id };

    // ─── 3. Bu event'teki eşleşmeler ───
    const { data: allEventMatches } = await supabase
      .from('matches').select('*').eq('event_id', user.event_id)
      .order('round_number', { ascending: false });

    console.log('[MEETING-V4] Matches in event:', allEventMatches?.length || 0);

    if (!allEventMatches || allEventMatches.length === 0) {
      return NextResponse.json({ apiVersion: 'V4', user: userInfo, match: null, partner: null, event: eventInfo, waiting: null });
    }

    const maxRound = Math.max(...allEventMatches.map(m => m.round_number || 1));
    const currentRoundMatches = allEventMatches.filter(m => (m.round_number || 1) === maxRound);

    console.log('[MEETING-V4] Current round:', maxRound, 'matches:', currentRoundMatches.length,
      'statuses:', currentRoundMatches.map(m => m.status));

    // ─── 4. Bu kullanıcının eşleşmesi ───
    const userMatch = currentRoundMatches.find(
      m => (m.user1_id === user.id || m.user2_id === user.id) && (m.status === 'pending' || m.status === 'active')
    );

    if (!userMatch) {
      // Kullanıcı bu turda eşleşmemiş veya match'i completed
      const activeMatches = currentRoundMatches.filter(m => m.status === 'active');
      const pendingMatches = currentRoundMatches.filter(m => m.status === 'pending');
      const allStarted = pendingMatches.length === 0 && activeMatches.length > 0;

      let lastStartedAt: string | null = null;
      if (activeMatches.length > 0) {
        const sorted = activeMatches.filter(m => m.started_at)
          .sort((a, b) => new Date(b.started_at!).getTime() - new Date(a.started_at!).getTime());
        if (sorted.length > 0) lastStartedAt = sorted[0].started_at;
      }

      console.log('[MEETING-V4] User NOT matched this round. Active:', activeMatches.length, 'Pending:', pendingMatches.length);

      return NextResponse.json({
        apiVersion: 'V4', user: userInfo, match: null, partner: null, event: eventInfo,
        waiting: { isWaiting: true, roundNumber: maxRound, activeCount: activeMatches.length, pendingCount: pendingMatches.length, totalMatches: currentRoundMatches.length, allStarted, lastStartedAt }
      });
    }

    // ─── 5. Partner bilgisi ───
    const partnerId = userMatch.user1_id === user.id ? userMatch.user2_id : userMatch.user1_id;
    const { data: partner } = await supabase
      .from('users').select('*').eq('id', partnerId).single();

    console.log('[MEETING-V4] Match found:', userMatch.id, 'status:', userMatch.status, 'partner:', partner?.full_name);

    return NextResponse.json({
      apiVersion: 'V4',
      user: userInfo,
      match: { id: userMatch.id, status: userMatch.status, started_at: userMatch.started_at, round_number: userMatch.round_number },
      partner: partner ? { id: partner.id, full_name: partner.full_name, company: partner.company, title: partner.title, goal: partner.goal } : null,
      event: eventInfo, waiting: null,
    });
  } catch (error: any) {
    console.error('[MEETING-V4] Error:', error);
    return NextResponse.json({ apiVersion: 'V4', error: error.message || 'Hata oluştu.' }, { status: 500 });
  }
}
