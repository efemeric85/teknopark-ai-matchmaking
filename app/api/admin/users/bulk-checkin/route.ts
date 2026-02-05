import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST: Bulk update check-in status
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userIds, checked_in } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'userIds gerekli.' }, { status: 400 });
    }
    if (typeof checked_in !== 'boolean') {
      return NextResponse.json({ error: 'checked_in (boolean) gerekli.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('users')
      .update({ checked_in })
      .in('id', userIds);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
