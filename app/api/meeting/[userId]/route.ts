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

    let user: any = null;
    if (userId.includes('@')) {
      const { data } = await supabase
        .from('users').select('*').eq('email', userId)
        .order('created_at', { ascending: false }).limit(1);
      if (data && data.length > 0) user = data[0];
    } else {
      const { data } = await supabase
        .from('users').select('*').eq('id', userId).single();
      user = data;
    }

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı', user: null, match: null, partner: null, event: null, waiting: null }, { status: 404 });
    }

    const { data: event } = await supabase
      .from('events').select('*').eq('id', user.event_id).single();

    const eventInfo = event ? { id: event.id, name: event.name, duration: event.duration, status: event.status } : null;
    const userInfo = { id: user.id, full_name: user.full_name, company: user.company, title: user.title, email: user.email, event_id: user.event_id };

    const { data: allEventMatches } = await supabase
      .from('matches').select('*').eq('event_id', user.event_id)
      .order('round_number', { ascending: false });

    if (!allEventMatches || allEventMatches.length === 0) {
      return NextResponse.json({ user: userInfo, match: null, partner: null, event: eventInfo, waiting: null });
    }

    const maxRound = Math.max(...allEventMatches.map(m => m.round_number || 1));
    const currentRoundMatches = allEventMatches.filter(m => (m.round_number || 1) === maxRound);

    // Bu kullanıcının bu tur'daki eşleşmesi
    const userMatch = currentRoundMatches.find(
      m => (m.user1_id === user.id || m.user2_id === user.id) && (m.status === 'pending' || m.status === 'active')
    );

    if (!userMatch) {
      // Kullanıcı bu turda eşleşmemiş (beklemede)
      const activeMatches = currentRoundMatches.filter(m => m.status === 'active');
      const pendingMatches = currentRoundMatches.filter(m => m.status === 'pending');
      const allStarted = pendingMatches.length === 0 && activeMatches.length > 0;

      // Son başlayan eşleşmeyi bul (en geç started_at)
      let lastStartedAt: string | null = null;
      if (activeMatches.length > 0) {
        const sorted = activeMatches
          .filter(m => m.started_at)
          .sort((a, b) => new Date(b.started_at!).getTime() - new Date(a.started_at!).getTime());
        if (sorted.length > 0) lastStartedAt = sorted[0].started_at;
      }

      return NextResponse.json({
        user: userInfo, match: null, partner: null, event: eventInfo,
        waiting: {
          isWaiting: true,
          roundNumber: maxRound,
          activeCount: activeMatches.length,
          pendingCount: pendingMatches.length,
          totalMatches: currentRoundMatches.length,
          allStarted,
          lastStartedAt,
        }
      });
    }

    // Partner bilgisi
    const partnerId = userMatch.user1_id === user.id ? userMatch.user2_id : userMatch.user1_id;
    const { data: partner } = await supabase
      .from('users').select('*').eq('id', partnerId).single();

    return NextResponse.json({
      user: userInfo,
      match: { id: userMatch.id, status: userMatch.status, started_at: userMatch.started_at, round_number: userMatch.round_number },
      partner: partner ? { id: partner.id, full_name: partner.full_name, company: partner.company, title: partner.title, goal: partner.goal } : null,
      event: eventInfo,
      waiting: null,
    });
  } catch (error: any) {
    console.error('[Meeting API] Error:', error);
    return NextResponse.json({ error: error.message || 'Hata oluştu.' }, { status: 500 });
  }
}
