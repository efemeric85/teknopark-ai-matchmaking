import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: { matchId: string } }
) {
  try {
    const matchId = params.matchId;

    // Mevcut durumu kontrol et
    const { data: match, error } = await supabase
      .from('matches').select('*')
      .eq('id', matchId).single();

    if (error || !match) {
      return NextResponse.json({ error: 'Eşleşme bulunamadı' }, { status: 404 });
    }

    // Zaten başlamışsa, mevcut durumu dön (idempotent)
    if (match.status === 'active' && match.started_at) {
      return NextResponse.json({ success: true, match });
    }

    // Tamamlanmışsa başlatma
    if (match.status === 'completed') {
      return NextResponse.json({ error: 'Bu görüşme zaten tamamlanmış' }, { status: 400 });
    }

    // Timer'ı başlat
    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from('matches')
      .update({ status: 'active', started_at: now })
      .eq('id', matchId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, match: updated });
  } catch (error: any) {
    console.error('Match start error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
