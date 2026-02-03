import { createClient } from '@supabase/supabase-js';
import { NextResponse, NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { matchId: string } }
) {
  const matchId = params.matchId;
  const email = request.nextUrl.searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Email parametresi eksik' }, { status: 400 });
  }

  try {
    const { data: match } = await supabase
      .from('matches').select('*').eq('id', matchId).single();

    if (!match) {
      const url = new URL(`/meeting/${encodeURIComponent(email)}`, request.nextUrl.origin);
      return NextResponse.redirect(url);
    }

    // Sadece pending ise active yap
    if (match.status === 'pending') {
      await supabase
        .from('matches')
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', matchId)
        .eq('status', 'pending');

      console.log('[GO-ROUTE] Match activated:', matchId, 'by:', email);
    } else {
      console.log('[GO-ROUTE] Match already', match.status, ':', matchId);
    }

    const url = new URL(`/meeting/${encodeURIComponent(email)}`, request.nextUrl.origin);
    return NextResponse.redirect(url);
  } catch (error: any) {
    console.error('[GO-ROUTE] Error:', error);
    const url = new URL(`/meeting/${encodeURIComponent(email)}`, request.nextUrl.origin);
    return NextResponse.redirect(url);
  }
}
