import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const eventId = searchParams.get('event_id');

    if (!email) {
      return NextResponse.json({ error: 'Email gerekli.' }, { status: 400 });
    }

    let query = supabase
      .from('users')
      .select('*')
      .eq('email', email);

    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    const { data: user, error } = await query.single();

    if (error || !user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('Error logging in:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
