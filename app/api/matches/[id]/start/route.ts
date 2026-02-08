import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const matchId = params.id;

    const { data: match, error } = await supabase
      .from('matches').select('*')
      .eq('id').single();

    if (error || !match) {
      return NextResponse.json({ error: 'Eşleşme bulunamadı' }, { status: 404 });
    }

    if (match.status === 'active' && match.started_at) {
      return NextResponse.json({ success: true, match });
    }

    if (match.status === 'completed') {
      return NextResponse.json({ error: 'Bu görüşme zaten tamamlanmış' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from('matches')
      .update({ status: 'active', started_at: now })
      .eq('id')
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, match: updated });
  } catch (error: any) {
    console.error('Match start error:', error);
    return NextResponse.json({ error: 'Sunucu hatasi.' }, { status: 500 });
  }
}
