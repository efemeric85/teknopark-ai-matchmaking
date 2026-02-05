import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PUT: Update event (status, max_rounds, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Only allow specific fields to be updated
    const allowed: Record<string, any> = {};
    if (body.status !== undefined) allowed.status = body.status;
    if (body.max_rounds !== undefined) allowed.max_rounds = Math.max(1, Math.min(50, body.max_rounds));
    if (body.name !== undefined) allowed.name = body.name;
    if (body.date !== undefined) allowed.date = body.date;
    if (body.duration !== undefined) allowed.duration = body.duration;
    if (body.round_duration_sec !== undefined) allowed.round_duration_sec = body.round_duration_sec;

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'Güncellenecek alan yok.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('events')
      .update(allowed)
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: Delete event with cascade (matches → users → event)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Cascade delete: matches first, then users, then event
    await supabase.from('matches').delete().eq('event_id', id);
    await supabase.from('users').delete().eq('event_id', id);
    const { error } = await supabase.from('events').delete().eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
