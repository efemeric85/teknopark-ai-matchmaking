import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const identifier = decodeURIComponent(params.userId || '');
    if (!identifier) {
      return NextResponse.json({ error: 'Kullanıcı kimliği gerekli' }, { status: 400 });
    }

    const isEmail = identifier.includes('@');
    let user;

    if (isEmail) {
      const { data, error } = await supabase
        .from('users').select('*')
        .eq('email', identifier)
        .order('created_at', { ascending: false })
        .limit(1).single();
      if (error || !data) return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
      user = data;
    } else {
      const { data, error } = await supabase
        .from('users').select('*')
        .eq('id', identifier).single();
      if (error || !data) return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
      user = data;
    }

    // Event bilgisi
    const { data: event } = await supabase
      .from('events').select('id, name, round_duration_sec, status')
      .eq('id', user.event_id).single();

    // Tüm eşleşmeleri bul
    const { data: m1 } = await supabase.from('matches').select('*').eq('user1_id', user.id);
    const { data: m2 } = await supabase.from('matches').select('*').eq('user2_id', user.id);
    const allMatches = [...(m1 || []), ...(m2 || [])];

    // Mevcut tur = en yüksek round_number
    const currentRound = allMatches.length > 0
      ? Math.max(...allMatches.map(m => m.round_number || 1))
      : 0;

    // Mevcut turdaki eşleşmeyi bul
    const currentRoundMatch = allMatches.find(m => (m.round_number || 1) === currentRound);

    let currentMatch = null;
    if (currentRoundMatch) {
      const partnerId = currentRoundMatch.user1_id === user.id
        ? currentRoundMatch.user2_id
        : currentRoundMatch.user1_id;

      const { data: partner } = await supabase
        .from('users')
        .select('id, full_name, company, position, current_intent')
        .eq('id', partnerId).single();

      currentMatch = { ...currentRoundMatch, partner };
    }

    return NextResponse.json({
      user,
      event: event ? {
        id: event.id,
        name: event.name,
        round_duration_sec: event.round_duration_sec || 360
      } : null,
      currentRound,
      currentMatch
    });
  } catch (error: any) {
    console.error('Meeting API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
