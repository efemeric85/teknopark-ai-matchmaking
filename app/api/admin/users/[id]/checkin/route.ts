import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PUT: Toggle check-in for a single user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { checked_in } = body;

    if (typeof checked_in !== 'boolean') {
      return NextResponse.json({ error: 'checked_in (boolean) gerekli.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('users')
      .update({ checked_in })
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'Sunucu hatasi.' }, { status: 500 });
  }
}
