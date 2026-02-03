import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

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
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user');

  if (!matchId || !userId) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    // Try to activate (pending → active)
    const { data: activated } = await supabase
      .from('matches')
      .update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', matchId)
      .eq('status', 'pending')
      .select()
      .single();

    if (activated) {
      // Success: first person to scan
      const email = await getEmailById(userId);
      return NextResponse.redirect(new URL(`/meeting/${encodeURIComponent(email)}`, request.url));
    }

    // Race condition: match already active (other person scanned first)
    const { data: existing } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (existing && (existing.status === 'active' || existing.status === 'completed')) {
      // Match already running, redirect to meeting page
      const email = await getEmailById(userId);
      return NextResponse.redirect(new URL(`/meeting/${encodeURIComponent(email)}`, request.url));
    }

    // Match not found or weird state
    return NextResponse.redirect(new URL('/?error=match-not-found', request.url));
  } catch (error) {
    console.error('[GO-ROUTE] Error:', error);
    return NextResponse.redirect(new URL('/', request.url));
  }
}

async function getEmailById(userId: string): Promise<string> {
  const { data } = await supabase.from('users').select('email').eq('id', userId).single();
  return data?.email || userId;
}
