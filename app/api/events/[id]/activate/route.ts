import { createClient } from '@supabase/supabase-js';
import { NextResponse, NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST: Bekleyen eşleşmeleri aktifleştir
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;
    const now = new Date().toISOString();

    // Tüm pending eşleşmeleri active yap
    const { data, error } = await supabase
      .from('matches')
      .update({ status: 'active', started_at: now })
      .eq('event_id', eventId)
      .eq('status', 'pending')
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      activatedCount: data?.length || 0,
      message: `${data?.length || 0} eşleşme aktifleştirildi.`
    });
  } catch (error: any) {
    console.error('Activation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
