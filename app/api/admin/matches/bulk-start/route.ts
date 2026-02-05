import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST: Start all pending matches (bulk)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchIds } = body;

    if (!matchIds || !Array.isArray(matchIds) || matchIds.length === 0) {
      return NextResponse.json({ error: 'matchIds gerekli.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('matches')
      .update({ status: 'active', started_at: now })
      .in('id', matchIds);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
