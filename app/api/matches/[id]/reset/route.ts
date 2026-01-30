import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// Reset match for testing
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const matchId = params.id;

    const { error } = await supabase
      .from('matches')
      .update({ 
        handshake_a: false,
        handshake_b: false,
        status: 'pending',
        started_at: null
      })
      .eq('id', matchId);

    if (error) throw error;

    // Fetch updated match
    const { data: updatedMatch } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    return NextResponse.json({ success: true, match: updatedMatch });
  } catch (error: any) {
    console.error('Match reset error:', error);
    return NextResponse.json(
      { error: error.message || 'Bir hata oluştu' },
      { status: 500 }
    );
  }
}
