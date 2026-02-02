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

    const { data: match } = await supabase
      .from('matches').select('status')
      .eq('id', matchId).single();

    if (match?.status === 'completed') {
      return NextResponse.json({ success: true });
    }

    const { error } = await supabase
      .from('matches')
      .update({ status: 'completed' })
      .eq('id', matchId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Match complete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
