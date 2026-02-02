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
    console.log('[Meeting API] Looking up:', userId);

    // Kullanıcıyı bul: email veya UUID ile
    let user: any = null;

    if (userId.includes('@')) {
      // Email ile ara
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      console.log('[Meeting API] Email search result:', data?.length, 'error:', error?.message);

      if (data && data.length > 0) {
        user = data[0];
      }
    } else {
      // UUID ile ara
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('[Meeting API] UUID search result:', data?.id, 'error:', error?.message);
      user = data;
    }

    if (!user) {
      return NextResponse.json({
        error: 'Kullanıcı bulunamadı',
        user: null, match: null, partner: null, event: null
      }, { status: 404 });
    }

    console.log('[Meeting API] Found user:', user.id, user.full_name, 'event:', user.event_id);

    // Bu kullanıcının EN SON aktif eşleşmesini bul
    // user1_id veya user2_id olarak ayrı ayrı sorgula (JOIN yok)
    const { data: matchesAsUser1, error: e1 } = await supabase
      .from('matches')
      .select('*')
      .eq('user1_id', user.id)
      .in('status', ['active', 'pending'])
      .order('round_number', { ascending: false })
      .limit(1);

    const { data: matchesAsUser2, error: e2 } = await supabase
      .from('matches')
      .select('*')
      .eq('user2_id', user.id)
      .in('status', ['active', 'pending'])
      .order('round_number', { ascending: false })
      .limit(1);

    console.log('[Meeting API] Matches as user1:', matchesAsUser1?.length, 'error:', e1?.message);
    console.log('[Meeting API] Matches as user2:', matchesAsUser2?.length, 'error:', e2?.message);

    // En güncel eşleşmeyi al
    const allMatches = [
      ...(matchesAsUser1 || []),
      ...(matchesAsUser2 || [])
    ].sort((a, b) => (b.round_number || 0) - (a.round_number || 0));

    const match = allMatches.length > 0 ? allMatches[0] : null;

    if (!match) {
      // Eşleşme yok ama etkinlik bilgisini dön
      const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('id', user.event_id)
        .single();

      console.log('[Meeting API] No match found for user:', user.id);

      return NextResponse.json({
        user: { id: user.id, full_name: user.full_name, company: user.company, title: user.title, email: user.email, event_id: user.event_id },
        match: null,
        partner: null,
        event: event ? { id: event.id, name: event.name, duration: event.duration, status: event.status } : null
      });
    }

    console.log('[Meeting API] Found match:', match.id, 'status:', match.status, 'round:', match.round_number);

    // Partner bilgisini al
    const partnerId = match.user1_id === user.id ? match.user2_id : match.user1_id;
    const { data: partner } = await supabase
      .from('users')
      .select('id, full_name, company, title, email, goal')
      .eq('id', partnerId)
      .single();

    // Etkinlik bilgisi
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', user.event_id)
      .single();

    return NextResponse.json({
      user: { id: user.id, full_name: user.full_name, company: user.company, title: user.title, email: user.email, event_id: user.event_id },
      match: { id: match.id, status: match.status, started_at: match.started_at, round_number: match.round_number },
      partner: partner ? { id: partner.id, full_name: partner.full_name, company: partner.company, title: partner.title, goal: partner.goal } : null,
      event: event ? { id: event.id, name: event.name, duration: event.duration, status: event.status } : null
    });
  } catch (error: any) {
    console.error('[Meeting API] Error:', error);
    return NextResponse.json({ error: error.message || 'Veri alınırken hata oluştu.' }, { status: 500 });
  }
}
