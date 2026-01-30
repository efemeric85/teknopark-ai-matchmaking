import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    
    const { data: match, error } = await supabase
      .from('matches')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;

    return NextResponse.json({ match });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
